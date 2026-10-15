export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOscillators: OscillatorNode[] = [];
  private engineGains: GainNode[] = [];
  volume: number;

  constructor(volume: number) { this.volume = volume; }

  private init(): AudioContext | null {
    if (this.context) return this.context;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.startEngine();
      return this.context;
    } catch { return null; }
  }

  resume(): void { void this.init()?.resume(); }

  setVolume(value: number): void {
    this.volume = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    localStorage.setItem('steel-volume', String(value));
  }

  private startEngine(): void {
    const c = this.context;
    if (!c || !this.master) return;
    for (const [frequency] of [[47, 0.035], [51, 0.014]] as const) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = frequency;
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.engineOscillators.push(osc); this.engineGains.push(gain);
    }
  }

  updateEngine(throttle: number, speed: number): void {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.engineOscillators.forEach((osc, i) => {
      osc.frequency.setTargetAtTime((i === 0 ? 45 : 50) + speed * 3 + throttle * 9, t, 0.12);
      this.engineGains[i]?.gain.setTargetAtTime((0.018 + Math.abs(throttle) * 0.027) * this.volume, t, 0.2);
    });
  }

  private noise(duration: number, frequency: number, peak: number, type: BiquadFilterType): void {
    const c = this.init(); if (!c || !this.master) return;
    const frames = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = c.createBufferSource(); source.buffer = buffer;
    const filter = c.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency;
    const gain = c.createGain(); gain.gain.setValueAtTime(peak * this.volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master); source.start();
  }

  private tone(start: number, end: number, duration: number, peak: number, wave: OscillatorType = 'sawtooth'): void {
    const c = this.init(); if (!c || !this.master) return;
    const osc = c.createOscillator(); const gain = c.createGain(); osc.type = wave;
    osc.frequency.setValueAtTime(start, c.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), c.currentTime + duration);
    gain.gain.setValueAtTime(peak * this.volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(this.master); osc.start(); osc.stop(c.currentTime + duration + 0.02);
  }

  cannon(): void { this.tone(115, 34, 0.44, 0.52); this.noise(0.23, 480, 0.24, 'lowpass'); }
  impact(): void { this.noise(0.25, 850, 0.36, 'lowpass'); this.tone(83, 35, 0.24, 0.28, 'triangle'); }
  ricochet(): void { this.tone(1100, 260, 0.3, 0.2, 'triangle'); }
  explosion(): void { this.noise(0.8, 260, 0.48, 'lowpass'); this.tone(55, 21, 0.85, 0.33); }
  enginePing(): void { this.tone(320, 200, 0.12, 0.08, 'sine'); }

  dispose(): void {
    this.engineOscillators.forEach(osc => osc.stop());
    this.engineOscillators = []; this.engineGains = [];
    void this.context?.close(); this.context = null;
  }
}
