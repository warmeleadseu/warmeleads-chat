const STORAGE_KEY = 'warmeleads-sound-enabled';

class AudioManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean;
  private reverbBuf: AudioBuffer | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this._enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    } else {
      this._enabled = true;
    }
  }

  get enabled() { return this._enabled; }

  setEnabled(v: boolean) {
    this._enabled = v;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(v));
  }

  toggle() { this.setEnabled(!this._enabled); return this._enabled; }

  ensureContext(): AudioContext | null {
    if (!this._enabled) return null;
    try {
      if (!this.ctx) {
        const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new C();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }

  // Algorithmic reverb impulse response
  private getReverbBuffer(ac: AudioContext): AudioBuffer {
    if (this.reverbBuf && this.reverbBuf.sampleRate === ac.sampleRate) return this.reverbBuf;
    const rate = ac.sampleRate;
    const len = Math.floor(rate * 1.8);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        const decay = Math.exp(-t * 3.5);
        const diffusion = (Math.random() * 2 - 1) * decay;
        const earlyRef = i < rate * 0.08 ? (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 15) : 0;
        d[i] = (diffusion * 0.7 + earlyRef) * 0.4;
      }
    }
    this.reverbBuf = buf;
    return buf;
  }

  private createReverb(ac: AudioContext, wetGain = 0.3): { input: GainNode; output: GainNode } {
    const input = ac.createGain();
    const output = ac.createGain();
    const dry = ac.createGain();
    dry.gain.value = 1;
    const wet = ac.createGain();
    wet.gain.value = wetGain;
    const conv = ac.createConvolver();
    conv.buffer = this.getReverbBuffer(ac);
    input.connect(dry);
    input.connect(conv);
    conv.connect(wet);
    dry.connect(output);
    wet.connect(output);
    return { input, output };
  }

  private noise(ac: AudioContext, duration: number): AudioBufferSourceNode {
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private subBass(ac: AudioContext, dest: AudioNode, time: number, freq = 50, dur = 0.25) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + dur);
    g.gain.setValueAtTime(0.7, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // ── Small sale: coin collect with ascending sparkle ─────────────────
  playSmallSale() {
    const ac = this.ensureContext();
    if (!ac) return;
    const { input: rev, output: revOut } = this.createReverb(ac, 0.25);
    const master = ac.createGain();
    master.gain.value = 0.3;
    revOut.connect(master);
    master.connect(ac.destination);
    const now = ac.currentTime;

    // 5-note ascending arpeggio with stereo sweep
    const notes = [880, 1108.73, 1318.51, 1567.98, 2093];
    notes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.6 + (i / (notes.length - 1)) * 1.2;

      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.45);

      // Harmonic shimmer
      const h = ac.createOscillator();
      const hg = ac.createGain();
      h.type = 'sine';
      h.frequency.value = freq * 3;
      hg.gain.setValueAtTime(0, t);
      hg.gain.linearRampToValueAtTime(0.08, t + 0.006);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      h.connect(hg);
      hg.connect(pan);
      h.start(t);
      h.stop(t + 0.25);
    });

    // Sparkle dust overlay
    for (let i = 0; i < 8; i++) {
      const t = now + 0.1 + i * 0.03;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const pan = ac.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      osc.type = 'sine';
      osc.frequency.value = 4000 + Math.random() * 8000;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  // ── Big sale: slot machine jackpot ─────────────────────────────────
  playBigSale() {
    const ac = this.ensureContext();
    if (!ac) return;
    const { input: rev, output: revOut } = this.createReverb(ac, 0.35);
    const master = ac.createGain();
    master.gain.value = 0.32;
    revOut.connect(master);
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Sub-bass impact
    this.subBass(ac, rev, now, 60, 0.3);

    // Cash register slam (layered noise)
    const slam = this.noise(ac, 0.05);
    const slamHp = ac.createBiquadFilter();
    slamHp.type = 'highpass';
    slamHp.frequency.value = 1500;
    const slamG = ac.createGain();
    slamG.gain.setValueAtTime(0.9, now);
    slamG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    slam.connect(slamHp);
    slamHp.connect(slamG);
    slamG.connect(rev);
    slam.start(now);
    slam.stop(now + 0.06);

    // Metallic ka-ching bell (rich harmonics)
    const bellT = now + 0.06;
    [2637, 3520, 4698, 5274, 6645].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const bp = ac.createBiquadFilter();
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 12;
      g.gain.setValueAtTime(0, bellT);
      g.gain.linearRampToValueAtTime(0.6 - i * 0.08, bellT + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, bellT + 0.8);
      osc.connect(bp);
      bp.connect(g);
      g.connect(rev);
      osc.start(bellT);
      osc.stop(bellT + 0.85);
    });

    // Rapid coin cascade (20 micro-tones sweeping L to R)
    for (let i = 0; i < 20; i++) {
      const t = bellT + 0.05 + i * 0.025;
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.8 + (i / 19) * 1.6;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 5000 + Math.random() * 7000;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2 + Math.random() * 0.15, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06 + Math.random() * 0.04);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    // Crowd cheer (filtered noise swell)
    const cheerT = now + 0.15;
    const cheer = this.noise(ac, 1.5);
    const cheerBp = ac.createBiquadFilter();
    cheerBp.type = 'bandpass';
    cheerBp.frequency.value = 2000;
    cheerBp.Q.value = 0.8;
    const cheerG = ac.createGain();
    cheerG.gain.setValueAtTime(0, cheerT);
    cheerG.gain.linearRampToValueAtTime(0.12, cheerT + 0.2);
    cheerG.gain.setValueAtTime(0.1, cheerT + 0.6);
    cheerG.gain.exponentialRampToValueAtTime(0.001, cheerT + 1.4);
    cheer.connect(cheerBp);
    cheerBp.connect(cheerG);
    cheerG.connect(rev);
    cheer.start(cheerT);
    cheer.stop(cheerT + 1.5);

    // Long shimmer tail with vibrato
    const shimT = bellT + 0.3;
    const shim = ac.createOscillator();
    const shimG = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoG = ac.createGain();
    shim.type = 'sine';
    shim.frequency.value = 8000;
    shim.frequency.linearRampToValueAtTime(12000, shimT + 1.5);
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    lfoG.gain.value = 300;
    lfo.connect(lfoG);
    lfoG.connect(shim.frequency);
    shimG.gain.setValueAtTime(0, shimT);
    shimG.gain.linearRampToValueAtTime(0.08, shimT + 0.1);
    shimG.gain.exponentialRampToValueAtTime(0.001, shimT + 1.5);
    shim.connect(shimG);
    shimG.connect(rev);
    shim.start(shimT);
    shim.stop(shimT + 1.6);
    lfo.start(shimT);
    lfo.stop(shimT + 1.6);
  }

  // ── Batch complete: epic orchestral hit ────────────────────────────
  playBatchComplete() {
    const ac = this.ensureContext();
    if (!ac) return;
    const { input: rev, output: revOut } = this.createReverb(ac, 0.45);
    const master = ac.createGain();
    master.gain.value = 0.32;
    revOut.connect(master);
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Timpani slam
    this.subBass(ac, rev, now, 55, 0.35);
    const timpNoise = this.noise(ac, 0.2);
    const timpLp = ac.createBiquadFilter();
    timpLp.type = 'lowpass';
    timpLp.frequency.value = 250;
    timpLp.Q.value = 4;
    const timpG = ac.createGain();
    timpG.gain.setValueAtTime(0.8, now);
    timpG.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    timpNoise.connect(timpLp);
    timpLp.connect(timpG);
    timpG.connect(rev);
    timpNoise.start(now);
    timpNoise.stop(now + 0.4);

    // Full brass chord: C4 E4 G4 C5 (stacked filtered sawtooths)
    const brassT = now + 0.05;
    const brassFreqs = [261.63, 329.63, 392, 523.25];
    brassFreqs.forEach((freq, i) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.4 + (i / 3) * 0.8;

      [1, 2].forEach(oct => {
        const osc = ac.createOscillator();
        const lp = ac.createBiquadFilter();
        const g = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * oct;
        osc.detune.value = (Math.random() - 0.5) * 10;
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(freq * 4, brassT);
        lp.frequency.exponentialRampToValueAtTime(freq * 2, brassT + 1.0);
        lp.Q.value = 1.5;
        const vol = oct === 1 ? 0.35 : 0.12;
        g.gain.setValueAtTime(0, brassT);
        g.gain.linearRampToValueAtTime(vol, brassT + 0.025);
        g.gain.setValueAtTime(vol * 0.85, brassT + 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, brassT + 1.2);
        osc.connect(lp);
        lp.connect(g);
        g.connect(pan);
        pan.connect(rev);
        osc.start(brassT);
        osc.stop(brassT + 1.3);
      });
    });

    // String sustain layer (triangle waves with vibrato)
    const strT = brassT + 0.1;
    [523.25, 659.25, 783.99].forEach(freq => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const lfo = ac.createOscillator();
      const lfoG = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      lfo.type = 'sine';
      lfo.frequency.value = 5;
      lfoG.gain.value = freq * 0.008;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      g.gain.setValueAtTime(0, strT);
      g.gain.linearRampToValueAtTime(0.15, strT + 0.15);
      g.gain.setValueAtTime(0.12, strT + 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, strT + 1.5);
      osc.connect(g);
      g.connect(rev);
      osc.start(strT);
      osc.stop(strT + 1.6);
      lfo.start(strT);
      lfo.stop(strT + 1.6);
    });

    // Cymbal swell
    const cymT = now + 0.04;
    const cym = this.noise(ac, 2);
    const cymHp = ac.createBiquadFilter();
    cymHp.type = 'highpass';
    cymHp.frequency.value = 5000;
    const cymG = ac.createGain();
    cymG.gain.setValueAtTime(0.5, cymT);
    cymG.gain.linearRampToValueAtTime(0.15, cymT + 0.3);
    cymG.gain.exponentialRampToValueAtTime(0.001, cymT + 1.8);
    cym.connect(cymHp);
    cymHp.connect(cymG);
    cymG.connect(rev);
    cym.start(cymT);
    cym.stop(cymT + 2);

    // Resolution sparkle
    const sparkT = brassT + 0.6;
    for (let i = 0; i < 6; i++) {
      const t = sparkT + i * 0.04;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const pan = ac.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      osc.type = 'sine';
      osc.frequency.value = 3000 + i * 800;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  // ── Target hit: stadium horn triumph ───────────────────────────────
  playTargetHit() {
    const ac = this.ensureContext();
    if (!ac) return;
    const { input: rev, output: revOut } = this.createReverb(ac, 0.4);
    const master = ac.createGain();
    master.gain.value = 0.33;
    revOut.connect(master);
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Sub-bass thunder
    this.subBass(ac, rev, now, 45, 0.4);

    // Snare roll (rapid noise bursts)
    for (let i = 0; i < 12; i++) {
      const t = now + i * 0.035;
      const n = this.noise(ac, 0.04);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3000;
      bp.Q.value = 1;
      const g = ac.createGain();
      const vol = 0.15 + (i / 11) * 0.35;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      n.connect(bp);
      bp.connect(g);
      g.connect(rev);
      n.start(t);
      n.stop(t + 0.04);
    }

    // Stadium horn: stacked detuned sawtooths for fat sound
    const hornT = now + 0.42;
    const hornFreqs = [233.08, 349.23, 466.16]; // Bb3 F4 Bb4

    hornFreqs.forEach((freq, fi) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.3 + fi * 0.3;

      // 3 detuned voices per note for thickness
      [-8, 0, 8].forEach(detune => {
        const osc = ac.createOscillator();
        const lp = ac.createBiquadFilter();
        const g = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(freq * 5, hornT);
        lp.frequency.exponentialRampToValueAtTime(freq * 2.5, hornT + 1.2);
        lp.Q.value = 2;
        g.gain.setValueAtTime(0, hornT);
        g.gain.linearRampToValueAtTime(0.22, hornT + 0.02);
        g.gain.setValueAtTime(0.2, hornT + 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, hornT + 1.3);
        osc.connect(lp);
        lp.connect(g);
        g.connect(pan);
        pan.connect(rev);
        osc.start(hornT);
        osc.stop(hornT + 1.35);
      });
    });

    // Crowd roar (bandpass filtered noise)
    const roarT = hornT;
    const roar = this.noise(ac, 2);
    const roarBp = ac.createBiquadFilter();
    roarBp.type = 'bandpass';
    roarBp.frequency.value = 1500;
    roarBp.Q.value = 0.5;
    const roarG = ac.createGain();
    roarG.gain.setValueAtTime(0, roarT);
    roarG.gain.linearRampToValueAtTime(0.18, roarT + 0.3);
    roarG.gain.setValueAtTime(0.15, roarT + 0.8);
    roarG.gain.exponentialRampToValueAtTime(0.001, roarT + 1.8);
    roar.connect(roarBp);
    roarBp.connect(roarG);
    roarG.connect(rev);
    roar.start(roarT);
    roar.stop(roarT + 2);

    // Cymbal crash
    const cymT = hornT;
    const cym = this.noise(ac, 2);
    const cymHp = ac.createBiquadFilter();
    cymHp.type = 'highpass';
    cymHp.frequency.value = 6000;
    const cymG = ac.createGain();
    cymG.gain.setValueAtTime(0.4, cymT);
    cymG.gain.exponentialRampToValueAtTime(0.001, cymT + 1.8);
    cym.connect(cymHp);
    cymHp.connect(cymG);
    cymG.connect(rev);
    cym.start(cymT);
    cym.stop(cymT + 2);

    // Triumph resolution chord (major triad, wide stereo)
    const chordT = hornT + 0.5;
    [466.16, 587.33, 698.46, 932.33].forEach((freq, i) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.6 + (i / 3) * 1.2;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, chordT);
      g.gain.linearRampToValueAtTime(0.15, chordT + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.5);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(chordT);
      osc.stop(chordT + 1.6);
    });
  }

  // ── Milestone: level-up power-up ───────────────────────────────────
  playMilestone() {
    const ac = this.ensureContext();
    if (!ac) return;
    const { input: rev, output: revOut } = this.createReverb(ac, 0.35);
    const master = ac.createGain();
    master.gain.value = 0.28;
    revOut.connect(master);
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Rapid chromatic run (12 notes in 0.3s)
    const baseFreq = 523.25; // C5
    for (let i = 0; i < 12; i++) {
      const t = now + i * 0.025;
      const freq = baseFreq * Math.pow(2, i / 12);
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.5 + (i / 11) * 1.0;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3 + (i / 11) * 0.2, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15 + (i / 11) * 0.2);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    // Bass drop on resolution
    const dropT = now + 0.3;
    this.subBass(ac, rev, dropT, 65, 0.3);

    // Achievement "ding" - rich bell
    const dingT = now + 0.32;
    [1046.5, 2093, 3139.5, 4186].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const vol = 0.4 / (i + 1);
      g.gain.setValueAtTime(0, dingT);
      g.gain.linearRampToValueAtTime(vol, dingT + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, dingT + 1.0 - i * 0.15);
      osc.connect(g);
      g.connect(rev);
      osc.start(dingT);
      osc.stop(dingT + 1.1);
    });

    // Sparkle cascade (descending then ascending)
    for (let i = 0; i < 16; i++) {
      const t = dingT + 0.05 + i * 0.035;
      const ascending = i >= 8;
      const idx = ascending ? i - 8 : 7 - i;
      const freq = 3000 + idx * 1000;
      const pan = ac.createStereoPanner();
      pan.pan.value = Math.sin(i * 0.8) * 0.8;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    // Power chord sustain (E major)
    const chT = dingT + 0.1;
    [659.25, 830.61, 987.77, 1318.51].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const pan = ac.createStereoPanner();
      pan.pan.value = -0.4 + (i / 3) * 0.8;
      osc.type = i < 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, chT);
      g.gain.linearRampToValueAtTime(0.1, chT + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, chT + 1.3);
      osc.connect(g);
      g.connect(pan);
      pan.connect(rev);
      osc.start(chT);
      osc.stop(chT + 1.4);
    });
  }

  // ── Dispatcher ───────────────────────────────────────────────────────
  playForEvent(type: string, amount?: number) {
    switch (type) {
      case 'sale':
        if (amount && amount >= 1000) this.playBigSale();
        else this.playSmallSale();
        break;
      case 'batch_complete':
        this.playBatchComplete();
        break;
      case 'target_hit':
        this.playTargetHit();
        break;
      case 'milestone':
        this.playMilestone();
        break;
      case 'confetti':
        this.playSmallSale();
        break;
      case 'sales_bell':
        if (amount && amount >= 1000) this.playBigSale();
        else this.playSmallSale();
        break;
      case 'celebration_video':
        this.playBigSale();
        break;
      default:
        this.playSmallSale();
    }
  }
}

export const audioManager = new AudioManager();
