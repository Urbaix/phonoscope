// Einstellungen: Standardwerte und Speicherung in localStorage
const KEY = 'phonoscope.settings.v1';

export const DEFAULTS = {
  mode: 0,          // 0 BALKEN
  theme: 0,         // 0 TÜRKIS
  custom: '#7cff4f',
  sens: 0,          // Empfindlichkeit in dB, -40 .. +40 (zusätzlich zum Auto-Pegel)
  auto: true,       // Auto-Pegel
  skin: 0,          // 0 90ER PC, 1 TECHNICS SILBER, 2 HOLZ 70ER
  bright: 100,      // Helligkeit in %, 20 .. 100
  smooth: 40,       // Glätte 0 .. 100
  device: '',       // deviceId der Eingangsquelle, '' = Standard
  night: false      // Nachtmodus (gedimmt)
};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* privat/gesperrt */ }
  const s = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k];
  }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignorieren */ }
}
