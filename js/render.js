// Canvas-Zeichnung: Segmente mit Glow, Farbthemen
import { NB } from './audio.js';

export const MODE_NAMES = ['BALKEN', 'WELLE', 'PUNKTE', 'VU ANALOG', 'VU LED', 'UHR', 'KOMBI'];
export const THEME_NAMES = ['TÜRKIS', 'BERNSTEIN', 'GRÜN-ROT', 'BUNT', 'GLUT', 'EISWEISS', 'EIGENE'];

const SEGS = 20;
const FONT = "'VT323', ui-monospace, monospace";
const LABEL_COLOR = '#7d8a86';
const UNLIT_ALPHA = 0.09;
// Beschriftung: Bandindex -> Text
const LABELS = { 2: '31', 5: '63', 8: '125', 11: '250', 14: '500', 17: '1K', 20: '2K', 23: '4K', 26: '8K', 29: '16K' };

function hx(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, k) {
  const A = hx(a), C = hx(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (C[i] - v) * k)).join(',') + ')';
}

// Farbe für Band b auf relativer Höhe k (0 unten .. 1 oben)
export function themeColor(theme, custom, b, k) {
  switch (theme) {
    case 0: return '#3ff0d8';
    case 1: return '#ffb13b';
    case 2: return k > 0.84 ? '#ff3b30' : k > 0.64 ? '#ffd23b' : '#3bff6a';
    case 3: return 'hsl(' + Math.round(b / (NB - 1) * 280) + ',95%,60%)'; // Regenbogen: tief rot, hoch violett
    case 4: return mix('#ff7a1a', '#ff2e88', k);
    case 5: return '#e6f2ff';
    default: return custom;
  }
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');   // unbeleuchtete Segmente + Beschriftung
    this.lit = document.createElement('canvas');  // beleuchtete Segmente
    this.g1 = document.createElement('canvas');   // Glow, 1/4
    this.g2 = document.createElement('canvas');   // Glow, 1/16
    this.theme = 0;
    this.custom = '#7cff4f';
    this.dirty = true;
  }

  resize() {
    const d = window.devicePixelRatio || 1, r = this.cv.getBoundingClientRect();
    this.dpr = d;
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    const pw = Math.round(this.W * d), ph = Math.round(this.H * d);
    for (const c of [this.cv, this.bg, this.lit]) { c.width = pw; c.height = ph; }
    this.g1.width = Math.ceil(pw / 4); this.g1.height = Math.ceil(ph / 4);
    this.g2.width = Math.ceil(pw / 16); this.g2.height = Math.ceil(ph / 16);
    this.dirty = true;
  }

  setTheme(theme, custom) {
    this.theme = theme;
    this.custom = custom;
    this.dirty = true;
  }

  layout() {
    const W = this.W, H = this.H, padX = 12, top = 14, lab = 28;
    const gh = H - top - lab, cw = (W - padX * 2) / NB, sh = gh / SEGS;
    this.L = { padX, top, lab, gh, cw, bw: cw * 0.72, sh, sg: sh * 0.62 };
    this.colors = [];
    for (let b = 0; b < NB; b++) {
      const row = [];
      for (let s = 0; s < SEGS; s++) row.push(themeColor(this.theme, this.custom, b, s / (SEGS - 1)));
      this.colors.push(row);
    }
  }

  segRect(b, s) {
    const L = this.L;
    return [L.padX + b * L.cw + (L.cw - L.bw) / 2, L.top + L.gh - (s + 1) * L.sh + (L.sh - L.sg) / 2, L.bw, L.sg];
  }

  buildBg() {
    this.layout();
    const c = this.bg.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    c.globalAlpha = UNLIT_ALPHA;
    for (let b = 0; b < NB; b++) {
      for (let s = 0; s < SEGS; s++) { c.fillStyle = this.colors[b][s]; c.fillRect(...this.segRect(b, s)); }
    }
    c.globalAlpha = 1;
    c.font = '20px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = LABEL_COLOR;
    for (const i in LABELS) c.fillText(LABELS[i], this.L.padX + i * this.L.cw + this.L.cw / 2, this.H - 6);
    this.dirty = false;
  }

  // lv, pk: Pegel 0..1 je Band
  drawBars(lv, pk) {
    if (this.dirty) this.buildBg();
    const c = this.lit.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    if (lv) {
      for (let b = 0; b < NB; b++) {
        const n = Math.round(lv[b] * SEGS), p = Math.min(SEGS - 1, Math.round(pk[b] * SEGS));
        for (let s = 0; s < n; s++) { c.fillStyle = this.colors[b][s]; c.fillRect(...this.segRect(b, s)); }
        if (p >= n && pk[b] > 0.5 / SEGS) { c.fillStyle = this.colors[b][p]; c.fillRect(...this.segRect(b, p)); }
      }
    }
    this.compose();
  }

  compose() {
    const m = this.ctx, pw = this.cv.width, ph = this.cv.height;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.globalAlpha = 1;
    m.clearRect(0, 0, pw, ph);
    m.drawImage(this.bg, 0, 0);
    // Glow: beleuchtete Ebene verkleinern und weich wieder hochskalieren
    const a = this.g1.getContext('2d'), z = this.g2.getContext('2d');
    a.clearRect(0, 0, this.g1.width, this.g1.height);
    a.drawImage(this.lit, 0, 0, this.g1.width, this.g1.height);
    z.clearRect(0, 0, this.g2.width, this.g2.height);
    z.drawImage(this.g1, 0, 0, this.g2.width, this.g2.height);
    m.imageSmoothingEnabled = true;
    m.globalCompositeOperation = 'lighter';
    m.globalAlpha = 0.55;
    m.drawImage(this.g1, 0, 0, pw, ph);
    m.globalAlpha = 0.8;
    m.drawImage(this.g2, 0, 0, pw, ph);
    m.globalCompositeOperation = 'source-over';
    m.globalAlpha = 1;
    m.drawImage(this.lit, 0, 0);
  }
}
