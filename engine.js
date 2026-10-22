(function (root) {
  const COLORS = { I: 0x3be6ff, O: 0xffd45a, T: 0xbb8bff, S: 0x58f5b0, Z: 0xff6389, J: 0x639cff, L: 0xffa353 };
  const SHAPES = {
    I: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]],
    O: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]],
    T: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 0, 1]],
    S: [[0, 0, 0], [1, 0, 0], [-1, 0, 1], [0, 0, 1]],
    Z: [[-1, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]],
    J: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, 0, 1]],
    L: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
  };
  const rotate = (cells, axis, direction = 1) => cells.map(([x, y, z]) => {
    if (axis === 'x') return [x, -direction * z, direction * y];
    if (axis === 'y') return [direction * z, y, -direction * x];
    if (axis === 'z') return [-direction * y, direction * x, z];
    throw new Error(`Unknown rotation axis: ${axis}`);
  });

  class Board {
    constructor(random = Math.random) {
      this.width = 5;
      this.depth = 5;
      this.height = 12;
      this.random = random;
      this.reset();
      this.state = 'menu';
    }

    reset() {
      this.layers = Array.from({ length: this.height }, () => Array(this.width * this.depth).fill(null));
      this.bag = [];
      this.queue = Array.from({ length: 3 }, () => this.pull());
      this.current = null;
      this.held = null;
      this.canHold = true;
      this.score = 0;
      this.cleared = 0;
      this.level = 1;
    }

    pull() {
      if (!this.bag.length) {
        this.bag = Object.keys(SHAPES);
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }

    start() {
      this.reset();
      this.state = 'play';
      this.spawn();
    }

    get interval() { return Math.max(100, 1100 * 0.86 ** (this.level - 1)); }

    cells(piece = this.current) {
      if (!piece) return [];
      return piece.cells.map(([x, y, z]) => [x + piece.x, y + piece.y, z + piece.z]);
    }

    fits(piece) {
      return this.cells(piece).every(([x, y, z]) =>
        x >= 0 && x < this.width && z >= 0 && z < this.depth
        && y >= 0 && y < this.height && !this.layers[y][z * this.width + x]);
    }

    spawn(forced) {
      const type = forced || this.queue.shift();
      if (!forced) this.queue.push(this.pull());
      this.current = { type, cells: SHAPES[type].map(cell => cell.slice()), x: Math.floor((this.width - 1) / 2), y: this.height - 1, z: Math.floor((this.depth - 1) / 2) };
      if (!this.fits(this.current)) {
        this.current = null;
        this.state = 'over';
        return false;
      }
      return true;
    }

    move(dx, dz, dy = 0) {
      if (this.state !== 'play' || !this.current) return false;
      const candidate = { ...this.current, x: this.current.x + dx, y: this.current.y + dy, z: this.current.z + dz };
      if (!this.fits(candidate)) return false;
      this.current = candidate;
      return true;
    }

    turn(axis, direction = 1) {
      if (this.state !== 'play' || !this.current) return false;
      const cells = rotate(this.current.cells, axis, direction);
      const kicks = [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [-2, 0, 0], [2, 0, 0], [0, 0, -2], [0, 0, 2], [0, -1, 0], [0, -2, 0]];
      for (const [dx, dy, dz] of kicks) {
        const candidate = { ...this.current, cells, x: this.current.x + dx, y: this.current.y + dy, z: this.current.z + dz };
        if (this.fits(candidate)) { this.current = candidate; return true; }
      }
      return false;
    }

    ghost() {
      if (!this.current) return null;
      const piece = { ...this.current };
      while (this.fits({ ...piece, y: piece.y - 1 })) piece.y--;
      return piece;
    }

    hold() {
      if (this.state !== 'play' || !this.current || !this.canHold) return false;
      const type = this.current.type;
      this.spawn(this.held);
      this.held = type;
      this.canHold = false;
      return true;
    }

    drop() {
      if (this.state !== 'play' || !this.current) return null;
      const ghost = this.ghost();
      this.score += (this.current.y - ghost.y) * 2;
      this.current = ghost;
      return this.lock();
    }

    step(soft = false) {
      if (this.state !== 'play' || !this.current) return null;
      if (this.move(0, 0, -1)) {
        if (soft) this.score++;
        return null;
      }
      return this.lock();
    }

    lock() {
      const type = this.current.type;
      const placed = this.cells();
      for (const [x, y, z] of placed) this.layers[y][z * this.width + x] = type;
      const full = [];
      this.layers.forEach((layer, y) => { if (layer.every(Boolean)) full.push(y); });
      const removed = [];
      for (const y of full) {
        this.layers[y].forEach((value, index) => removed.push({
          type: value, cell: [index % this.width, y, Math.floor(index / this.width)],
        }));
      }
      if (full.length) {
        this.score += [0, 100, 300, 500, 800][full.length] * this.level;
        this.cleared += full.length;
        this.level = 1 + Math.floor(this.cleared / 10);
        this.layers = this.layers.filter((_, y) => !full.includes(y));
        while (this.layers.length < this.height) this.layers.push(Array(this.width * this.depth).fill(null));
      }
      this.canHold = true;
      this.spawn();
      return { count: full.length, removed, layers: full, placed, type, over: this.state === 'over' };
    }
  }

  class AttractDemo {
    constructor() {
      this.board = new Board(() => 0.5);
      this.stage = -1;
      this.prepare();
    }

    prepare() {
      this.stage = (this.stage + 1) % 4;
      const count = this.stage + 1, board = this.board;
      board.start();
      const type = count <= 2 ? 'O' : 'I';
      board.spawn(type);
      // Demonstration puzzles deliberately showcase each clear size, not AI play.
      if (type === 'I') board.turn('z');
      else if (count === 2) board.turn('x');
      const target = { x: 1, z: 1 };
      const landing = { ...board.current, ...target };
      const holes = new Set(board.cells(landing).map(([x, , z]) => z * board.width + x));
      for (let y = 0; y < count; y++) {
        board.layers[y] = Array.from({ length: board.width * board.depth }, (_, index) =>
          holes.has(index) ? null : Object.keys(COLORS)[(index + y + this.stage) % 7]);
      }
      this.target = target;
      this.timer = 0.8;
      this.waiting = false;
    }

    update(dt) {
      this.timer -= dt;
      if (this.timer > 0) return null;
      if (this.waiting) {
        this.prepare();
        return { changed: true };
      }
      const board = this.board;
      if (board.current.x !== this.target.x) board.move(Math.sign(this.target.x - board.current.x), 0);
      else if (board.current.z !== this.target.z) board.move(0, Math.sign(this.target.z - board.current.z));
      else {
        const result = board.step();
        if (result) {
          this.waiting = true;
          this.timer = 2.5;
          return { changed: true, result };
        }
      }
      this.timer = 0.14;
      return { changed: true };
    }
  }

  function planAI(board) {
    if (board.state !== 'play' || !board.current) return [];
    const signature = piece => `${piece.x},${piece.y},${piece.z}:` +
      piece.cells.map(cell => cell.map(value => value || 0).join(',')).sort().join(';');
    const moves = [
      ['left', -1, 0], ['right', 1, 0], ['back', 0, -1], ['front', 0, 1],
      ['rotate-x'], ['rotate-y'], ['rotate-z'],
    ];
    const search = Object.assign(Object.create(Board.prototype), board);
    const nodes = [{ piece: board.current, parent: -1, action: null }];
    const visited = new Set([signature(board.current)]);
    const landings = new Set();
    let best = -Infinity, bestIndex = 0;
    for (let index = 0; index < nodes.length; index++) {
      search.current = nodes[index].piece;
      const landing = search.ghost();
      const landingKey = board.cells(landing).map(String).sort().join(';');
      if (!landings.has(landingKey)) {
        landings.add(landingKey);
        const layers = board.layers.map(layer => layer.slice());
        for (const [x, y, z] of board.cells(landing)) layers[y][z * board.width + x] = landing.type;
        const full = layers.filter(layer => layer.every(Boolean)).length;
        const remaining = layers.filter(layer => !layer.every(Boolean));
        while (remaining.length < board.height) remaining.push(Array(board.width * board.depth).fill(null));
        const heights = Array(board.width * board.depth).fill(0);
        let holes = 0, heightSum = 0, roughness = 0;
        for (let cell = 0; cell < heights.length; cell++) {
          for (let y = board.height - 1; y >= 0; y--) {
            if (remaining[y][cell]) {
              if (!heights[cell]) heights[cell] = y + 1;
            } else if (heights[cell]) holes++;
          }
          heightSum += heights[cell];
          if (cell % board.width) roughness += Math.abs(heights[cell] - heights[cell - 1]);
          if (cell >= board.width) roughness += Math.abs(heights[cell] - heights[cell - board.width]);
        }
        const score = full * 150 - holes * 24 - heightSum * 2 - roughness * 1.5
          - Math.max(...heights) * 5;
        if (score > best) { best = score; bestIndex = index; }
      }
      for (const [action, dx, dz] of moves) {
        search.current = nodes[index].piece;
        const valid = dx === undefined ? search.turn(action.at(-1)) : search.move(dx, dz);
        if (!valid) continue;
        const key = signature(search.current);
        if (visited.has(key)) continue;
        visited.add(key);
        nodes.push({ piece: search.current, parent: index, action });
      }
    }
    const path = ['drop'];
    for (let index = bestIndex; nodes[index].parent >= 0; index = nodes[index].parent) path.unshift(nodes[index].action);
    return path;
  }

  const api = { Board, SHAPES, COLORS, rotate, AttractDemo, planAI };
  if (typeof module !== 'undefined') module.exports = api;
  else root.NeonRules = api;
})(globalThis);
