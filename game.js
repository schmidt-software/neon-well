import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';

const { Board, COLORS, SHAPES, AttractDemo, planAI } = globalThis.NeonRules;
const $ = selector => document.querySelector(selector);
const playerBoard = new Board();
let board = playerBoard;
let demo = null, idleSince = performance.now(), swallowClickUntil = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let aiEnabled = false, aiPlan = [], aiPiece = null, aiTimer = 0;
const audio = new GameAudio(message => { $('#error').hidden = false; $('#error').textContent = message; });
const viewport = $('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1220);
scene.fog = new THREE.FogExp2(0x0a1220, 0.025);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('#error').hidden = false;
  $('#error').textContent = 'Die 3D-Darstellung benötigt WebGL. Aktiviere Hardwarebeschleunigung oder verwende einen aktuellen Browser.';
  $('#play').disabled = true;
  console.error(error);
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
viewport.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', `3D-Schacht: ${board.width} mal ${board.depth} Felder, ${board.height} Ebenen`);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  if (board.state === 'play') togglePause();
  $('#error').hidden = false;
  $('#error').textContent = 'Die 3D-Verbindung wurde unterbrochen. Lade die Seite neu.';
});

const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 120);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5.3, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 14;
controls.maxDistance = 35;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI / 2.05;
function resetCamera() { camera.position.set(11, 17.5, 18); controls.target.set(0, 5.3, 0); controls.update(); }
resetCamera();
$('#camera-reset').addEventListener('click', resetCamera);

scene.add(new THREE.HemisphereLight(0xb5dbff, 0x172238, 2.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(7, 18, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
Object.assign(keyLight.shadow.camera, { left: -8, right: 8, top: 10, bottom: -10 });
keyLight.shadow.bias = -0.001;
scene.add(keyLight);
const rim = new THREE.PointLight(0x61ffee, 45, 30);
rim.position.set(-5, 8, -3);
scene.add(rim);
const fill = new THREE.PointLight(0xa37bff, 30, 25);
fill.position.set(4, 4, -5);
scene.add(fill);

const geometry = new THREE.BoxGeometry(0.91, 0.91, 0.91);
const edgeGeometry = new THREE.EdgesGeometry(geometry);
const materials = Object.fromEntries(Object.entries(COLORS).map(([type, color]) => [type, new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: 0.13, metalness: 0.3, roughness: 0.29,
})]));
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
const ghostMaterials = Object.fromEntries(Object.entries(COLORS).map(([type, color]) => [type, new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: 0.1, depthWrite: false,
})]));
const ghostEdges = new THREE.LineBasicMaterial({ color: 0x9effe7, transparent: true, opacity: 0.7 });
const lockedGroup = new THREE.Group(), activeGroup = new THREE.Group(), ghostGroup = new THREE.Group(), effectGroup = new THREE.Group();
scene.add(lockedGroup, activeGroup, ghostGroup, effectGroup);
const halfWidth = board.width / 2, halfDepth = board.depth / 2;
const world = ([x, y, z]) => new THREE.Vector3(x - (board.width - 1) / 2, y + 0.5, z - (board.depth - 1) / 2);

function cube(type, ghost = false) {
  const mesh = new THREE.Mesh(geometry, ghost ? ghostMaterials[type] : materials[type]);
  mesh.add(new THREE.LineSegments(edgeGeometry, ghost ? ghostEdges : edgeMaterial));
  mesh.castShadow = !ghost;
  mesh.receiveShadow = !ghost;
  return mesh;
}

const base = new THREE.Mesh(new THREE.BoxGeometry(board.width + 1.1, 0.35, board.depth + 1.1), new THREE.MeshStandardMaterial({
  color: 0x192e44, metalness: 0.65, roughness: 0.28,
}));
base.position.y = -0.22;
base.receiveShadow = true;
scene.add(base);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: 0x0b1626, roughness: 0.65, metalness: 0.25 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.42;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(board.width, board.width, 0x6ae3df, 0x355b70);
grid.position.y = 0.01;
scene.add(grid);
const outerGrid = new THREE.GridHelper(70, 70, 0x1a3047, 0x15263a);
outerGrid.position.y = -0.4;
scene.add(outerGrid);
const outlinePoints = [];
for (let y = 0; y <= board.height; y++) {
  const corners = [[-halfWidth, y, -halfDepth], [halfWidth, y, -halfDepth], [halfWidth, y, halfDepth], [-halfWidth, y, halfDepth]];
  for (let i = 0; i < 4; i++) outlinePoints.push(new THREE.Vector3(...corners[i]), new THREE.Vector3(...corners[(i + 1) % 4]));
}
const outlines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(outlinePoints), new THREE.LineBasicMaterial({ color: 0x73a2c3, transparent: true, opacity: 0.15 }));
scene.add(outlines);
for (const x of [-halfWidth, halfWidth]) for (const z of [-halfDepth, halfDepth]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, board.height, 6), new THREE.MeshBasicMaterial({ color: 0x436e89 }));
  post.position.set(x, board.height / 2, z);
  scene.add(post);
}
const topRim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-halfWidth, board.height, -halfDepth), new THREE.Vector3(halfWidth, board.height, -halfDepth), new THREE.Vector3(halfWidth, board.height, halfDepth), new THREE.Vector3(-halfWidth, board.height, halfDepth),
]), new THREE.LineBasicMaterial({ color: 0x5ce8e5 }));
scene.add(topRim);

function label(text, color, position) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(text, 64, 42);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.position.copy(position); sprite.scale.set(0.8, 0.4, 1); scene.add(sprite);
}
label('X →', '#ff7898', new THREE.Vector3(halfWidth + 0.8, 0, 0));
label('Z →', '#679fff', new THREE.Vector3(0, 0, halfDepth + 0.8));
for (const y of [0, 4, 8, 12]) label(String(y).padStart(2, '0'), '#6e8da9', new THREE.Vector3(-halfWidth - 0.55, y, -halfDepth));

const starPositions = [];
for (let i = 0; i < 140; i++) starPositions.push((Math.random() - 0.5) * 60, Math.random() * 35, (Math.random() - 0.5) * 60);
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: 0x91d9ff, size: 0.035, transparent: true, opacity: 0.6 }));
scene.add(stars);

function preview(element) {
  const miniRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  miniRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  miniRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  element.append(miniRenderer.domElement);
  const miniScene = new THREE.Scene(), group = new THREE.Group();
  const miniCamera = new THREE.OrthographicCamera(-3, 3, 1.7, -1.7, 0.1, 30);
  miniCamera.position.set(5, 7, 8); miniCamera.lookAt(0, 0, 0);
  miniScene.add(new THREE.HemisphereLight(0xd8f5ff, 0x35496c, 3), group);
  let lastType;
  return {
    set(type, available = true) {
      if (type !== lastType) {
        group.clear();
        if (type) {
          const cells = SHAPES[type], center = new THREE.Vector3();
          cells.forEach(cell => center.add(new THREE.Vector3(...cell)));
          center.divideScalar(4);
          cells.forEach(cell => { const mesh = cube(type); mesh.position.set(...cell).sub(center); group.add(mesh); });
        }
        lastType = type;
      }
      group.scale.setScalar(available ? 1 : 0.8);
    },
    render(time) {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      if (miniRenderer.domElement.width !== Math.round(width * miniRenderer.getPixelRatio()) || miniRenderer.domElement.height !== Math.round(height * miniRenderer.getPixelRatio())) miniRenderer.setSize(width, height, false);
      const aspect = width / height;
      miniCamera.left = -1.7 * aspect; miniCamera.right = 1.7 * aspect; miniCamera.updateProjectionMatrix();
      group.rotation.y = Math.sin(time * 0.0004) * 0.22;
      miniRenderer.render(miniScene, miniCamera);
    },
  };
}
const nextPreview = preview($('#next-preview')), holdPreview = preview($('#hold-preview'));
$('#top-map').style.gridTemplateColumns = `repeat(${board.width}, 1fr)`;
const mapCells = Array.from({ length: board.width * board.depth }, () => { const div = document.createElement('div'); $('#top-map').append(div); return div; });

function syncView() {
  lockedGroup.clear(); activeGroup.clear(); ghostGroup.clear();
  let highest = 0;
  board.layers.forEach((layer, y) => layer.forEach((type, index) => {
    if (!type) return;
    const block = cube(type); block.position.copy(world([index % board.width, y, Math.floor(index / board.width)])); lockedGroup.add(block);
    highest = Math.max(highest, y + 1);
  }));
  if (board.current) {
    board.cells().forEach(cell => { const block = cube(board.current.type); block.position.copy(world(cell)); activeGroup.add(block); });
    board.cells(board.ghost()).forEach(cell => { const block = cube(board.current.type, true); block.position.copy(world(cell)); ghostGroup.add(block); });
  }
  $('#score').textContent = String(board.score).padStart(6, '0');
  $('#level').textContent = String(board.level).padStart(2, '0');
  $('#layers').textContent = String(board.cleared).padStart(2, '0');
  $('#level-progress').style.width = `${board.cleared % 10 * 10}%`;
  $('#level-hint').textContent = `${10 - board.cleared % 10} Ebenen bis Level ${board.level + 1}`;
  $('#height-label').textContent = `HÖHE ${highest} / 12`;
  $('#height-label').style.color = highest > 9 ? '#ff6389' : '';
  $('#next-label').textContent = `${board.queue[0]} / TETRACUBE`;
  $('#queue-preview').replaceChildren(...board.queue.slice(1).map(type => { const span = document.createElement('span'); span.textContent = type; span.style.color = `#${COLORS[type].toString(16).padStart(6, '0')}`; return span; }));
  nextPreview.set(board.queue[0]); holdPreview.set(board.held, board.canHold);
  $('#hold-label').textContent = board.held ? `${board.held} · ${board.canHold ? 'Bereit zum Tauschen' : 'Nach dem Absetzen verfügbar'}` : 'Noch kein Stein gespeichert';
  document.querySelector('[data-action="hold"]').textContent = `Hold ${board.held || '–'} · C`;
  const ghost = board.ghost(), ghostCells = board.cells(ghost), currentCells = board.cells();
  $('#ghost-height').textContent = ghost ? `Y ${ghost.y + 1}` : '';
  mapCells.forEach((div, index) => {
    let type = null, y = -1;
    for (let row = 0; row < 12; row++) if (board.layers[row][index]) { type = board.layers[row][index]; y = row; }
    div.style.backgroundColor = type ? `#${COLORS[type].toString(16).padStart(6, '0')}77` : '';
    const at = ([x, , z]) => z * board.width + x === index;
    div.classList.toggle('ghost', ghostCells.some(at));
    div.classList.toggle('active', currentCells.some(at));
    div.title = `X ${index % board.width + 1}, Z ${Math.floor(index / board.width) + 1}: Höhe ${y + 1}`;
  });
  $('#state-label').textContent = demo ? 'DEMO · LAUTLOS' : aiEnabled && board.state === 'play' ? 'KI SPIELT · K: ÜBERNEHMEN' : { menu: 'BEREIT', play: 'IM SPIEL', pause: 'PAUSE', over: 'GAME OVER' }[board.state];
  $('#ai-toggle').setAttribute('aria-pressed', String(aiEnabled));
  $('#ai-toggle').innerHTML = aiEnabled ? 'KI: An <kbd>K</kbd>' : 'KI: Aus <kbd>K</kbd>';
  document.querySelectorAll('[data-action]').forEach(button => { button.disabled = aiEnabled && !demo; });
}

let effects = [], flash = 0, toastTimer = 0, dropTime = 0, clearDelay = 0;
function burst(blocks, intensity = 1) {
  for (const { type, cell } of blocks) {
    const block = cube(type);
    block.position.copy(world(cell)); block.scale.setScalar(0.55);
    effectGroup.add(block);
    effects.push({ mesh: block, velocity: new THREE.Vector3((Math.random() - 0.5) * 7 * intensity, 3 + Math.random() * 5, (Math.random() - 0.5) * 7 * intensity), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), life: 1.1 + Math.random() * 0.5 });
  }
}
function toast(message) { $('#toast').textContent = message; toastTimer = 1.6; }
function showOverlay(title, description, button, kicker) {
  $('#overlay').hidden = false;
  $('#overlay-title').textContent = title;
  $('#overlay-description').textContent = description;
  $('#play').textContent = button;
  $('#overlay-kicker').textContent = kicker;
  $('#overlay-hint').textContent = board.state === 'pause' ? 'P ZUM FORTSETZEN' : 'ENTER ZUM STARTEN';
}
function lose() {
  audio.gameOver();
  const blocks = [];
  board.layers.forEach((layer, y) => layer.forEach((type, index) => { if (type) blocks.push({ type, cell: [index % board.width, y, Math.floor(index / board.width)] }); }));
  burst(blocks, 0.7);
  lockedGroup.visible = false;
  activeGroup.visible = false; ghostGroup.visible = false;
  showOverlay('Game Over.', `${board.score.toLocaleString('de-DE')} Punkte · ${board.cleared} Ebenen. Bereit für eine neue Dimension?`, 'Erneut spielen ↗', 'DIE SCHWERKRAFT GEWINNT. DIESMAL.');
}
function outcome(result) {
  if (!result) return;
  dropTime = 0;
  if (result.count) {
    if (!demo) audio.clear(result.count);
    burst(result.removed, 0.65 + result.count * 0.2);
    flash = result.count * 0.14;
    clearDelay = 0.42;
    toast(['', 'EBENE FREI +', 'DOUBLE // 2', 'TRIPLE // 3', 'TETRIS // 4!'][result.count]);
  }
  if (result.over) lose();
}
function start(withAI = false) {
  if (demo) endAttract();
  aiEnabled = withAI;
  aiPlan = []; aiPiece = null; aiTimer = 0;
  effects.forEach(effect => effectGroup.remove(effect.mesh)); effects = [];
  lockedGroup.visible = true; activeGroup.visible = true; ghostGroup.visible = true;
  board.start(); audio.start();
  dropTime = 0; clearDelay = 0; flash = 0; toastTimer = 0; $('#toast').textContent = '';
  $('#overlay').hidden = true;
  $('#pause').innerHTML = 'Pause <kbd>P</kbd>';
  syncView();
}
function beginAttract() {
  demo = new AttractDemo();
  board = demo.board;
  controls.enabled = false;
  controls.autoRotate = !reducedMotion.matches;
  controls.autoRotateSpeed = 0.7;
  $('#overlay').hidden = true;
  $('#attract-banner').hidden = false;
  syncView();
}
function endAttract() {
  demo = null;
  board = playerBoard;
  effects.forEach(effect => effectGroup.remove(effect.mesh)); effects = [];
  flash = 0; toastTimer = 0; dropTime = 0; clearDelay = 0; $('#toast').textContent = '';
  controls.autoRotate = false;
  controls.enabled = true;
  resetCamera();
  $('#attract-banner').hidden = true;
  $('#overlay').hidden = false;
  idleSince = performance.now();
  syncView();
}

function attractInput(event) {
  idleSince = performance.now();
  if (!demo) {
    if (event.type === 'pointerdown') swallowClickUntil = 0;
    return;
  }
  endAttract();
  if (event.type === 'keydown' && event.code === 'KeyK' && !event.repeat) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleAI();
    return;
  }
  if (event.type === 'pointerdown') swallowClickUntil = performance.now() + 600;
  if (event.cancelable) event.preventDefault();
  event.stopImmediatePropagation();
}
for (const name of ['keydown', 'pointerdown', 'pointermove', 'wheel']) {
  document.addEventListener(name, attractInput, { capture: true, passive: false });
}
document.addEventListener('click', event => {
  if (demo) {
    attractInput(event);
    return;
  }
  idleSince = performance.now();
  if (performance.now() < swallowClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
function togglePause() {
  if (board.state === 'play') {
    board.state = 'pause'; audio.pause();
    showOverlay('Durchatmen.', 'Dein Schacht wartet. Die Schwerkraft auch.', 'Weiter spielen ↗', 'PAUSE');
  } else if (board.state === 'pause') {
    board.state = 'play'; audio.resume(); $('#overlay').hidden = true;
  }
  $('#pause').innerHTML = board.state === 'pause' ? 'Weiter <kbd>P</kbd>' : 'Pause <kbd>P</kbd>';
  syncView();
}
function toggleMusic() {
  audio.toggle();
  $('#music').setAttribute('aria-pressed', String(audio.enabled));
  $('#music').innerHTML = audio.enabled ? '♫ Musik an <kbd>M</kbd>' : '♫ Musik aus <kbd>M</kbd>';
}
function toggleAI() {
  stopRepeat();
  if (board.state === 'menu' || board.state === 'over') { start(true); return; }
  aiEnabled = !aiEnabled;
  aiPlan = []; aiPiece = null; aiTimer = 0;
  dropTime = 0;
  syncView();
}
function action(name, reverse = false, automated = false) {
  if (board.state !== 'play' || clearDelay > 0 || (aiEnabled && !automated)) return;
  if (name === 'left') board.move(-1, 0);
  else if (name === 'right') board.move(1, 0);
  else if (name === 'back') board.move(0, -1);
  else if (name === 'front') board.move(0, 1);
  else if (name.startsWith('rotate-')) board.turn(name.at(-1), reverse ? -1 : 1);
  else if (name === 'drop') outcome(board.drop());
  else if (name === 'soft') { outcome(board.step(true)); dropTime = 0; }
  else if (name === 'hold') { if (board.hold()) dropTime = 0; if (board.state === 'over') lose(); }
  syncView();
}
$('#play').addEventListener('click', () => { if (board.state === 'pause') togglePause(); else start(); });
$('#pause').addEventListener('click', togglePause);
$('#music').addEventListener('click', toggleMusic);
$('#ai-toggle').addEventListener('click', toggleAI);
$('#restart').addEventListener('click', () => start());
const keyActions = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'back', KeyW: 'back', ArrowDown: 'front', KeyS: 'front', KeyQ: 'rotate-x', KeyE: 'rotate-y', KeyR: 'rotate-z', KeyF: 'soft', Space: 'drop', KeyC: 'hold' };
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (['Enter', 'KeyP', 'KeyM', 'KeyK', ...Object.keys(keyActions)].includes(event.code)) event.preventDefault();
  if (event.code === 'Enter' && !event.repeat) {
    if (board.state === 'menu' || board.state === 'over') start();
    else if (board.state === 'pause') togglePause();
  }
  if (event.code === 'KeyP' && !event.repeat) togglePause();
  if (event.code === 'KeyM' && !event.repeat) toggleMusic();
  if (event.code === 'KeyK' && !event.repeat) toggleAI();
  const name = keyActions[event.code];
  if (name && (!event.repeat || ['left', 'right', 'back', 'front', 'soft'].includes(name))) action(name, event.shiftKey);
});
let repeat = null;
function stopRepeat() { clearInterval(repeat); repeat = null; }
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); stopRepeat();
    const name = button.dataset.action;
    action(name, event.shiftKey);
    if (['left', 'right', 'back', 'front', 'soft'].includes(name)) {
      button.setPointerCapture(event.pointerId);
      repeat = setInterval(() => action(name), 140);
    }
  });
  button.addEventListener('pointerup', stopRepeat);
  button.addEventListener('pointercancel', stopRepeat);
  button.addEventListener('lostpointercapture', stopRepeat);
  button.addEventListener('click', event => { if (event.detail === 0) action(button.dataset.action); });
});
window.addEventListener('blur', () => {
  stopRepeat(); idleSince = performance.now();
  if (demo) endAttract();
  else if (board.state === 'play') togglePause();
});
document.addEventListener('visibilitychange', () => {
  idleSince = performance.now();
  if (document.hidden) {
    if (demo) endAttract();
    else if (board.state === 'play') togglePause();
  }
});
new ResizeObserver(() => {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}).observe(viewport);

syncView();
let lastTime = performance.now();
function animate(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.06); lastTime = time;
  controls.update();
  if (!demo && board.state === 'menu' && !document.hidden && time - idleSince >= 15000) beginAttract();
  if (demo) {
    const update = demo.update(dt);
    if (update) { outcome(update.result); syncView(); }
  } else if (board.state === 'play') {
    if (clearDelay > 0) clearDelay = Math.max(0, clearDelay - dt);
    else if (aiEnabled) {
      aiTimer -= dt;
      if (aiTimer <= 0) {
        if (aiPiece !== board.current || !aiPlan.length) aiPlan = planAI(board);
        const next = aiPlan.shift();
        if (next) action(next, false, true);
        aiPiece = next === 'drop' ? null : board.current;
        aiTimer = next === 'drop' ? 0.45 : 0.12;
      }
    }
    else {
      dropTime += dt * 1000;
      if (dropTime >= board.interval) { dropTime = 0; outcome(board.step()); syncView(); }
    }
  }
  if (board.state !== 'pause') {
    effects = effects.filter(effect => {
      effect.life -= dt;
      if (effect.life <= 0) { effectGroup.remove(effect.mesh); return false; }
      effect.velocity.y -= 12 * dt;
      effect.mesh.position.addScaledVector(effect.velocity, dt);
      effect.mesh.rotation.x += effect.spin.x * dt; effect.mesh.rotation.y += effect.spin.y * dt; effect.mesh.rotation.z += effect.spin.z * dt;
      effect.mesh.scale.setScalar(Math.min(0.55, effect.life * 0.8));
      return true;
    });
    flash = Math.max(0, flash - dt);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('#toast').textContent = ''; }
  }
  rim.intensity = 45 + flash * 180;
  stars.rotation.y = time * 0.000008;
  renderer.render(scene, camera);
  nextPreview.render(time); holdPreview.render(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

export { board, audio };
