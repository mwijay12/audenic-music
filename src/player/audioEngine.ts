/**
 * Optimized, Low-Latency Web Audio processing graph.
 *
 * Direct clean path by default:
 *  <audio> ─► source ─► [EQ x5] ─► bassBoost ─► master ─► analyser ─► destination
 *
 * Optional Reverb & Dynamics Compressor nodes are connected ONLY when activated,
 * preventing CPU throttling, audio latency, or voice distortion on mobile devices.
 */

export const EQ_FREQS = [60, 250, 1000, 4000, 12000];

export type EngineState = {
  ready: boolean;
};

import { audioEffectsRack } from "./audioEffects";
import { isNative, setNativeReverb } from "./nativeBridge";

class AudioEngine {
  ctx: AudioContext | null = null;
  source: MediaElementAudioSourceNode | null = null;
  filters: BiquadFilterNode[] = [];
  bass: BiquadFilterNode | null = null;
  dry: GainNode | null = null;
  wet: GainNode | null = null;
  convolver: ConvolverNode | null = null;
  master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  /** Gate between analyser and speakers — set gain=0 on native to prevent echo */
  outputGate: GainNode | null = null;
  private el: HTMLAudioElement | null = null;
  private built = false;

  /** Build the graph once, lazily, on first user gesture. */
  attach(el: HTMLAudioElement) {
    if (this.built && this.el === el) return;
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      if (!this.ctx) this.ctx = new AC({ latencyHint: "playback" });
      const ctx = this.ctx;
      if (this.source) return; // MediaElementSource can only be created once per element

      this.el = el;
      try { if (!el.crossOrigin) el.crossOrigin = "anonymous"; } catch {}
      this.source = ctx.createMediaElementSource(el);

      // ── 5-band parametric EQ ──
      this.filters = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
        b.frequency.value = f;
        b.Q.value = 1.0;
        b.gain.value = 0;
        return b;
      });

      // ── Bass boost (separate low-shelf) ──
      this.bass = ctx.createBiquadFilter();
      this.bass.type = "lowshelf";
      this.bass.frequency.value = 120;
      this.bass.gain.value = 0;

      // ── Master gain & Analyser ──
      this.master = ctx.createGain();
      this.master.gain.value = 1;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      // ── Output gate: muted on native so WebAudio never reaches speakers ──
      this.outputGate = ctx.createGain();
      this.outputGate.gain.value = 1; // default audible; call muteOutput(true) on native

      // ── Wire direct clean path ──
      let node: AudioNode = this.source;
      this.filters.forEach((f) => {
        node.connect(f);
        node = f;
      });
      node.connect(this.bass);
      this.bass.connect(this.master);
      try {
        audioEffectsRack.init(ctx, this.master, this.analyser);
      } catch {
        this.master.connect(this.analyser);
      }
      this.analyser.connect(this.outputGate);
      this.outputGate.connect(ctx.destination);

      this.built = true;
    } catch {
      /* Safari / duplicate-source guard */
    }
  }

  /** Generated impulse response for reverb when enabled */
  private makeImpulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  resume() {
    if (this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Mute/unmute the WebAudio output to speakers. */
  muteOutput(muted: boolean) {
    if (this.outputGate) {
      this.outputGate.gain.value = muted ? 0 : 1;
    }
  }

  private ramp(p: AudioParam | undefined, v: number) {
    if (!p || !this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, 0.03);
    } catch {
      p.value = v;
    }
  }

  /** eq: array of 5 gains in dB (-12..12) */
  setEQ(eq: number[]) {
    this.filters.forEach((f, i) => this.ramp(f.gain, eq[i] ?? 0));
  }

  /** 0..100 → 0..15 dB low shelf */
  setBassBoost(pct: number) {
    this.ramp(this.bass?.gain, (Math.max(0, Math.min(100, pct)) / 100) * 15);
  }

  /** Reverb connected ONLY when percentage > 0 to prevent CPU load */
  setReverb(pct: number) {
    if (isNative()) {
      // On native Android, WebAudio output is muted — route reverb through
      // ExoPlayer's native PresetReverb aux-effect instead.
      setNativeReverb(Math.max(0, Math.min(100, pct)), "hall").catch(() => {});
    }
    if (!this.ctx || !this.bass || !this.master) return;
    const w = Math.max(0, Math.min(100, pct)) / 100;
    if (w <= 0) {
      if (this.convolver && this.wet) {
        try {
          this.bass.disconnect(this.convolver);
          this.wet.disconnect(this.master);
        } catch { /* */ }
      }
      return;
    }
    if (!this.convolver) {
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.makeImpulse(1.8, 2.4);
      this.wet = this.ctx.createGain();
    }
    try {
      this.bass.connect(this.convolver);
      this.convolver.connect(this.wet!);
      this.wet!.connect(this.master);
      this.ramp(this.wet?.gain, w * 0.5);
    } catch { /* already connected */ }
  }

  setVolume(v: number) {
    this.ramp(this.master?.gain, Math.max(0, Math.min(1, v)));
  }

  /** Dynamics compressor connected ONLY when explicitly enabled */
  setLoudnessNormalization(enabled: boolean) {
    if (!this.ctx || !this.master || !this.analyser) return;
    if (!enabled) {
      if (this.compressor) {
        try {
          this.master.disconnect(this.compressor);
          this.compressor.disconnect(this.analyser);
          this.master.connect(this.analyser);
        } catch { /* */ }
      }
      return;
    }
    if (!this.compressor) {
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 3.0;
      this.compressor.attack.value = 0.008;
      this.compressor.release.value = 0.20;
    }
    try {
      this.master.disconnect(this.analyser);
      this.master.connect(this.compressor);
      this.compressor.connect(this.analyser);
    } catch { /* already connected */ }
  }

  setVolumeNow(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  getVolume() {
    return this.master ? this.master.gain.value : 1;
  }

  private fallbackPhase = 0;

  /** Live spectrum data (0..1 per bin) for the visualizer */
  getSpectrum(bins = 28, isPlaying = true): number[] {
    if (!isPlaying) {
      return new Array(bins).fill(0.04);
    }

    if (this.analyser) {
      const raw = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(raw);
      let totalSum = 0;
      for (let i = 0; i < raw.length; i++) totalSum += raw[i];
      if (totalSum > 0) {
        const out: number[] = [];
        const usable = Math.floor(raw.length * 0.85);
        const per = Math.max(1, Math.floor(usable / bins));
        for (let i = 0; i < bins; i++) {
          let sum = 0;
          for (let j = 0; j < per; j++) sum += raw[i * per + j] || 0;
          const tilt = 1.0 + (i / bins) * 0.85;
          const val = Math.min(1, Math.max(0.04, (sum / per / 255) * tilt));
          out.push(val);
        }
        return out;
      }
    }

    // Dynamic procedural audio spectrum generator for native ExoPlayer & CORS-restricted streams
    this.fallbackPhase += 0.045;
    const t = this.fallbackPhase;
    const out: number[] = [];
    const beat = Math.pow(Math.sin(t * 2.2), 4);
    const midPulse = Math.sin(t * 3.4) * 0.3 + 0.55;

    for (let i = 0; i < bins; i++) {
      const norm = i / Math.max(1, bins - 1);
      // Bass boost on low bins
      const bassWeight = Math.max(0, 1 - norm * 2.2) * (0.35 + 0.65 * beat);
      // Mid-range curve
      const midWeight = Math.sin(norm * Math.PI) * (0.2 + 0.45 * midPulse);
      // High-range flutter
      const highWeight = Math.pow(norm, 1.4) * (0.15 + 0.3 * Math.sin(t * 4.6 + i));
      // Organic harmonics
      const ripple = 0.1 * Math.sin(t * 3.6 + i * 0.7) + 0.07 * Math.cos(t * 6.0 + i * 1.3);

      const val = Math.max(0.05, Math.min(0.95, (bassWeight + midWeight + highWeight + ripple) * 0.8));
      out.push(val);
    }
    return out;
  }

  get isReady() {
    return this.built;
  }
}

export const engine = new AudioEngine();

export const EQ_PRESETS: { name: string; eq: number[] }[] = [
  { name: "Flat", eq: [0, 0, 0, 0, 0] },
  { name: "Bass+", eq: [9, 5, 0, -1, -2] },
  { name: "Vocal", eq: [-3, -1, 5, 4, 1] },
  { name: "Treble", eq: [-3, -2, 0, 5, 9] },
  { name: "Acoustic", eq: [4, 2, 1, 2, 4] },
  { name: "Electronic", eq: [7, 3, -2, 2, 6] },
  { name: "Rock", eq: [6, 3, -1, 3, 5] },
  { name: "Jazz", eq: [4, 2, -1, 2, 3] },
  { name: "Podcast", eq: [-4, 0, 6, 4, -2] },
  { name: "Night", eq: [3, 1, 0, -1, -3] },
];
