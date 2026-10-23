// PHONOSCOPE: Start, Render-Schleife, Wake Lock
import { AudioInput, NB } from './audio.js';
import { Renderer, MODE_NAMES, THEME_NAMES } from './render.js';
import { loadSettings, saveSettings } from './settings.js';
import { setupUI } from './ui.js';

// Anzeigebereich je Terzband: oberes Ende in dB (bei Empfindlichkeit 0) und Spanne
const TOP_DB = -30;
const RANGE_DB = 50;
const ATTACK_S = 0.012;
const PEAK_HOLD_S = 1.0;
const PEAK_FALL = 0.3; // Displayhöhe pro Sekunde

const $ = id => document.getElementById(id);
const settings = loadSettings();
const audio = new AudioInput();
const renderer = new Renderer($('cv'));

const lv = new Float32Array(NB), pk = new Float32Array(NB), pt = new Float32Array(NB);

const app = {
  settings,
  audio,
  renderer,
  save() { saveSettings(settings); },
  applyLook() {
    renderer.setTheme(settings.theme, settings.custom);
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
  const release = 0.04 + settings.smooth / 100 * 0.5;
  const ka = 1 - Math.exp(-dt / ATTACK_S), kr = 1 - Math.exp(-dt / release);
  const top = TOP_DB - settings.sens;
  for (let b = 0; b < NB; b++) {
    const v = Math.min(1, Math.max(0, (audio.bandDb[b] - (top - RANGE_DB)) / RANGE_DB));
    lv[b] += (v - lv[b]) * (v > lv[b] ? ka : kr);
    if (lv[b] >= pk[b]) { pk[b] = lv[b]; pt[b] = PEAK_HOLD_S; }
    else if (pt[b] > 0) pt[b] -= dt;
    else pk[b] = Math.max(0, pk[b] - PEAK_FALL * dt);
  }
}

let last = performance.now(), footTimer = 0;
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (audio.update()) {
    process(dt);
    renderer.drawBars(lv, pk);
    footTimer += dt;
    if (footTimer > 1) { footTimer = 0; updateFoot(); }
  } else {
    renderer.drawBars(null, null);
  }
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
