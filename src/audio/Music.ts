/**
 * Тихая колыбельная, синтезированная Web Audio — чтобы не тащить mp3 в прототип.
 * Финально заменится на файл музыки (в KMP-плеере или <audio>), интерфейс тот же: start/stop/duck.
 */

const NOTE: Record<string, number> = {
  G3: 196.0, A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25,
};

// [нота | null, длительность в долях]
const MELODY: [string | null, number][] = [
  ['E4', 1], ['G4', 1], ['A4', 2], ['G4', 1], ['E4', 1], ['D4', 2],
  ['C4', 1], ['D4', 1], ['E4', 1], ['G4', 1], ['E4', 3], [null, 1],
  ['E4', 1], ['G4', 1], ['A4', 1], ['C5', 1], ['A4', 2], ['G4', 2],
  ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['C4', 3], [null, 1],
];
const BASS = ['C4', 'A3', 'C4', 'G3', 'C4', 'A3', 'G3', 'C4'];
const BEAT = 0.62; // сек — спокойный темп

const VOLUME = 0.11;
const DUCKED = 0.035;

export class Music {
  private master: GainNode;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private bar = 0;
  private beatsInBar = 0;
  private playing = false;

  constructor(private readonly ctx: AudioContext) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1700;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(lp).connect(ctx.destination);
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(VOLUME, this.ctx.currentTime, 0.8);
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** приглушить на время голоса */
  duck(on: boolean): void {
    if (!this.playing) return;
    this.master.gain.setTargetAtTime(on ? DUCKED : VOLUME, this.ctx.currentTime, 0.25);
  }

  private schedule(): void {
    while (this.nextTime < this.ctx.currentTime + 0.4) {
      const [note, beats] = MELODY[this.step];
      if (note) this.tone(NOTE[note], this.nextTime, beats * BEAT, 'triangle', 0.55);
      if (this.beatsInBar === 0) {
        this.tone(NOTE[BASS[this.bar % BASS.length]] / 2, this.nextTime, BEAT * 4, 'sine', 0.5);
      }
      this.beatsInBar = (this.beatsInBar + beats) % 4;
      if (this.beatsInBar === 0) this.bar++;
      this.nextTime += beats * BEAT;
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, level: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 1);
  }
}
