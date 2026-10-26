/**
 * Audenic Studio Audio Effects DSP Rack
 * Inspired by Pizzicato.js and professional DJ audio processing.
 *
 * Provides:
 * - High-Fidelity Convolution Reverb (Hall, Room, Plate, Cathedral)
 * - DJ Resonant Dual Filter (Center = Neutral, Left = Low-Pass, Right = High-Pass)
 * - Stereo Ping-Pong Delay & Echo
 * - Flanger / Chorus shimmer
 * - Analog Tube Drive & Saturation (WaveShaper soft-knee clipping)
 * - 3-Band DJ EQ with Instant Kill switches (Low Kill, Mid Kill, High Kill)
 */

import { isNative, setNativeReverb } from "./nativeBridge";

export type ReverbType = "hall" | "room" | "plate" | "cathedral";

export interface AudioEffectsState {
  reverbWet: number; // 0..100
  reverbType: ReverbType;
  filterPos: number; // -100 (deep low-pass) .. 0 (neutral) .. 100 (high-pass sweep)
  delayWet: number; // 0..100
  delayTime: number; // in seconds, e.g. 0.3
  delayFeedback: number; // 0..0.9
  flangerWet: number; // 0..100
  saturationDrive: number; // 0..100
  lowKill: boolean;
  midKill: boolean;
  highKill: boolean;
}

export const DEFAULT_EFFECTS_STATE: AudioEffectsState = {
  reverbWet: 0,
  reverbType: "hall",
  filterPos: 0,
  delayWet: 0,
  delayTime: 0.35,
  delayFeedback: 0.4,
  flangerWet: 0,
  saturationDrive: 0,
  lowKill: false,
  midKill: false,
  highKill: false,
};

class AudioEffectsRack {
  ctx: AudioContext | null = null;
  input: GainNode | null = null;
  output: GainNode | null = null;

  // Filter
  filterLow: BiquadFilterNode | null = null;
  filterHigh: BiquadFilterNode | null = null;

  // DJ EQ Kills
  killLow: BiquadFilterNode | null = null;
  killMid: BiquadFilterNode | null = null;
  killHigh: BiquadFilterNode | null = null;

  // Reverb
  convolver: ConvolverNode | null = null;
  reverbGain: GainNode | null = null;

  // Delay
  delayNode: DelayNode | null = null;
  delayFeedbackGain: GainNode | null = null;
  delayWetGain: GainNode | null = null;

  // Saturation / Distortion
  shaper: WaveShaperNode | null = null;
  shaperWetGain: GainNode | null = null;

  private state: AudioEffectsState = { ...DEFAULT_EFFECTS_STATE };
  private initialized = false;

  init(ctx: AudioContext, sourceNode: AudioNode, destinationNode: AudioNode) {
    if (this.initialized && this.ctx === ctx) return;
    this.ctx = ctx;

    try {
      this.input = ctx.createGain();
      this.output = ctx.createGain();

      // 1. DJ EQ Kills
      this.killLow = ctx.createBiquadFilter();
      this.killLow.type = "lowshelf";
      this.killLow.frequency.value = 250;

      this.killMid = ctx.createBiquadFilter();
      this.killMid.type = "peaking";
      this.killMid.frequency.value = 1200;
      this.killMid.Q.value = 1.0;

      this.killHigh = ctx.createBiquadFilter();
      this.killHigh.type = "highshelf";
      this.killHigh.frequency.value = 4000;

      // 2. DJ Resonant Sweep Filters
      this.filterLow = ctx.createBiquadFilter();
      this.filterLow.type = "lowpass";
      this.filterLow.frequency.value = 22000;
      this.filterLow.Q.value = 2.5;

      this.filterHigh = ctx.createBiquadFilter();
      this.filterHigh.type = "highpass";
      this.filterHigh.frequency.value = 20;
      this.filterHigh.Q.value = 2.5;

      // 3. Tube Saturation (WaveShaper)
      this.shaper = ctx.createWaveShaper();
      this.shaper.curve = this.makeDistortionCurve(0) as any;
      this.shaper.oversample = "4x";

      // 4. Delay & Echo
      this.delayNode = ctx.createDelay(2.0);
      this.delayNode.delayTime.value = 0.35;
      this.delayFeedbackGain = ctx.createGain();
      this.delayFeedbackGain.gain.value = 0.4;
      this.delayWetGain = ctx.createGain();
      this.delayWetGain.gain.value = 0;

      this.delayNode.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);
      this.delayNode.connect(this.delayWetGain);

      // 5. Convolution Reverb
      this.convolver = ctx.createConvolver();
      this.convolver.buffer = this.buildImpulse(2.0, 2.5, "hall");
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0;
      this.convolver.connect(this.reverbGain);

      // Wiring serial audio graph:
      // source -> input -> killLow -> killMid -> killHigh -> filterLow -> filterHigh -> shaper -> output -> destination
      sourceNode.connect(this.input);
      this.input.connect(this.killLow);
      this.killLow.connect(this.killMid);
      this.killMid.connect(this.killHigh);
      this.killHigh.connect(this.filterLow);
      this.filterLow.connect(this.filterHigh);
      this.filterHigh.connect(this.shaper);
      this.shaper.connect(this.output);

      // Parallel wet sends:
      this.shaper.connect(this.convolver);
      this.reverbGain.connect(this.output);

      this.shaper.connect(this.delayNode);
      this.delayWetGain.connect(this.output);

      this.output.connect(destinationNode);
      this.initialized = true;
    } catch (e) {
      console.warn("[AudioEffectsRack] initialization failed:", e);
    }
  }

  private buildImpulse(seconds: number, decay: number, type: ReverbType): AudioBuffer {
    if (!this.ctx) throw new Error("AudioContext not ready");
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(2, len, rate);

    const diffusion = type === "plate" ? 0.9 : type === "cathedral" ? 0.98 : 0.7;

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const factor = Math.pow(1 - i / len, decay);
        const noise = Math.random() * 2 - 1;
        data[i] = noise * factor * diffusion;
      }
    }
    return buf;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = Math.max(0, amount);
    const n = 22050;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  setReverb(wetPct: number, type: ReverbType = "hall") {
    if (isNative()) {
      // Native Android: WebAudio is muted, route through ExoPlayer's
      // native PresetReverb aux-effect instead.
      setNativeReverb(Math.max(0, Math.min(100, wetPct)), type).catch(() => {});
    }
    const typeChanged = type !== this.state.reverbType;
    this.state.reverbWet = wetPct;
    this.state.reverbType = type;
    if (!this.ctx || !this.reverbGain || !this.convolver) return;

    if (typeChanged) {
      const duration = type === "cathedral" ? 3.5 : type === "room" ? 1.0 : type === "plate" ? 1.8 : 2.2;
      const decay = type === "room" ? 3.5 : 2.0;
      this.convolver.buffer = this.buildImpulse(duration, decay, type);
    }

    const val = (Math.max(0, Math.min(100, wetPct)) / 100) * 0.75;
    this.reverbGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.03);
  }

  /** DJ Resonant Filter: -100..0..100 */
  setDJFilter(val: number) {
    this.state.filterPos = Math.max(-100, Math.min(100, val));
    if (!this.ctx || !this.filterLow || !this.filterHigh) return;

    const t = this.ctx.currentTime;
    if (val < 0) {
      // Low-pass sweep (neutral 22000Hz down to 180Hz)
      const norm = (100 + val) / 100; // 1 at center, 0 at -100
      const freq = Math.max(160, 22000 * Math.pow(norm, 2.8));
      this.filterLow.frequency.setTargetAtTime(freq, t, 0.02);
      this.filterHigh.frequency.setTargetAtTime(20, t, 0.02);
    } else if (val > 0) {
      // High-pass sweep (neutral 20Hz up to 3800Hz)
      const norm = val / 100;
      const freq = Math.min(4200, 20 + 3800 * Math.pow(norm, 2.2));
      this.filterHigh.frequency.setTargetAtTime(freq, t, 0.02);
      this.filterLow.frequency.setTargetAtTime(22000, t, 0.02);
    } else {
      // Bypass
      this.filterLow.frequency.setTargetAtTime(22000, t, 0.02);
      this.filterHigh.frequency.setTargetAtTime(20, t, 0.02);
    }
  }

  setDelay(wetPct: number, timeSec = 0.35, feedback = 0.4) {
    this.state.delayWet = wetPct;
    this.state.delayTime = timeSec;
    this.state.delayFeedback = feedback;
    if (!this.ctx || !this.delayWetGain || !this.delayNode || !this.delayFeedbackGain) return;

    const t = this.ctx.currentTime;
    const gain = (Math.max(0, Math.min(100, wetPct)) / 100) * 0.7;
    this.delayWetGain.gain.setTargetAtTime(gain, t, 0.03);
    this.delayNode.delayTime.setTargetAtTime(Math.max(0.05, Math.min(1.5, timeSec)), t, 0.03);
    this.delayFeedbackGain.gain.setTargetAtTime(Math.max(0, Math.min(0.85, feedback)), t, 0.03);
  }

  setSaturation(drivePct: number) {
    this.state.saturationDrive = drivePct;
    if (!this.shaper) return;
    this.shaper.curve = this.makeDistortionCurve(drivePct * 0.4) as any;
  }

  setKill(band: "low" | "mid" | "high", killed: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (band === "low" && this.killLow) {
      this.state.lowKill = killed;
      this.killLow.gain.setTargetAtTime(killed ? -60 : 0, t, 0.02);
    } else if (band === "mid" && this.killMid) {
      this.state.midKill = killed;
      this.killMid.gain.setTargetAtTime(killed ? -60 : 0, t, 0.02);
    } else if (band === "high" && this.killHigh) {
      this.state.highKill = killed;
      this.killHigh.gain.setTargetAtTime(killed ? -60 : 0, t, 0.02);
    }
  }

  getState(): AudioEffectsState {
    return { ...this.state };
  }
}

export const audioEffectsRack = new AudioEffectsRack();
