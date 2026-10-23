// Bedienfeld, Farbwahl, Einstellungen
import { listInputs } from './audio.js';

const HIDE_AFTER_MS = 5000;
const $ = id => document.getElementById(id);

export function setupUI(app) {
  const s = app.settings;
  const panel = $('panel'), dlg = $('settings');
  let timer = 0;

  function armHide() {
    clearTimeout(timer);
    if (dlg.hidden) timer = setTimeout(hidePanel, HIDE_AFTER_MS);
  }
  function showPanel() { panel.classList.remove('off'); armHide(); }
  function hidePanel() { clearTimeout(timer); if (dlg.hidden) panel.classList.add('off'); }

  function mark() {
    document.querySelectorAll('#modes [data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === s.mode));
    document.querySelectorAll('#themes .sw').forEach(b => b.classList.toggle('on', +b.dataset.t === s.theme));
    $('swCustom').style.background = s.custom;
    $('cp').value = s.custom;
  }
  function changed() { app.save(); app.applyLook(); mark(); }

  // Tippen irgendwo: Bedienfeld zurückholen, ggf. Audio starten
  $('app').addEventListener('pointerdown', e => {
    if (panel.contains(e.target) || dlg.contains(e.target)) { armHide(); return; }
    if (e.target.closest('#btnHide')) return;
    showPanel();
  });
  $('start').addEventListener('click', () => { app.startAudio(); });
  $('btnHide').addEventListener('click', hidePanel);

  $('modes').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.disabled) return;
    s.mode = +b.dataset.m;
    changed();
  });
  $('themes').addEventListener('click', e => {
    const b = e.target.closest('.sw');
    if (!b) return;
    s.theme = +b.dataset.t;
    changed();
  });
  $('cp').addEventListener('input', e => { s.custom = e.target.value; s.theme = 6; changed(); });

  // Einstellungen
  const sliders = [
    ['sSens', 'sens', v => (v > 0 ? '+' : '') + v + ' DB'],
    ['sBright', 'bright', v => v + '%'],
    ['sSmooth', 'smooth', v => String(v)]
  ];
  for (const [id, key, fmt] of sliders) {
    const el = $(id), out = $('v' + id.slice(1));
    el.value = s[key];
    out.textContent = fmt(s[key]);
    el.addEventListener('input', () => {
      s[key] = +el.value;
      out.textContent = fmt(s[key]);
      changed();
    });
  }

  const night = $('sNight');
  function markNight() { night.textContent = s.night ? 'EIN' : 'AUS'; night.classList.toggle('on', s.night); }
  night.addEventListener('click', () => { s.night = !s.night; markNight(); changed(); });
  markNight();

  const sel = $('sDev');
  async function fillDevices() {
    let devs = [];
    try { devs = await listInputs(); } catch (e) { /* ignorieren */ }
    sel.textContent = '';
    const add = (value, text) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      sel.appendChild(o);
    };
    add('', 'STANDARD');
    devs.forEach((d, i) => add(d.deviceId, (d.label || 'EINGANG ' + (i + 1)).toUpperCase()));
    if (s.device && !devs.some(d => d.deviceId === s.device)) add(s.device, 'GESPEICHERT (NICHT DA)');
    sel.value = s.device;
  }
  sel.addEventListener('change', () => {
    s.device = sel.value;
    app.save();
    if (app.audio.running) app.startAudio();
  });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => { if (!dlg.hidden) fillDevices(); });
  }

  $('btnSet').addEventListener('click', () => {
    fillDevices();
    dlg.hidden = false;
    clearTimeout(timer);
  });
  $('btnOk').addEventListener('click', () => { dlg.hidden = true; armHide(); });

  mark();
  showPanel();
}
