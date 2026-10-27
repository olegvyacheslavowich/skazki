/**
 * Короткие звуковые эффекты на тапы, синтезированные Web Audio.
 * Имена эффектов используются в tale.json (поле sfx).
 * Короткие эффекты разумно оставить в вебе и в нативной сборке: задержка тут не критична.
 */
type Voice = (ctx: AudioContext, out: AudioNode, t: number) => void;

function blip(ctx: AudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine', level = 0.25) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** шорох бумаги: шум через полосовой фильтр, частота «проезжает» вниз */
function rustle(ctx: AudioContext, out: AudioNode, t: number) {
  const dur = 0.55;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(4200, t);
  bp.frequency.exponentialRampToValueAtTime(1300, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.08);
  g.gain.linearRampToValueAtTime(0.08, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
}

const VOICES: Record<string, Voice> = {
  page: rustle,
  boop: (c, o, t) => blip(c, o, t, 520, 880, 0.18),
  squeak: (c, o, t) => {
    blip(c, o, t, 1800, 2400, 0.08, 'sine', 0.12);
    blip(c, o, t + 0.1, 1900, 2600, 0.08, 'sine', 0.12);
  },
  // «э-эх, ухнем»: два низких натужных тона
  heave: (c, o, t) => {
    blip(c, o, t, 180, 140, 0.45, 'triangle', 0.22);
    blip(c, o, t + 0.75, 190, 130, 0.5, 'triangle', 0.22);
  },
  grow: (c, o, t) => [392, 494, 587, 784].forEach((f, i) => blip(c, o, t + i * 0.11, f, f * 1.02, 0.3, 'triangle', 0.18)),
  tada: (c, o, t) => {
    [523, 659, 784].forEach((f, i) => blip(c, o, t + i * 0.08, f, f, 0.5, 'triangle', 0.16));
    [523, 659, 784, 1046].forEach((f) => blip(c, o, t + 0.32, f, f, 1.1, 'triangle', 0.1));
  },
};

export class Sfx {
  constructor(private readonly ctx: AudioContext) {}

  play(name: string): void {
    const v = VOICES[name];
    if (!v) return console.warn(`Нет звука: ${name}`);
    v(this.ctx, this.ctx.destination, this.ctx.currentTime + 0.01);
  }
}
