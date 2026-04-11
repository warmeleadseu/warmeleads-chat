const STORAGE_KEY = 'warmeleads-sound-enabled';

class AudioManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean;

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

  // ── Small sale: bright 2-note ding ───────────────────────────────────
  playSmallSale() {
    const ac = this.ensureContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.25;
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Note 1: A5 (880 Hz)
    const o1 = ac.createOscillator();
    const g1 = ac.createGain();
    o1.type = 'sine';
    o1.frequency.value = 880;
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.7, now + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o1.connect(g1); g1.connect(master);
    o1.start(now); o1.stop(now + 0.4);

    // Note 2: E6 (1318 Hz) slightly delayed
    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = 'sine';
    o2.frequency.value = 1318.5;
    const t2 = now + 0.08;
    g2.gain.setValueAtTime(0, t2);
    g2.gain.linearRampToValueAtTime(0.6, t2 + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.4);
    o2.connect(g2); g2.connect(master);
    o2.start(t2); o2.stop(t2 + 0.45);

    // Shimmer overtone
    const o3 = ac.createOscillator();
    const g3 = ac.createGain();
    o3.type = 'sine';
    o3.frequency.value = 2637;
    g3.gain.setValueAtTime(0, t2);
    g3.gain.linearRampToValueAtTime(0.15, t2 + 0.01);
    g3.gain.exponentialRampToValueAtTime(0.001, t2 + 0.3);
    o3.connect(g3); g3.connect(master);
    o3.start(t2); o3.stop(t2 + 0.35);
  }

  // ── Big sale: enhanced ka-ching ──────────────────────────────────────
  playBigSale() {
    const ac = this.ensureContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.3;
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Low-end body thump
    const body = ac.createOscillator();
    const bg = ac.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(220, now);
    body.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    bg.gain.setValueAtTime(0.6, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    body.connect(bg); bg.connect(master);
    body.start(now); body.stop(now + 0.25);

    // Cash register noise burst (highpass filtered)
    const bufSize = Math.floor(ac.sampleRate * 0.03);
    const noiseBuf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2000;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(1, now);
    ng.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    noise.connect(hp); hp.connect(ng); ng.connect(master);
    noise.start(now); noise.stop(now + 0.04);

    // Metallic ding – stacked oscillators with bandpass
    const ct = now + 0.08;
    [3520, 4698, 5274].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const bp = ac.createBiquadFilter();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 8;
      g.gain.setValueAtTime(0, ct);
      g.gain.linearRampToValueAtTime(0.8, ct + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.7);
      osc.connect(bp); bp.connect(g); g.connect(master);
      osc.start(ct); osc.stop(ct + 0.75);
    });

    // Coin sparkle – 4 rapid micro-tones
    [6000, 7500, 9000, 10500].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const t = ct + i * 0.035;
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 0.12);
    });

    // Extended shimmer tail
    const shimmer = ac.createOscillator();
    const sg = ac.createGain();
    shimmer.type = 'sine'; shimmer.frequency.value = 8000;
    shimmer.frequency.linearRampToValueAtTime(12000, ct + 0.8);
    sg.gain.setValueAtTime(0, ct + 0.2);
    sg.gain.linearRampToValueAtTime(0.12, ct + 0.3);
    sg.gain.exponentialRampToValueAtTime(0.001, ct + 1.0);
    shimmer.connect(sg); sg.connect(master);
    shimmer.start(ct + 0.2); shimmer.stop(ct + 1.1);
  }

  // ── Batch complete: triumphant ascending chord ───────────────────────
  playBatchComplete() {
    const ac = this.ensureContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.28;
    master.connect(ac.destination);
    const now = ac.currentTime;

    const notes = [
      { freq: 523.25, start: 0,    dur: 0.6 },  // C5
      { freq: 659.25, start: 0.12, dur: 0.55 },  // E5
      { freq: 783.99, start: 0.24, dur: 0.5 },   // G5
      { freq: 1046.5, start: 0.4,  dur: 0.8 },   // C6 (longer, resolution)
    ];

    notes.forEach(n => {
      // Sine base
      const osc1 = ac.createOscillator();
      const g1 = ac.createGain();
      osc1.type = 'sine'; osc1.frequency.value = n.freq;
      const t = now + n.start;
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.6, t + 0.02);
      g1.gain.setValueAtTime(0.55, t + n.dur * 0.6);
      g1.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc1.connect(g1); g1.connect(master);
      osc1.start(t); osc1.stop(t + n.dur + 0.05);

      // Triangle warmth layer
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.type = 'triangle'; osc2.frequency.value = n.freq;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.3, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t + n.dur * 0.8);
      osc2.connect(g2); g2.connect(master);
      osc2.start(t); osc2.stop(t + n.dur);
    });

    // Bright octave ping on the final C6
    const ping = ac.createOscillator();
    const pg = ac.createGain();
    ping.type = 'sine'; ping.frequency.value = 2093;
    const pt = now + 0.42;
    pg.gain.setValueAtTime(0, pt);
    pg.gain.linearRampToValueAtTime(0.2, pt + 0.01);
    pg.gain.exponentialRampToValueAtTime(0.001, pt + 0.5);
    ping.connect(pg); pg.connect(master);
    ping.start(pt); ping.stop(pt + 0.55);
  }

  // ── Target hit: epic fanfare ─────────────────────────────────────────
  playTargetHit() {
    const ac = this.ensureContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.3;
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Timpani hit: low noise burst through lowpass
    const timpBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.15), ac.sampleRate);
    const td = timpBuf.getChannelData(0);
    for (let i = 0; i < td.length; i++) td[i] = Math.random() * 2 - 1;
    const timp = ac.createBufferSource();
    timp.buffer = timpBuf;
    const tlp = ac.createBiquadFilter();
    tlp.type = 'lowpass'; tlp.frequency.value = 200; tlp.Q.value = 3;
    const tg = ac.createGain();
    tg.gain.setValueAtTime(0.8, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    timp.connect(tlp); tlp.connect(tg); tg.connect(master);
    timp.start(now); timp.stop(now + 0.5);

    // Fanfare melody: Da-da-da-DAAA (Bb4 Bb4 Bb4 Eb5)
    const melody = [
      { freq: 466.16, start: 0.05, dur: 0.12 },
      { freq: 466.16, start: 0.2,  dur: 0.12 },
      { freq: 466.16, start: 0.35, dur: 0.12 },
      { freq: 622.25, start: 0.5,  dur: 0.9 },   // resolution – long sustain
    ];

    melody.forEach(n => {
      // Brass-like sawtooth through lowpass
      const osc = ac.createOscillator();
      const lp = ac.createBiquadFilter();
      const g = ac.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = n.freq;
      lp.type = 'lowpass'; lp.frequency.value = n.freq * 3; lp.Q.value = 1;
      const t = now + n.start;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.015);
      g.gain.setValueAtTime(0.45, t + n.dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc.connect(lp); lp.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + n.dur + 0.05);

      // Octave doubling for power
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'sawtooth'; o2.frequency.value = n.freq * 2;
      const lp2 = ac.createBiquadFilter();
      lp2.type = 'lowpass'; lp2.frequency.value = n.freq * 4;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.15, t + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, t + n.dur * 0.8);
      o2.connect(lp2); lp2.connect(g2); g2.connect(master);
      o2.start(t); o2.stop(t + n.dur);
    });

    // Cymbal shimmer: white noise through highpass, long decay
    const cymBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
    const cd = cymBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
    const cym = ac.createBufferSource();
    cym.buffer = cymBuf;
    const chp = ac.createBiquadFilter();
    chp.type = 'highpass'; chp.frequency.value = 6000;
    const cg = ac.createGain();
    const cymStart = now + 0.5;
    cg.gain.setValueAtTime(0, cymStart);
    cg.gain.linearRampToValueAtTime(0.15, cymStart + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.001, cymStart + 1.5);
    cym.connect(chp); chp.connect(cg); cg.connect(master);
    cym.start(cymStart); cym.stop(cymStart + 1.6);
  }

  // ── Milestone: crystal bell arpeggio ─────────────────────────────────
  playMilestone() {
    const ac = this.ensureContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.22;
    master.connect(ac.destination);
    const now = ac.currentTime;

    // Ascending crystal arpeggio: E5 G#5 B5 E6
    const arp = [
      { freq: 659.25, start: 0 },
      { freq: 830.61, start: 0.1 },
      { freq: 987.77, start: 0.2 },
      { freq: 1318.5, start: 0.32 },
    ];

    arp.forEach(n => {
      const t = now + n.start;
      // Fundamental sine
      const o1 = ac.createOscillator();
      const g1 = ac.createGain();
      o1.type = 'sine'; o1.frequency.value = n.freq;
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.5, t + 0.008);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o1.connect(g1); g1.connect(master);
      o1.start(t); o1.stop(t + 0.85);

      // 2nd harmonic
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'sine'; o2.frequency.value = n.freq * 2;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.2, t + 0.008);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o2.connect(g2); g2.connect(master);
      o2.start(t); o2.stop(t + 0.55);

      // 3rd harmonic (bell-like)
      const o3 = ac.createOscillator();
      const g3 = ac.createGain();
      o3.type = 'sine'; o3.frequency.value = n.freq * 3;
      g3.gain.setValueAtTime(0, t);
      g3.gain.linearRampToValueAtTime(0.08, t + 0.008);
      g3.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o3.connect(g3); g3.connect(master);
      o3.start(t); o3.stop(t + 0.4);

      // 5th harmonic (ethereal shimmer)
      const o5 = ac.createOscillator();
      const g5 = ac.createGain();
      o5.type = 'sine'; o5.frequency.value = n.freq * 5;
      g5.gain.setValueAtTime(0, t);
      g5.gain.linearRampToValueAtTime(0.03, t + 0.008);
      g5.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o5.connect(g5); g5.connect(master);
      o5.start(t); o5.stop(t + 0.3);
    });

    // Resolution chord shimmer (E major triad, sustained)
    const chordT = now + 0.45;
    [659.25, 830.61, 987.77].forEach(freq => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, chordT);
      g.gain.linearRampToValueAtTime(0.12, chordT + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.2);
      osc.connect(g); g.connect(master);
      osc.start(chordT); osc.stop(chordT + 1.3);
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
