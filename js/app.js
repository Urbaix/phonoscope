// PHONOSCOPE: Start, Render-Schleife, Wake Lock
import { AudioInput, NB } from './audio.js';
import { Renderer, MODE_NAMES, THEME_NAMES, VU_FULL, ledPos } from './render.js';
import { loadSettings, saveSettings } from './settings.js';
import { setupUI } from './ui.js';

// Anzeigebereich je Terzband: oberes Ende in dB (bei Empfindlichkeit 0) und Spanne
const TOP_DB = -30;
const RANGE_DB = 50;
const ATTACK_S = 0.012;
const PEAK_HOLD_S = 1.0;
const PEAK_FALL = 0.3; // Displayhöhe pro Sekunde
// VU: 0 VU entspricht diesem RMS-Pegel (bei Empfindlichkeit 0)
const VU_REF_DB = -20;
// Zeigerträgheit nach VU-Norm: 99 % nach ca. 300 ms, ca. 1,5 % Überschwingen
const VU_WN = 13;
const VU_ZETA = 0.8;
const VU_STEP = 0.002;
// Auto-Pegel: Lautstärke der letzten Sekunden auf diesen RMS-Pegel ziehen
const AGC_TARGET_DB = -23;
const AGC_UP_S = 1.5;    // lauter werden: schnell zurücknehmen
const AGC_DOWN_S = 5;    // leiser werden: langsam aufholen
const AGC_GATE_DB = -80; // darunter (Stille) nicht nachregeln
const AGC_MIN = -30, AGC_MAX = 50;
const AGC_SETTLE_S = 1.5; // nach dem Start schnell einrasten
const AGC_FAST_S = 0.3;

const $ = id => document.getElementById(id);
const settings = loadSettings();
const audio = new AudioInput();
const renderer = new Renderer($('cv'));

const lv = new Float32Array(NB), pk = new Float32Array(NB), pt = new Float32Array(NB);
// Zeiger L/R: Ausschlag (1 = 0 VU) und Geschwindigkeit; LED-Peaks
const vx = [0, 0], vv = [0, 0], led = [0, 0], ledPk = [0, 0], ledPt = [0, 0];
const frame = { lv, pk, vu: [0, 0], led, ledPk, wl: null, wr: null, amp: 1, dt: 0, now: null };
// geglätteter Eingangspegel in dB für den Auto-Pegel
let agcDb = AGC_TARGET_DB, agcAge = 0;

const app = {
  settings,
  audio,
  renderer,
  save() { saveSettings(settings); },
  // Auto-Pegel-Anteil in dB (0 wenn aus)
  get autoGain() { return settings.auto ? Math.min(AGC_MAX, Math.max(AGC_MIN, AGC_TARGET_DB - agcDb)) : 0; },
  applyLook() {
    renderer.setTheme(settings.theme, settings.custom);
    renderer.setMode(settings.mode);
    renderer.setSkin(settings.skin);
    document.body.className = 'skin-' + ['pc', 'alu', 'wood'][settings.skin];
    const b = settings.bright / 100 * (settings.night ? 0.35 : 1);
    $('dim').style.opacity = (1 - b).toFixed(3);
    $('lcd').textContent = MODE_NAMES[settings.mode] + ' · ' + THEME_NAMES[settings.theme];
  },
  async startAudio() {
    const msg = $('startMsg');
    $('start').hidden = false;
    msg.textContent = 'MIKROFON WIRD ANGEFRAGT';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg.textContent = 'KEIN AUDIOZUGRIFF. SEITE MUSS ÜBER HTTPS LAUFEN.';
      return false;
    }
    try {
      await audio.start(settings.device);
      agcDb = AGC_TARGET_DB;
      agcAge = 0;
    } catch (e) {
      msg.textContent = e.name === 'NotAllowedError'
        ? 'MIKROFON GESPERRT. ERLAUBEN UND ERNEUT TIPPEN.'
        : 'EINGANG NICHT VERFÜGBAR (' + (e.name || 'FEHLER') + '). ERNEUT TIPPEN.';
      return false;
    }
    $('start').hidden = true;
    updateFoot();
    requestWakeLock();
    return true;
  }
};

function updateFoot() {
  if (!audio.running) { $('src').textContent = 'KEIN EINGANG'; $('rate').textContent = '--.- KHZ'; return; }
  const name = (audio.label || 'EINGANG').toUpperCase().slice(0, 32);
  $('src').textContent = name + ' · ' + (audio.mono ? 'MONO' : 'STEREO');
  $('rate').textContent = (audio.sampleRate / 1000).toFixed(1) + ' KHZ';
}

audio.onstop = () => {
  $('start').hidden = false;
  $('startMsg').textContent = 'EINGANG GETRENNT. TIPPEN ZUM NEUSTART.';
  updateFoot();
};

// Wake Lock: Display anlassen, nach Rückkehr in die App neu anfordern
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  requestWakeLock();
  if (audio.running && audio.ctx && audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
});

// Uhr in der LCD-Zeile
function tickClock() {
  const d = new Date();
  $('clk').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Pegel je Band: schneller Anstieg, Abfall nach Glätte, Peak-Hold
function process(dt) {
  // Auto-Pegel nachführen, dann wirkt die Summe aus Auto und manuellem Regler
  const inDb = 20 * Math.log10(Math.max(1e-7, (audio.level.l + audio.level.r) / 2));
  if (inDb > AGC_GATE_DB) {
    const tau = agcAge < AGC_SETTLE_S ? AGC_FAST_S : inDb > agcDb ? AGC_UP_S : AGC_DOWN_S;
    agcDb += (inDb - agcDb) * (1 - Math.exp(-dt / tau));
    agcAge += dt;
  }
  const sens = settings.sens + app.autoGain;

  const release = 0.04 + settings.smooth / 100 * 0.5;
  const ka = 1 - Math.exp(-dt / ATTACK_S), kr = 1 - Math.exp(-dt / release);
  const top = TOP_DB - sens;
  for (let b = 0; b < NB; b++) {
    const v = Math.min(1, Math.max(0, (audio.bandDb[b] - (top - RANGE_DB)) / RANGE_DB));
    lv[b] += (v - lv[b]) * (v > lv[b] ? ka : kr);
    if (lv[b] >= pk[b]) { pk[b] = lv[b]; pt[b] = PEAK_HOLD_S; }
    else if (pt[b] > 0) pt[b] -= dt;
    else pk[b] = Math.max(0, pk[b] - PEAK_FALL * dt);
  }

  // VU: Zeiger als gedämpftes Feder-Masse-System, angetrieben vom RMS-Pegel
  const ref = Math.pow(10, (VU_REF_DB - sens) / 20);
  // Oszilloskop/Goniometer: Referenzpegel füllt etwa ein Drittel der halben Höhe
  frame.amp = 1 / (ref * 3);
  const input = [audio.level.l / ref, audio.level.r / ref];
  for (let ch = 0; ch < 2; ch++) {
    for (let t = 0; t < dt; t += VU_STEP) {
      const h = Math.min(VU_STEP, dt - t);
      vv[ch] += (VU_WN * VU_WN * (input[ch] - vx[ch]) - 2 * VU_ZETA * VU_WN * vv[ch]) * h;
      vx[ch] += vv[ch] * h;
    }
    // Anschlag rechts
    if (vx[ch] > VU_FULL * 1.06) { vx[ch] = VU_FULL * 1.06; vv[ch] = Math.min(0, vv[ch]); }
    if (vx[ch] < 0) { vx[ch] = 0; vv[ch] = Math.max(0, vv[ch]); }
    frame.vu[ch] = vx[ch] / VU_FULL;
    led[ch] = vx[ch] > 0 ? Math.min(1, Math.max(0, ledPos(20 * Math.log10(vx[ch])))) : 0;
    if (led[ch] >= ledPk[ch]) { ledPk[ch] = led[ch]; ledPt[ch] = PEAK_HOLD_S; }
    else if (ledPt[ch] > 0) ledPt[ch] -= dt;
    else ledPk[ch] = Math.max(0, ledPk[ch] - PEAK_FALL * dt);
  }
}

let last = performance.now(), footTimer = 0;
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  frame.now = new Date();
  frame.dt = dt;
  if (audio.update()) {
    process(dt);
    frame.lv = lv;
    frame.wl = audio.tL;
    frame.wr = audio.mono ? audio.tL : audio.tR;
    footTimer += dt;
    if (footTimer > 1) { footTimer = 0; updateFoot(); }
  } else {
    frame.lv = null;
  }
  renderer.draw(frame);
  requestAnimationFrame(loop);
}

function init() {
  renderer.resize();
  new ResizeObserver(() => renderer.resize()).observe($('screen'));
  if (document.fonts) document.fonts.load("20px 'VT323'").then(() => { renderer.dirty = true; });
  app.applyLook();
  setupUI(app);
  tickClock();
  setInterval(tickClock, 1000);
  requestAnimationFrame(loop);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

window.phonoscope = app; // zur Fehlersuche in der Konsole
init();
