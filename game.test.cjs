const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Board, SHAPES, rotate, AttractDemo, planAI } = require('./engine');
const { createMusicBuffer, createLineClearBuffer, createGameOverBuffer, AudioTrack, GameAudio } = require('./audio');

test('all seven tetracubes contain four distinct integer cells', () => {
  assert.equal(Object.keys(SHAPES).length, 7);
  for (const cells of Object.values(SHAPES)) {
    assert.equal(cells.length, 4);
    assert.equal(new Set(cells.map(String)).size, 4);
    assert.ok(cells.flat().every(Number.isInteger));
  }
});

test('rotations around all three axes are reversible and preserve volume', () => {
  for (const shape of Object.values(SHAPES)) for (const axis of ['x', 'y', 'z']) {
    const clean = cells => cells.map(cell => cell.map(value => value || 0));
    assert.deepEqual(clean(rotate(rotate(shape, axis), axis, -1)), shape);
    let cells = shape;
    for (let turn = 0; turn < 4; turn++) cells = rotate(cells, axis);
    assert.deepEqual(clean(cells), shape);
    assert.equal(new Set(rotate(shape, axis).map(String)).size, 4);
  }
});

test('each bag contains all seven pieces and previews advance in order', () => {
  const board = new Board();
  board.bag = [];
  for (let i = 0; i < 4; i++) assert.equal(new Set(Array.from({ length: 7 }, () => board.pull())).size, 7);
  const first = board.queue[0];
  board.state = 'play'; board.spawn();
  assert.equal(board.current.type, first);
  assert.equal(board.queue.length, 3);
});

test('collision checks X, Z, floor, ceiling and occupied volume', () => {
  const board = new Board();
  assert.equal(board.width, 5);
  assert.equal(board.depth, 5);
  assert.equal(board.height, 12);
  assert.ok(board.layers.every(layer => layer.length === 25));
  const piece = { type: 'O', cells: [[0, 0, 0]], x: 0, y: 0, z: 0 };
  assert.equal(board.fits(piece), true);
  assert.equal(board.fits({ ...piece, x: 4, z: 4 }), true);
  for (const offset of [{ x: -1 }, { x: 5 }, { z: -1 }, { z: 5 }, { y: -1 }, { y: 12 }]) {
    assert.equal(board.fits({ ...piece, ...offset }), false);
  }
  board.layers[0][0] = 'T';
  assert.equal(board.fits(piece), false);
  assert.equal(board.fits({ ...piece, y: 1 }), true);
});

test('movement and rotations respect the well, including the ceiling', () => {
  const board = new Board(); board.start(); board.spawn('I');
  assert.equal(board.turn('z'), true);
  assert.equal(board.fits(board.current), true);
  for (let i = 0; i < 10; i++) board.move(1, 1);
  assert.equal(board.move(1, 0), false);
  assert.equal(board.move(0, 1), false);
  assert.equal(board.fits(board.current), true);
  board.state = 'pause';
  assert.equal(board.move(-1, 0), false);
  assert.equal(board.turn('x'), false);
  assert.equal(board.drop(), null);
});

test('ghost and drop land above obstacles and award exact distance points', () => {
  const board = new Board(); board.start(); board.spawn('O');
  const index = board.current.z * board.width + board.current.x;
  board.layers[3][index] = 'T';
  assert.equal(board.ghost().y, 4);
  const distance = board.current.y - board.ghost().y;
  const result = board.drop();
  assert.equal(board.score, distance * 2);
  assert.equal(result.placed.length, 4);
  assert.equal(board.layers[4][index], 'O');
  assert.equal(board.layers[3][index], 'T');
});

test('a row or an old 4 by 4 footprint does not clear a 5 by 5 plane', () => {
  const board = new Board(); board.start(); board.spawn('I');
  board.current.z = 0;
  const row = board.drop();
  assert.equal(row.count, 0);
  assert.equal(board.layers[0].filter(Boolean).length, 4);
  board.layers[0].fill(null);
  for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) board.layers[0][z * board.width + x] = 'T';
  board.spawn('I');
  assert.equal(board.drop().count, 0);
});

test('one to four complete planes clear atomically with exact scores', () => {
  for (let count = 1; count <= 4; count++) {
    const board = new Board(); board.start(); board.spawn('I'); board.turn('z');
    for (let y = 0; y < count; y++) {
      board.layers[y].fill('T');
      board.layers[y][board.width + 1] = null;
    }
    board.layers[5][0] = 'J';
    board.current.x = 1; board.current.z = 1;
    const distance = board.current.y - board.ghost().y;
    const result = board.drop();
    assert.equal(result.count, count);
    assert.equal(result.removed.length, count * 25);
    assert.equal(board.cleared, count);
    assert.equal(board.score, [0, 100, 300, 500, 800][count] + distance * 2);
    assert.equal(board.layers[5 - count][0], 'J');
    assert.equal(board.layers.length, 12);
    assert.ok(board.layers.slice(-count).every(layer => layer.every(cell => cell === null)));
  }
});

test('nonadjacent full planes collapse without losing intervening blocks', () => {
  const board = new Board(); board.start(); board.spawn('I'); board.turn('z');
  for (const y of [0, 2]) { board.layers[y].fill('T'); board.layers[y][board.width + 1] = null; }
  board.layers[1][0] = 'J'; board.layers[4][0] = 'S';
  board.current.x = 1; board.current.z = 1;
  const result = board.drop();
  assert.equal(result.count, 2);
  assert.equal(board.layers[0][0], 'J');
  assert.equal(board.layers[2][0], 'S');
});

test('hold is limited to once per piece and swapping does not consume the queue', () => {
  const board = new Board(); board.start();
  const initial = board.current.type, next = board.queue[0];
  assert.equal(board.hold(), true);
  assert.equal(board.held, initial);
  assert.equal(board.current.type, next);
  assert.equal(board.hold(), false);
  board.drop();
  const current = board.current.type, queue = [...board.queue];
  assert.equal(board.hold(), true);
  assert.equal(board.current.type, initial);
  assert.equal(board.held, current);
  assert.deepEqual(board.queue, queue);
});

test('spawn collision loses the game, including hold; restart clears everything', () => {
  const board = new Board(); board.start();
  board.layers[11].fill('T');
  assert.equal(board.spawn(), false);
  assert.equal(board.state, 'over');
  assert.equal(board.current, null);
  board.start();
  board.held = 'O';
  board.layers[11].fill('T');
  assert.equal(board.hold(), true);
  assert.equal(board.state, 'over');
  board.start();
  assert.equal(board.score, 0);
  assert.equal(board.cleared, 0);
  assert.equal(board.held, null);
  assert.equal(board.layers.flat().filter(Boolean).length, 0);
  assert.equal(board.state, 'play');
});

test('soft drop awards only successful movement and level increases every ten planes', () => {
  const board = new Board(); board.start(); board.spawn('O');
  board.step(true); assert.equal(board.score, 1);
  board.current = board.ghost();
  board.step(true); assert.equal(board.score, 1);
  board.spawn('O');
  board.layers[0].fill('T');
  for (const [x, , z] of board.cells()) board.layers[0][z * board.width + x] = null;
  board.cleared = 9;
  board.drop();
  assert.equal(board.cleared, 10);
  assert.equal(board.level, 2);
  assert.ok(board.interval < 1100);
});

const audioContext = {
  createBuffer(channels, length, sampleRate) {
    assert.equal(channels, 1);
    const data = new Float32Array(length);
    return { duration: length / sampleRate, getChannelData: () => data };
  },
};
test('all audio is finite, audible, unclipped and has clean boundaries', () => {
  for (const buffer of [createMusicBuffer(audioContext), ...[1, 2, 3, 4].map(n => createLineClearBuffer(audioContext, n)), createGameOverBuffer(audioContext)]) {
    const samples = buffer.getChannelData(0);
    let peak = 0, energy = 0;
    for (const value of samples) {
      assert.ok(Number.isFinite(value));
      peak = Math.max(peak, Math.abs(value)); energy += value ** 2;
    }
    assert.ok(peak > 0.1 && peak < 0.85);
    assert.ok(Math.sqrt(energy / samples.length) > 0.02);
    assert.ok(Math.abs(samples[0] - samples.at(-1)) < 0.03);
  }
});

test('clear effects increase in initial impact and duration; four planes have a fanfare', () => {
  let previousEnergy = 0, previousDuration = 0;
  for (let n = 1; n <= 4; n++) {
    const buffer = createLineClearBuffer(audioContext, n), data = buffer.getChannelData(0);
    const energy = data.slice(0, 2205).reduce((sum, value) => sum + value ** 2, 0);
    assert.ok(energy > previousEnergy && buffer.duration > previousDuration);
    previousEnergy = energy; previousDuration = buffer.duration;
    if (n === 4) assert.ok(data.slice(15435, 22050).reduce((sum, value) => sum + value ** 2, 0) > 1);
  }
});

test('audio tracks preserve pause offsets and ignore stale source completions', () => {
  const sources = [];
  const ctx = {
    currentTime: 0, destination: {},
    createGain: () => ({ gain: {}, connect() {} }),
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start() {}, stop() {} };
      sources.push(source); return source;
    },
  };
  const track = new AudioTrack(ctx, { duration: 10 }, 0.5, true);
  track.play(); ctx.currentTime = 2; track.pause();
  assert.equal(track.offset, 2);
  assert.equal(track.paused, true);
  track.play(); sources[0].onended();
  assert.equal(track.source, sources[1]);
  track.stop();
  assert.equal(track.offset, 0);
  assert.equal(track.source, null);
});

test('audio stops effects on restart and music mute does not mute clear or game-over', () => {
  const track = () => ({ playing: false, paused: false, play() { this.playing = true; this.paused = false; }, stop() { this.playing = false; this.paused = false; }, pause() { this.paused = this.playing; this.playing = false; } });
  const audio = new GameAudio(() => {});
  audio.music = track(); audio.over = track(); audio.effects = Array.from({ length: 4 }, track);
  audio.activate = () => audio.sync();
  audio.enabled = false; audio.start();
  assert.equal(audio.music.playing, false);
  audio.clear(4); assert.equal(audio.effects[3].playing, true);
  audio.pause(); assert.equal(audio.effects[3].paused, true);
  audio.resume(); assert.equal(audio.effects[3].playing, true);
  audio.gameOver(); assert.equal(audio.over.playing, true);
  assert.ok(audio.effects.every(effect => !effect.playing));
  audio.start(); assert.equal(audio.over.playing, false);
  audio.toggle(); assert.equal(audio.music.playing, true);
});

test('attract demo legally clears one to four planes and loops without changing a player board', () => {
  const player = new Board();
  const snapshot = JSON.stringify(player);
  const demo = new AttractDemo();
  const counts = [];
  for (let frame = 0; frame < 4000 && counts.length < 8; frame++) {
    if (demo.board.current) assert.ok(demo.board.fits(demo.board.current));
    const update = demo.update(0.05);
    if (update?.result) {
      counts.push(update.result.count);
      assert.equal(update.result.over, false);
      assert.equal(update.result.removed.length, update.result.count * 25);
    }
  }
  assert.deepEqual(counts, [1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(JSON.stringify(player), snapshot);
});

test('attract demo waits before moving and retains a clear long enough to show effects', () => {
  const demo = new AttractDemo();
  const before = JSON.stringify(demo.board.current);
  assert.equal(demo.update(0.2), null);
  assert.equal(JSON.stringify(demo.board.current), before);
  while (!demo.waiting) demo.update(0.15);
  const stage = demo.stage;
  assert.equal(demo.update(1), null);
  assert.equal(demo.stage, stage);
});

function executeAI(board, plan) {
  for (const action of plan) {
    if (action === 'drop') {
      assert.ok(board.drop());
    } else if (action.startsWith('rotate-')) {
      assert.equal(board.turn(action.at(-1)), true);
    } else {
      const moves = { left: [-1, 0], right: [1, 0], back: [0, -1], front: [0, 1] };
      assert.equal(board.move(...moves[action]), true);
    }
  }
}

test('KI planning does not change the board, queue or random state', () => {
  let randomCalls = 0;
  const board = new Board(() => { randomCalls++; return 0.5; });
  board.start();
  const snapshot = JSON.stringify(board), calls = randomCalls;
  const plan = planAI(board);
  assert.equal(plan.at(-1), 'drop');
  assert.equal(JSON.stringify(board), snapshot);
  assert.equal(randomCalls, calls);
  board.state = 'pause';
  assert.deepEqual(planAI(board), []);
});

test('KI finds a reachable rotated four-plane clear', () => {
  const board = new Board();
  board.start(); board.spawn('I');
  for (let y = 0; y < 4; y++) {
    board.layers[y].fill('T');
    board.layers[y][board.width + 1] = null;
  }
  const plan = planAI(board);
  assert.ok(plan.some(action => action.startsWith('rotate-')));
  executeAI(board, plan);
  assert.equal(board.cleared, 4);
});

test('KI can take over a lowered, rotated piece in a populated well', () => {
  const board = new Board(() => 0.5);
  board.start();
  for (let turn = 0; turn < 12; turn++) executeAI(board, planAI(board));
  board.turn('x'); board.move(0, 0, -1); board.move(-1, 0);
  const score = board.score;
  executeAI(board, planAI(board));
  assert.ok(board.score >= score);
  assert.equal(board.state, 'play');
});

test('KI uses only legal moves and clears planes during sustained real play', () => {
  const board = new Board(() => 0.5);
  board.start();
  for (let turn = 0; turn < 80; turn++) {
    assert.equal(board.state, 'play');
    executeAI(board, planAI(board));
  }
  assert.ok(board.cleared >= 10);
});
