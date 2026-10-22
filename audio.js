function createMusicBuffer(context) {
  const rate = 22050, step = 60 / 128 / 4;
  const buffer = context.createBuffer(1, Math.round(128 * step * rate), rate);
  const data = buffer.getChannelData(0);
  const melody = [
    [76, 0, 79, 83, 81, 79, 76, 74], [72, 76, 79, 0, 76, 74, 72, 71],
    [69, 72, 76, 79, 76, 72, 71, 72], [71, 75, 78, 81, 78, 75, 71, 0],
    [76, 79, 83, 86, 83, 81, 79, 76], [79, 76, 72, 76, 81, 79, 76, 72],
    [69, 72, 76, 79, 81, 79, 76, 72], [75, 78, 81, 78, 75, 71, 75, 78],
  ];
  const chords = [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]];
  const tone = (note, start, duration, volume, bass = false) => {
    const hz = 440 * 2 ** ((note - 69) / 12), offset = Math.round(start * rate);
    for (let i = 0; i < duration * rate; i++) {
      const t = i / rate, phase = 2 * Math.PI * hz * t;
      const envelope = Math.min(1, t / 0.008) * Math.min(1, (duration - t) / 0.035);
      const wave = Math.sin(phase) + (bass ? 0.15 : 0.3) * Math.sin(phase * 3) + (bass ? 0 : 0.12) * Math.sin(phase * 5);
      data[(offset + i) % data.length] += wave * envelope * volume * Math.exp(-t * (bass ? 3 : 5));
    }
  };
  let seed = 42;
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4];
    for (let beat = 0; beat < 8; beat++) {
      const start = (bar * 16 + beat * 2) * step, note = melody[bar][beat];
      if (note) { tone(note, start, step * 1.75, 0.19); tone(note, start + step * 3, step * 1.75, 0.035); }
      tone(chord[beat % 2 ? 2 : 0] - 12, start, step * 1.5, 0.23, true);
    }
    for (let tick = 0; tick < 16; tick++) {
      const start = (bar * 16 + tick) * step, kick = tick % 4 === 0, snare = tick % 8 === 4;
      tone(chord[tick % 3] + 12, start, step * 0.7, 0.045);
      const offset = Math.round(start * rate), duration = kick ? 0.16 : 0.065;
      for (let i = 0; i < duration * rate && offset + i < data.length; i++) {
        const t = i / rate;
        seed = (1664525 * seed + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        const hat = noise * Math.exp(-t * 90) * (tick % 2 ? 0.025 : 0.045);
        const drum = kick ? Math.sin(2 * Math.PI * (48 * t + 1.5 * (1 - Math.exp(-t * 35)))) * Math.exp(-t * 28) * 0.3 : 0;
        const clap = snare ? noise * Math.exp(-t * 50) * 0.15 : 0;
        data[offset + i] += (hat + drum + clap) * Math.min(1, t / 0.002);
      }
    }
  }
  return buffer;
}

function createLineClearBuffer(context, lines) {
  const rate = 22050, duration = lines === 4 ? 1.3 : 0.2 + lines * 0.14;
  const buffer = context.createBuffer(1, Math.round(duration * rate), rate), data = buffer.getChannelData(0);
  let seed = 127;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1, decay = Math.exp(-t * (14 - lines * 2));
    const boom = Math.sin(2 * Math.PI * (48 * t + 2 * (1 - Math.exp(-t * 30))));
    const zap = Math.sin(2 * Math.PI * (220 * t + 35 * (1 - Math.exp(-t * 12))));
    let signal = (0.15 + lines * 0.07) * (0.9 * boom * decay + 0.8 * noise * Math.exp(-t * 22) + 0.3 * zap * decay);
    if (lines === 4) {
      [76, 80, 83, 88].forEach((note, index) => {
        const local = t - (0.08 + index * 0.11);
        if (local < 0) return;
        const phase = 2 * Math.PI * 440 * 2 ** ((note - 69) / 12) * local;
        signal += (Math.sin(phase) + 0.2 * Math.sin(phase * 3)) * Math.min(1, local / 0.006) * Math.exp(-local * 4.5) * 0.14;
      });
    }
    data[i] = signal * Math.min(1, t / 0.003) * Math.min(1, (duration - t) / 0.04);
  }
  return buffer;
}

function createGameOverBuffer(context) {
  const rate = 22050, duration = 1.8;
  const buffer = context.createBuffer(1, Math.round(duration * rate), rate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    let signal = 0;
    [64, 59, 55, 52, 40].forEach((note, index) => {
      const local = t - index * 0.19;
      if (local < 0) return;
      const phase = 2 * Math.PI * 440 * 2 ** ((note - 69) / 12) * local;
      signal += (Math.sin(phase) + 0.25 * Math.sin(phase * 3)) * Math.min(1, local / 0.008) * Math.exp(-local * 5) * 0.24;
    });
    const bass = Math.sin(2 * Math.PI * (38 * t + 3 * (1 - Math.exp(-t * 12))));
    data[i] = (signal + bass * Math.exp(-t * 6) * Math.min(1, t / 0.008) * 0.22) * Math.min(1, (duration - t) / 0.12);
  }
  return buffer;
}

class AudioTrack {
  constructor(context, buffer, volume, loop = false) {
    this.context = context;
    this.buffer = buffer;
    this.loop = loop;
    this.gain = context.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(context.destination);
    this.source = null;
    this.offset = 0;
    this.paused = false;
  }
  play() {
    if (this.source) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.connect(this.gain);
    this.source = source;
    this.started = this.context.currentTime;
    this.paused = false;
    source.onended = () => {
      source.disconnect();
      if (this.source === source) { this.source = null; this.offset = 0; }
    };
    source.start(0, this.offset);
  }
  pause() {
    if (!this.source) return;
    this.offset = (this.offset + this.context.currentTime - this.started) % this.buffer.duration;
    const source = this.source;
    this.source = null;
    source.stop();
    this.paused = true;
  }
  stop() {
    if (this.source) { const source = this.source; this.source = null; source.stop(); }
    this.offset = 0;
    this.paused = false;
  }
}

class GameAudio {
  constructor(reportError) {
    this.reportError = reportError;
    this.enabled = true;
    this.mode = 'menu';
  }
  activate() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.music = new AudioTrack(this.context, createMusicBuffer(this.context), 0.45, true);
        this.effects = Array.from({ length: 4 }, (_, i) => new AudioTrack(this.context, createLineClearBuffer(this.context, i + 1), 0.85));
        this.over = new AudioTrack(this.context, createGameOverBuffer(this.context), 0.85);
      }
      this.context.resume().then(() => this.sync()).catch(error => this.fail(error));
    } catch (error) { this.fail(error); }
  }
  fail(error) {
    console.error('Audio konnte nicht gestartet werden:', error);
    this.reportError('Audio nicht verfügbar. Prüfe die Audiofreigabe des Browsers.');
  }
  sync() {
    if (!this.music) return;
    if (this.mode === 'play' && this.enabled) this.music.play();
    else this.music.pause();
  }
  start() {
    this.mode = 'play';
    if (this.music) {
      this.music.stop();
      this.over.stop();
      this.effects.forEach(effect => effect.stop());
    }
    this.activate();
  }
  toggle() { this.enabled = !this.enabled; this.activate(); this.sync(); }
  pause() {
    this.mode = 'pause';
    this.sync();
    if (this.effects) this.effects.forEach(effect => effect.pause());
  }
  resume() {
    this.mode = 'play';
    this.activate();
    if (this.effects) this.effects.forEach(effect => { if (effect.paused) effect.play(); });
    this.sync();
  }
  clear(count) {
    if (!this.effects) return;
    this.effects.forEach(effect => effect.stop());
    this.effects[count - 1].play();
  }
  gameOver() {
    this.mode = 'over';
    this.sync();
    if (!this.over) return;
    this.effects.forEach(effect => effect.stop());
    this.over.stop();
    this.over.play();
  }
}

if (typeof module !== 'undefined') module.exports = { createMusicBuffer, createLineClearBuffer, createGameOverBuffer, AudioTrack, GameAudio };
