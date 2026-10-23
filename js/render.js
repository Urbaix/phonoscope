// Canvas-Zeichnung: Segmente mit Glow, Farbthemen, alle Modi
import { NB } from './audio.js';

export const MODE_NAMES = ['BALKEN', 'WELLE', 'PUNKTE', 'VU ANALOG', 'VU LED', 'UHR', 'KOMBI',
  'OSZILLOSKOP', 'GONIOMETER', 'WASSERFALL'];
export const THEME_NAMES = ['TÜRKIS', 'BERNSTEIN', 'GRÜN-ROT', 'BUNT', 'GLUT', 'EISWEISS', 'EIGENE'];
export const MODES = { BARS: 0, WAVE: 1, DOTS: 2, VU: 3, LED: 4, CLOCK: 5, COMBO: 6, OSC: 7, GONIO: 8, FALL: 9 };
// Reihenfolge der Tasten im Bedienfeld, gilt auch fürs Wischen
export const MODE_ORDER = [0, 1, 2, 9, 7, 8, 3, 4, 6, 5];
export const SKIN_NAMES = ['90ER PC', 'TECHNICS SILBER', 'HOLZ 70ER'];
export const SKINS = { PC: 0, ALU: 1, WOOD: 2 };

const SEGS = 20;
const LED_SEGS = 32;
const FONT = "'VT323', ui-monospace, monospace";
const LABEL_COLOR = '#7d8a86';
const UNLIT_ALPHA = 0.09;
// Beschriftung: Bandindex -> Text
const LABELS = { 2: '31', 5: '63', 8: '125', 11: '250', 14: '500', 17: '1K', 20: '2K', 23: '4K', 26: '8K', 29: '16K' };

// VU-Skala: Zeigerausschlag linear zur Spannung, +3 VU = Vollausschlag
export const VU_FULL = Math.pow(10, 3 / 20);
const VU_TICKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const VU_TEXT = [-20, -10, -7, -5, -3, 0, 1, 2, 3];
const VU_ARC = 0.78;
const VU_HEIGHT = 0.85; // Anteil der Displayhöhe
const VU_INK = '#2b1d10';
const VU_RED = '#c8281e';
const NEEDLE = ['#151515', '#b01e18']; // L, R (Doppelzeiger im Kombi-Modus)
// Skalenbeleuchtung je Thema (Bernstein-Töne für die bunten Themen)
const FACES = ['#9fd8f5', '#ffc06a', '#ffd08a', '#ffd08a', '#ffa860', '#f3efe2'];
const FACE_WOOD = '#ffb54a';
// LED-Skala in dB
const LED_MIN = -20, LED_MAX = 3;
const LED_TEXT = [-20, -10, -7, -5, -3, 0, 3];
// Nachleuchten (Zeitkonstante in s) für Oszilloskop und Goniometer
const PERSIST_OSC = 0.12;
const PERSIST_GONIO = 0.2;
const OSC_WINDOW = 1024;
// Wasserfall: Zeilen pro Sekunde und gespeicherte Zeilen
const FALL_RATE = 40;
const FALL_ROWS = 240;

// 7-Segment-Ziffern: a b c d e f g
const DIGITS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg'
};

function hx(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, k) {
  const A = hx(a), C = hx(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (C[i] - v) * k)).join(',') + ')';
}
const pad2 = n => String(n).padStart(2, '0');

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

export function ledPos(db) { return (db - LED_MIN) / (LED_MAX - LED_MIN); }

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');   // unbeleuchtete Segmente, Skalen, Beschriftung
    this.lit = document.createElement('canvas');  // beleuchtete Segmente bzw. Leuchtspur
    this.g1 = document.createElement('canvas');   // Glow, 1/4
    this.g2 = document.createElement('canvas');   // Glow, 1/16
    this.fall = document.createElement('canvas'); // Wasserfall: eine Zeile pro Zeitschritt, ein Pixel pro Band
    this.fall.width = NB;
    this.fall.height = FALL_ROWS;
    this.fallHead = 0;
    this.fallAcc = 0;
    this.theme = 0;
    this.custom = '#7cff4f';
    this.mode = 0;
    this.skin = 0;
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

  setMode(mode) {
    if (mode !== this.mode) { this.mode = mode; this.dirty = true; }
  }

  setSkin(skin) {
    if (skin !== this.skin) { this.skin = skin; this.dirty = true; }
  }

  color(b, k) { return themeColor(this.theme, this.custom, b, k); }

  // ---------- Layout ----------

  layout() {
    const W = this.W, H = this.H, M = MODES, g = 12;
    this.spec = null;
    this.meters = null;
    this.scope = null;
    if (this.mode === M.COMBO) {
      // ein Instrument mit Doppelzeiger L/R links, Spektrum rechts
      const mh = H * VU_HEIGHT, mw = Math.min(W * 0.45, mh * 1.1);
      this.meters = [this.fitMeter(g, 0, mw, H, mh, 'LR')];
      const lw = mw + 2 * g;
      this.spec = this.specLayout({ x: lw, y: 0, w: W - lw, h: H });
    } else if (this.mode === M.VU) {
      const mw = (W - 3 * g) / 2, mh = H * VU_HEIGHT;
      this.meters = [this.fitMeter(g, 0, mw, H, mh, 'L'), this.fitMeter(2 * g + mw, 0, mw, H, mh, 'R')];
    } else if (this.mode === M.LED) {
      this.led = this.ledLayout();
    } else if (this.mode === M.CLOCK) {
      this.clk = this.clockLayout();
    } else if (this.mode === M.OSC || this.mode === M.GONIO) {
      this.scope = this.scopeLayout();
    } else {
      this.spec = this.specLayout({ x: 0, y: 0, w: W, h: H });
    }
  }

  specLayout(r) {
    const padX = 12, top = 14, lab = 28;
    const gh = r.h - top - lab, cw = (r.w - padX * 2) / NB, sh = gh / SEGS;
    const L = { x: r.x + padX, y: r.y + top, gh, cw, bw: cw * 0.72, sh, sg: sh * 0.62, bottom: r.y + r.h };
    const half = SEGS / 2, wave = this.mode === MODES.WAVE;
    L.colors = [];
    for (let b = 0; b < NB; b++) {
      const row = [];
      for (let s = 0; s < SEGS; s++) {
        // Welle: Farbe nach Abstand von der Mitte, sonst nach Höhe
        const k = wave ? Math.floor(Math.abs(s - (SEGS - 1) / 2)) / (half - 1) : s / (SEGS - 1);
        row.push(this.color(b, k));
      }
      L.colors.push(row);
    }
    return L;
  }

  // s = 0 unten .. SEGS-1 oben
  segRect(L, b, s) {
    return [L.x + b * L.cw + (L.cw - L.bw) / 2, L.y + L.gh - (s + 1) * L.sh + (L.sh - L.sg) / 2, L.bw, L.sg];
  }

  // Instrument mit Höhe mh, höchstens w breit, im Bereich (x, y, w, h) zentriert
  fitMeter(x, y, w, h, mh, name) {
    const mw = Math.min(w, mh * 1.5);
    const mx = x + (w - mw) / 2, my = y + (h - mh) / 2;
    const f = Math.min(mw, mh) / 280, s = Math.sin(VU_ARC);
    // Radius: Skala samt Beschriftung muss in Breite und Höhe passen
    const py = my + mh * 0.8;
    const R = Math.min((mw / 2 - 16 * f) / s - 22 * f, py - my - 40 * f);
    return { x: mx, y: my, w: mw, h: mh, name, px: mx + mw / 2, py, R, f, rc: Math.max(12 * f, R * 0.11) };
  }

  ledLayout() {
    const W = this.W, H = this.H, x0 = 44, x1 = W - 18;
    const sh = Math.min(64, H * 0.16), sw = (x1 - x0) / LED_SEGS;
    const rows = [H * 0.5 - sh * 1.6, H * 0.5 + sh * 0.3];
    const colors = [];
    for (let i = 0; i < LED_SEGS; i++) colors.push(this.color(Math.round(i / (LED_SEGS - 1) * (NB - 1)), i / (LED_SEGS - 1)));
    return { x0, x1, sw, sh, rows, colors };
  }

  ledRect(Ld, row, i) { return [Ld.x0 + i * Ld.sw + 1, Ld.rows[row], Ld.sw * 0.72, Ld.sh]; }

  clockLayout() {
    // HH:MM groß, Sekunden klein rechts unten
    const W = this.W, H = this.H;
    let dh = Math.min(H * 0.62, 400);
    const unitW = h => { const dw = h * 0.52, g = h * 0.14; return 4 * dw + 6 * g + h * 0.22 + 2 * dw * 0.42 + g * 0.4; };
    if (unitW(dh) > W * 0.9) dh = dh * (W * 0.9) / unitW(dh);
    const dw = dh * 0.52, g = dh * 0.14, cw = dh * 0.22, total = unitW(dh);
    let x = (W - total) / 2;
    const y = (H - dh) / 2, cells = [];
    const digit = (h, w, yy) => { cells.push({ x, y: yy, w, h }); x += w; };
    digit(dh, dw, y); x += g; digit(dh, dw, y); x += g;
    const colon = { x, y, w: cw, h: dh }; x += cw + g;
    digit(dh, dw, y); x += g; digit(dh, dw, y); x += 2 * g;
    const sh = dh * 0.42, sw = dw * 0.42;
    digit(sh, sw, y + dh - sh); x += g * 0.4; digit(sh, sw, y + dh - sh);
    const colors = cells.map((c, i) => this.color(Math.round(i / (cells.length - 1) * (NB - 1)), 0.5));
    return { cells, colon, colors };
  }

  scopeLayout() {
    const W = this.W, H = this.H, pad = 16;
    if (this.mode === MODES.OSC) {
      const r = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
      // Farbverlauf entlang der Zeitachse (Bunt, Glut), sonst einfarbig
      const grad = this.ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, this.color(Math.round(i / 8 * (NB - 1)), this.theme === 2 ? 0.3 : i / 8));
      return { ...r, stroke: grad };
    }
    const size = Math.min(W, H) - 2 * pad;
    return { x: (W - size) / 2, y: (H - size) / 2, w: size, h: size, stroke: this.color(Math.round(NB / 2), 0.3) };
  }

  // ---------- Hintergrund (statisch) ----------

  buildBg() {
    this.layout();
    const c = this.bg.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    if (this.spec) {
      if (this.mode !== MODES.FALL) this.bgSegs(c, this.spec);
      this.bgLabels(c, this.spec);
    }
    if (this.meters) this.meters.forEach(m => this.bgMeter(c, m));
    if (this.mode === MODES.LED) this.bgLed(c, this.led);
    if (this.mode === MODES.CLOCK) this.bgClock(c, this.clk);
    if (this.mode === MODES.OSC) this.bgOsc(c, this.scope);
    if (this.mode === MODES.GONIO) this.bgGonio(c, this.scope);
    // Leuchtspur beim Moduswechsel löschen
    const l = this.lit.getContext('2d');
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, this.lit.width, this.lit.height);
    this.dirty = false;
    this.lastKey = null;
  }

  bgSegs(c, L) {
    c.globalAlpha = UNLIT_ALPHA;
    for (let b = 0; b < NB; b++) {
      for (let s = 0; s < SEGS; s++) { c.fillStyle = L.colors[b][s]; c.fillRect(...this.segRect(L, b, s)); }
    }
    c.globalAlpha = 1;
  }

  bgLabels(c, L) {
    c.font = '20px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = LABEL_COLOR;
    for (const i in LABELS) c.fillText(LABELS[i], L.x + i * L.cw + L.cw / 2, L.bottom - 6);
  }

  vuAngle(pos) { return -VU_ARC + 2 * VU_ARC * pos; }
  vuPoint(m, a, r) { return [m.px + r * Math.sin(a), m.py - r * Math.cos(a)]; }

  meterPath(c, m) {
    c.beginPath();
    c.roundRect ? c.roundRect(m.x, m.y, m.w, m.h, 6) : c.rect(m.x, m.y, m.w, m.h);
  }

  bgMeter(c, m) {
    const fc = this.skin === SKINS.WOOD ? FACE_WOOD : this.theme === 6 ? this.custom : FACES[this.theme], f = m.f;
    c.save();
    this.meterPath(c, m);
    c.clip();
    // hinterleuchtete Skala
    const g = c.createRadialGradient(m.px, m.py - m.R * 0.35, 5, m.px, m.py - m.R * 0.5, Math.max(m.w, m.h) * 0.75);
    g.addColorStop(0, mix(fc, '#ffffff', 0.35));
    g.addColorStop(1, mix(fc, '#2a1a08', 0.5));
    c.fillStyle = g;
    c.fillRect(m.x, m.y, m.w, m.h);
    const a0 = -Math.PI / 2 - VU_ARC, a1 = -Math.PI / 2 + VU_ARC;
    c.strokeStyle = VU_INK;
    c.lineWidth = 1.4 * f;
    c.beginPath(); c.arc(m.px, m.py, m.R, a0, a1); c.stroke();
    // roter Bereich ab 0 VU
    c.strokeStyle = VU_RED;
    c.lineWidth = 5 * f;
    c.beginPath(); c.arc(m.px, m.py, m.R + 3 * f, a0 + 2 * VU_ARC * (1 / VU_FULL), a1); c.stroke();
    c.font = Math.round(18 * f) + 'px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const db of VU_TICKS) {
      const a = this.vuAngle(Math.pow(10, db / 20) / VU_FULL);
      const [x1, y1] = this.vuPoint(m, a, m.R), [x2, y2] = this.vuPoint(m, a, m.R + (db === 0 ? 11 : 8) * f);
      c.strokeStyle = db > 0 ? VU_RED : VU_INK;
      c.lineWidth = (db === 0 ? 2 : 1.2) * f;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      if (VU_TEXT.includes(db)) {
        const [lx, ly] = this.vuPoint(m, a, m.R + 21 * f);
        c.fillStyle = db > 0 ? VU_RED : VU_INK;
        c.fillText(db > 0 ? '+' + db : String(Math.abs(db)), lx, ly);
      }
    }
    // Prozentskala innen, wie bei echten VU-Metern
    c.font = Math.round(13 * f) + 'px ' + FONT;
    c.fillStyle = VU_INK;
    c.globalAlpha = 0.7;
    for (const p of [0, 20, 40, 60, 80, 100]) {
      const [lx, ly] = this.vuPoint(m, this.vuAngle(p / 100 / VU_FULL), m.R - 13 * f);
      c.fillText(String(p), lx, ly);
    }
    c.globalAlpha = 1;
    c.font = Math.round(30 * f) + 'px ' + FONT;
    c.fillStyle = VU_INK;
    c.fillText('VU', m.px, m.py - m.R * 0.38);
    // Kappe über der Zeigerachse
    c.fillStyle = '#1d1712';
    c.beginPath();
    c.arc(m.px, m.py, m.rc, Math.PI, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 1;
    c.stroke();
    // Kanalbezeichnung unten links (Doppelzeiger: L schwarz, R rot)
    c.font = Math.round(26 * f) + 'px ' + FONT;
    c.textAlign = 'left';
    const bx = m.x + 14 * f, by = m.y + m.h - 18 * f;
    if (m.name === 'LR') {
      c.fillStyle = NEEDLE[0]; c.fillText('L', bx, by);
      c.fillStyle = NEEDLE[1]; c.fillText('R', bx + 18 * f, by);
    } else {
      c.fillStyle = VU_INK; c.fillText(m.name, bx, by);
    }
    c.restore();
    c.strokeStyle = '#000';
    c.lineWidth = 3;
    this.meterPath(c, m);
    c.stroke();
  }

  bgLed(c, Ld) {
    c.globalAlpha = UNLIT_ALPHA;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < LED_SEGS; i++) { c.fillStyle = Ld.colors[i]; c.fillRect(...this.ledRect(Ld, r, i)); }
    }
    c.globalAlpha = 1;
    c.fillStyle = LABEL_COLOR;
    c.font = Math.round(Math.min(40, Ld.sh * 0.8)) + 'px ' + FONT;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    ['L', 'R'].forEach((n, r) => c.fillText(n, 12, Ld.rows[r] + Ld.sh / 2));
    // dB-Skala unter den Balken
    const y = Ld.rows[1] + Ld.sh + 30, span = Ld.x1 - Ld.x0;
    c.font = '22px ' + FONT;
    c.textAlign = 'center';
    c.strokeStyle = LABEL_COLOR;
    c.lineWidth = 1;
    for (const db of LED_TEXT) {
      const x = Ld.x0 + ledPos(db) * span;
      c.fillStyle = db > 0 ? '#c8463e' : LABEL_COLOR;
      c.fillText(db > 0 ? '+' + db : String(db), x, y);
      c.beginPath(); c.moveTo(x, Ld.rows[1] + Ld.sh + 6); c.lineTo(x, Ld.rows[1] + Ld.sh + 14); c.stroke();
    }
    c.fillStyle = LABEL_COLOR;
    c.fillText('VU', Ld.x1 - 10, Ld.rows[0] - 22);
  }

  bgClock(c, K) {
    c.globalAlpha = UNLIT_ALPHA;
    K.cells.forEach((cell, i) => { c.fillStyle = K.colors[i]; this.digit(c, cell, 'abcdefg'); });
    c.fillStyle = K.colors[1];
    this.colon(c, K.colon);
    c.globalAlpha = 1;
  }

  // Raster wie auf einem Oszilloskop-Schirm: 10 x 8 Teilungen
  bgOsc(c, S) {
    const col = this.color(Math.round(NB / 2), 0.3), cx = S.x + S.w / 2, cy = S.y + S.h / 2;
    c.strokeStyle = col;
    c.lineWidth = 1;
    c.globalAlpha = 0.13;
    c.beginPath();
    for (let i = 0; i <= 10; i++) { const x = S.x + i * S.w / 10; c.moveTo(x, S.y); c.lineTo(x, S.y + S.h); }
    for (let i = 0; i <= 8; i++) { const y = S.y + i * S.h / 8; c.moveTo(S.x, y); c.lineTo(S.x + S.w, y); }
    c.stroke();
    // Feinteilung auf den Mittelachsen
    c.globalAlpha = 0.3;
    c.beginPath();
    c.moveTo(S.x, cy); c.lineTo(S.x + S.w, cy); c.moveTo(cx, S.y); c.lineTo(cx, S.y + S.h);
    for (let i = 0; i <= 50; i++) { const x = S.x + i * S.w / 50; c.moveTo(x, cy - 4); c.lineTo(x, cy + 4); }
    for (let i = 0; i <= 40; i++) { const y = S.y + i * S.h / 40; c.moveTo(cx - 4, y); c.lineTo(cx + 4, y); }
    c.stroke();
    c.globalAlpha = 1;
  }

  // Goniometer: Kreis, Achsen M (Mono), S (Seite), L und R unter 45°
  bgGonio(c, S) {
    const col = this.color(Math.round(NB / 2), 0.3), cx = S.x + S.w / 2, cy = S.y + S.h / 2, r = S.w / 2;
    const d = r * Math.SQRT1_2;
    c.strokeStyle = col;
    c.lineWidth = 1;
    c.globalAlpha = 0.14;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.moveTo(cx + r * 0.5, cy); c.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.28;
    c.beginPath();
    c.moveTo(cx, cy - r); c.lineTo(cx, cy + r);
    c.moveTo(cx - r, cy); c.lineTo(cx + r, cy);
    c.moveTo(cx - d, cy - d); c.lineTo(cx + d, cy + d);
    c.moveTo(cx + d, cy - d); c.lineTo(cx - d, cy + d);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = LABEL_COLOR;
    c.font = '24px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const t = r + 4;
    c.fillText('M', cx, cy - r + 14);
    c.fillText('L', cx - d * 1.04 - 8, cy - d * 1.04 - 8);
    c.fillText('R', cx + d * 1.04 + 8, cy - d * 1.04 - 8);
    c.fillText('+S', cx - t - 16, cy);
    c.fillText('-S', cx + t + 16, cy);
  }

  // 7-Segment-Ziffer, Segmente als Sechsecke
  digit(c, r, segs) {
    const t = r.w * 0.19, g = t * 0.16;
    const xl = r.x + t / 2, xr = r.x + r.w - t / 2, yt = r.y + t / 2, ym = r.y + r.h / 2, yb = r.y + r.h - t / 2;
    const hseg = (x0, x1, y) => {
      c.beginPath();
      c.moveTo(x0, y); c.lineTo(x0 + t / 2, y - t / 2); c.lineTo(x1 - t / 2, y - t / 2);
      c.lineTo(x1, y); c.lineTo(x1 - t / 2, y + t / 2); c.lineTo(x0 + t / 2, y + t / 2);
      c.closePath(); c.fill();
    };
    const vseg = (x, y0, y1) => {
      c.beginPath();
      c.moveTo(x, y0); c.lineTo(x + t / 2, y0 + t / 2); c.lineTo(x + t / 2, y1 - t / 2);
      c.lineTo(x, y1); c.lineTo(x - t / 2, y1 - t / 2); c.lineTo(x - t / 2, y0 + t / 2);
      c.closePath(); c.fill();
    };
    for (const s of segs) {
      if (s === 'a') hseg(xl + g, xr - g, yt);
      else if (s === 'g') hseg(xl + g, xr - g, ym);
      else if (s === 'd') hseg(xl + g, xr - g, yb);
      else if (s === 'f') vseg(xl, yt + g, ym - g);
      else if (s === 'b') vseg(xr, yt + g, ym - g);
      else if (s === 'e') vseg(xl, ym + g, yb - g);
      else if (s === 'c') vseg(xr, ym + g, yb - g);
    }
  }

  colon(c, r) {
    const s = r.w * 0.6, x = r.x + (r.w - s) / 2;
    c.fillRect(x, r.y + r.h * 0.3 - s / 2, s, s);
    c.fillRect(x, r.y + r.h * 0.7 - s / 2, s, s);
  }

  // ---------- pro Frame ----------

  // d: { lv, pk, vu: [posL, posR], led, ledPk, wl, wr, amp, dt, now }, lv = null wenn kein Eingang
  draw(d) {
    if (this.dirty) this.buildBg();
    const M = MODES;
    if (this.mode === M.CLOCK) {
      // nur neu zeichnen, wenn sich die Anzeige ändert
      const t = d.now, blink = t.getMilliseconds() < 500;
      const key = pad2(t.getHours()) + pad2(t.getMinutes()) + pad2(t.getSeconds()) + (blink ? ':' : ' ');
      if (key === this.lastKey) return;
      this.lastKey = key;
    }
    const c = this.lit.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let lit = false;
    if (this.scope) {
      // Nachleuchten: alte Spur langsam ausblenden statt löschen
      const tau = this.mode === M.OSC ? PERSIST_OSC : PERSIST_GONIO;
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = 'rgba(0,0,0,' + (1 - Math.exp(-d.dt / tau)).toFixed(4) + ')';
      c.fillRect(0, 0, this.W, this.H);
      c.globalCompositeOperation = 'source-over';
      if (d.lv) {
        if (this.mode === M.OSC) this.litOsc(c, this.scope, d);
        else this.litGonio(c, this.scope, d);
      }
      lit = true;
    } else {
      c.clearRect(0, 0, this.W, this.H);
      if (this.mode === M.FALL) {
        if (d.lv) this.feedFall(d.lv, d.dt);
      } else if (this.spec && d.lv) { this.litSpec(c, this.spec, d.lv, d.pk); lit = true; }
      if (this.mode === M.LED && d.lv) { this.litLed(c, this.led, d.led, d.ledPk); lit = true; }
      if (this.mode === M.CLOCK) { this.litClock(c, this.clk, this.lastKey); lit = true; }
    }
    this.compose(lit);
    const m = this.ctx;
    m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mode === M.FALL) this.drawFall(m, this.spec);
    if (this.meters) {
      const mt = this.meters;
      if (mt.length === 1) {
        // Doppelzeiger: R unter L
        this.needle(m, mt[0], d.lv ? d.vu[1] : 0, NEEDLE[1]);
        this.needle(m, mt[0], d.lv ? d.vu[0] : 0, NEEDLE[0]);
      } else {
        mt.forEach((x, i) => this.needle(m, x, d.lv ? d.vu[i] : 0, NEEDLE[0]));
      }
    }
  }

  litSpec(c, L, lv, pk) {
    const mode = this.mode, half = SEGS / 2;
    for (let b = 0; b < NB; b++) {
      const n = Math.round(lv[b] * SEGS), p = Math.min(SEGS - 1, Math.round(pk[b] * SEGS));
      const col = L.colors[b];
      if (mode === MODES.WAVE) {
        // symmetrisch von der Mitte nach oben und unten
        const k = Math.round(lv[b] * half);
        for (let j = 0; j < k; j++) {
          c.fillStyle = col[half + j]; c.fillRect(...this.segRect(L, b, half + j));
          c.fillStyle = col[half - 1 - j]; c.fillRect(...this.segRect(L, b, half - 1 - j));
        }
        continue;
      }
      if (mode === MODES.DOTS) {
        // nur Spitze des aktuellen Pegels und gehaltener Peak
        if (n > 0) { c.fillStyle = col[n - 1]; c.fillRect(...this.segRect(L, b, n - 1)); }
      } else {
        for (let s = 0; s < n; s++) { c.fillStyle = col[s]; c.fillRect(...this.segRect(L, b, s)); }
      }
      if (p >= n && pk[b] > 0.5 / SEGS) { c.fillStyle = col[p]; c.fillRect(...this.segRect(L, b, p)); }
    }
  }

  litLed(c, Ld, v, pk) {
    for (let r = 0; r < 2; r++) {
      const n = Math.round(v[r] * LED_SEGS), p = Math.min(LED_SEGS - 1, Math.round(pk[r] * LED_SEGS));
      for (let i = 0; i < n; i++) { c.fillStyle = Ld.colors[i]; c.fillRect(...this.ledRect(Ld, r, i)); }
      if (p >= n && pk[r] > 0.5 / LED_SEGS) { c.fillStyle = Ld.colors[p]; c.fillRect(...this.ledRect(Ld, r, p)); }
    }
  }

  litClock(c, K, key) {
    K.cells.forEach((cell, i) => { c.fillStyle = K.colors[i]; this.digit(c, cell, DIGITS[key[i]]); });
    if (key[6] === ':') { c.fillStyle = K.colors[1]; this.colon(c, K.colon); }
  }

  // Wellenform (L+R)/2, getriggert auf steigenden Nulldurchgang
  litOsc(c, S, d) {
    const l = d.wl, r = d.wr, n = l.length, win = Math.min(OSC_WINDOW, n >> 1);
    const hyst = 0.02 / d.amp;
    let start = 0;
    for (let i = 1, armed = false; i < n - win; i++) {
      const v = l[i] + r[i];
      if (v < -hyst) armed = true;
      else if (armed && v >= 0 && l[i - 1] + r[i - 1] < 0) { start = i; break; }
    }
    const cy = S.y + S.h / 2, half = S.h / 2, k = d.amp * half * 0.5, dx = S.w / (win - 1);
    c.save();
    c.beginPath(); c.rect(S.x, S.y, S.w, S.h); c.clip();
    c.strokeStyle = S.stroke;
    c.lineWidth = 2.2;
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i < win; i++) {
      const v = (l[start + i] + r[start + i]) * k;
      const x = S.x + i * dx, y = cy - Math.max(-half, Math.min(half, v));
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    c.restore();
  }

  // L/R als XY, um 45° gedreht: Mono senkrecht, L oben links, R oben rechts
  litGonio(c, S, d) {
    const l = d.wl, r = d.wr, n = l.length, cx = S.x + S.w / 2, cy = S.y + S.h / 2, rad = S.w / 2;
    const k = d.amp * rad * 0.5 * Math.SQRT1_2;
    c.save();
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.clip();
    c.strokeStyle = S.stroke;
    c.lineWidth = 1.3;
    c.globalAlpha = 0.55;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = cx + (r[i] - l[i]) * k, y = cy - (l[i] + r[i]) * k;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    c.restore();
  }

  // Wasserfall: neue Zeilen oben einfügen (Ringpuffer)
  feedFall(lv, dt) {
    this.fallAcc += dt * FALL_RATE;
    if (this.fallAcc < 1) return;
    const f = this.fall.getContext('2d');
    while (this.fallAcc >= 1) {
      this.fallAcc -= 1;
      this.fallHead = (this.fallHead + FALL_ROWS - 1) % FALL_ROWS;
      f.clearRect(0, this.fallHead, NB, 1);
      for (let b = 0; b < NB; b++) {
        const v = lv[b];
        if (v <= 0.02) continue;
        f.globalAlpha = Math.min(1, Math.pow(v * 1.1, 1.4));
        f.fillStyle = this.color(b, v);
        f.fillRect(b, this.fallHead, 1, 1);
      }
    }
    f.globalAlpha = 1;
  }

  drawFall(m, L) {
    const x = L.x, y = L.y, w = NB * L.cw, h = L.gh, rowH = h / FALL_ROWS, head = this.fallHead;
    const top = FALL_ROWS - head;
    m.imageSmoothingEnabled = true;
    m.drawImage(this.fall, 0, head, NB, top, x, y, w, top * rowH);
    if (head > 0) m.drawImage(this.fall, 0, 0, NB, head, x, y + top * rowH, w, head * rowH);
  }

  needle(m, mt, pos, color) {
    const a = this.vuAngle(Math.max(-0.02, Math.min(1.06, pos)));
    const [nx, ny] = this.vuPoint(mt, a, mt.R + 12 * mt.f);
    const [bx, by] = this.vuPoint(mt, a, mt.rc);
    m.save();
    this.meterPath(m, mt);
    m.clip();
    m.lineCap = 'round';
    // Schatten des Zeigers auf der Skala
    m.strokeStyle = 'rgba(0,0,0,0.22)';
    m.lineWidth = 2.4 * mt.f;
    m.beginPath(); m.moveTo(bx + 4 * mt.f, by + 3 * mt.f); m.lineTo(nx + 4 * mt.f, ny + 3 * mt.f); m.stroke();
    m.strokeStyle = color;
    m.lineWidth = 1.8 * mt.f;
    m.beginPath(); m.moveTo(bx, by); m.lineTo(nx, ny); m.stroke();
    m.restore();
  }

  compose(lit) {
    const m = this.ctx, pw = this.cv.width, ph = this.cv.height;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.globalAlpha = 1;
    m.clearRect(0, 0, pw, ph);
    m.drawImage(this.bg, 0, 0);
    if (!lit) return;
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
