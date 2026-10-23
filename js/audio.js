// Audio-Eingang, 31 Terzbänder, Pegel L/R

// ISO-Terzmitten 20 Hz .. 20 kHz
export const BAND_FC = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
export const NB = BAND_FC.length;

const FFT = 8192;
const TD = 2048;
const THIRD = Math.pow(2, 1 / 6);

export class AudioInput {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.running = false;
    this.mono = true;
    this.label = '';
    this.onstop = null;
    this.bandDb = new Float32Array(NB).fill(-120);
    this.level = { l: 0, r: 0 }; // RMS linear
  }

  async start(deviceId) {
    this.stop();
    const audio = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 }
    };
    if (deviceId) audio.deviceId = { exact: deviceId };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (e) {
      // gespeicherte Quelle nicht mehr vorhanden: Standard nehmen
      if (deviceId && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        delete audio.deviceId;
        stream = await navigator.mediaDevices.getUserMedia({ audio });
      } else throw e;
    }
    this.stream = stream;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.ctx.onstatechange = () => {
        if (this.running && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      };
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();

    const ctx = this.ctx;
    this.src = ctx.createMediaStreamSource(stream);
    this.an = ctx.createAnalyser();
    this.an.fftSize = FFT;
    this.an.smoothingTimeConstant = 0;
    this.an.minDecibels = -140;
    this.an.maxDecibels = 0;
    this.split = ctx.createChannelSplitter(2);
    this.anL = ctx.createAnalyser();
    this.anR = ctx.createAnalyser();
    this.anL.fftSize = this.anR.fftSize = TD;
    this.src.connect(this.an);
    this.src.connect(this.split);
    this.split.connect(this.anL, 0);
    this.split.connect(this.anR, 1);

    this.fbuf = new Float32Array(this.an.frequencyBinCount);
    this.tL = new Float32Array(TD);
    this.tR = new Float32Array(TD);
    this.buildBands(ctx.sampleRate);

    const track = stream.getAudioTracks()[0];
    const st = track.getSettings ? track.getSettings() : {};
    this.mono = st.channelCount ? st.channelCount < 2 : true;
    this.monoKnown = !!st.channelCount;
    this.label = track.label || '';
    this.deviceId = st.deviceId || deviceId || '';
    track.onended = () => { this.stop(); if (this.onstop) this.onstop(); };
    this.running = true;
  }

  stop() {
    this.running = false;
    if (this.src) { try { this.src.disconnect(); this.split.disconnect(); } catch (e) {} }
    if (this.stream) this.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    this.stream = this.src = null;
  }

  get sampleRate() { return this.ctx ? this.ctx.sampleRate : 0; }

  buildBands(sr) {
    const hz = sr / FFT, last = FFT / 2 - 1;
    this.bands = BAND_FC.map(fc => {
      const lo = fc / THIRD, hi = Math.min(fc * THIRD, sr / 2);
      const k0 = Math.ceil(lo / hz), k1 = Math.min(last, Math.floor(hi / hz));
      // Band schmaler als ein Bin: Leistung an der Mittenfrequenz interpolieren
      return k1 >= k0 ? { k0, k1 } : { f: fc / hz, w: (hi - lo) / hz };
    });
  }

  // Aktualisiert bandDb (dB, Leistung je Terzband) und level
  update() {
    if (!this.running) return false;
    const f = this.fbuf;
    this.an.getFloatFrequencyData(f);
    for (let b = 0; b < NB; b++) {
      const d = this.bands[b];
      let p = 0;
      if (d.k0 !== undefined) {
        for (let k = d.k0; k <= d.k1; k++) p += Math.pow(10, f[k] / 10);
      } else {
        const k = Math.floor(d.f), t = d.f - k;
        p = ((1 - t) * Math.pow(10, f[k] / 10) + t * Math.pow(10, f[k + 1] / 10)) * d.w;
      }
      this.bandDb[b] = p > 1e-14 ? 10 * Math.log10(p) : -140;
    }

    this.anL.getFloatTimeDomainData(this.tL);
    this.anR.getFloatTimeDomainData(this.tR);
    let sl = 0, sr = 0;
    for (let i = 0; i < TD; i++) { sl += this.tL[i] * this.tL[i]; sr += this.tR[i] * this.tR[i]; }
    const l = Math.sqrt(sl / TD);
    let r = Math.sqrt(sr / TD);
    // Kanalzahl unbekannt (Safari): rechter Kanal exakt still bei Signal links = Mono
    if (!this.monoKnown && l > 1e-4) { this.mono = r === 0; }
    if (this.mono) r = l;
    this.level.l = l;
    this.level.r = r;
    return true;
  }
}

export async function listInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
}
