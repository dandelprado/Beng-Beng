import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.153.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { degToRad } from './MathUtils.js';

const INITIAL_SPAWN = new THREE.Vector3(0, 2, 0);
const SAFE_SPAWN_DISTANCE = 10;
const MOVE_SPEED = 0.2;
const BULLET_SPEED = 7;
const ENEMY_SPEED = 1.0;
const ENEMY_RADIUS = 1;
const PLAYER_RADIUS = 0.5;
const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

function generateDynamicMaze(areaSize) {
  const cellSize = 4;
  const cols = Math.floor(areaSize / cellSize);
  const rows = cols;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  const areas = [];
  const padding = 1;
  function isValidRect(x, z, w, h, buffer = 1) {
    if (x < padding || x + w >= cols - padding || z < padding || z + h >= rows - padding) return false;
    for (let r = z - buffer; r <= z + h + buffer; r++) {
      for (let c = x - buffer; c <= x + w + buffer; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] !== 0) return false;
      }
    }
    return true;
  }
  const areaCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < areaCount; i++) {
    const isRoom = Math.random() < 0.5;
    const w = isRoom ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
    const h = isRoom ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
    const x = padding + Math.floor(Math.random() * (cols - w - padding * 2));
    const z = padding + Math.floor(Math.random() * (rows - h - padding * 2));
    if (isValidRect(x, z, w, h)) {
      areas.push({ x, z, width: w, height: h, isRoom });
      if (isRoom) {
        for (let c = x - 1; c <= x + w; c++) {
          grid[z - 1][c] = 1;
          grid[z + h][c] = 1;
        }
        for (let r = z - 1; r <= z + h; r++) {
          grid[r][x - 1] = 1;
          grid[r][x + w] = 1;
        }
      }
    }
  }
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    const b = areas[(i + 1) % areas.length];
    const cx1 = a.x + Math.floor(a.width / 2);
    const cz1 = a.z + Math.floor(a.height / 2);
    const cx2 = b.x + Math.floor(b.width / 2);
    const cz2 = b.z + Math.floor(b.height / 2);
    const zLine = Math.round((cz1 + cz2) / 2);
    for (let x = Math.min(cx1, cx2); x <= Math.max(cx1, cx2); x++) {
      grid[zLine][x] = 0;
    }
    const xLine = Math.round((cx1 + cx2) / 2);
    for (let r = Math.min(cz1, cz2); r <= Math.max(cz1, cz2); r++) {
      grid[r][xLine] = 0;
    }
    if (a.isRoom) {
      const doorX = a.x + Math.floor(Math.random() * a.width);
      const doorZ = a.z + Math.floor(Math.random() * a.height);
      if (Math.random() < 0.5) {
        grid[a.z - 1][doorX] = 0;
        grid[a.z + a.height][doorX] = 0;
      } else {
        grid[doorZ][a.x - 1] = 0;
        grid[doorZ][a.x + a.width] = 0;
      }
    }
  }
  const wallCount = Math.floor(rows * cols * 0.1);
  for (let i = 0; i < wallCount; i++) {
    const r = padding + Math.floor(Math.random() * (rows - padding * 2));
    const c = padding + Math.floor(Math.random() * (cols - padding * 2));
    if (grid[r][c] === 0 && Math.random() < 0.3) grid[r][c] = 1;
  }
  const platformCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < platformCount; i++) {
    const w = 3 + Math.floor(Math.random() * 3);
    const h = 3 + Math.floor(Math.random() * 3);
    const x = padding + Math.floor(Math.random() * (cols - w - padding * 2));
    const z = padding + Math.floor(Math.random() * (rows - h - padding * 2));
    if (isValidRect(x, z, w, h, 2)) {
      for (let rr = z; rr < z + h; rr++) {
        for (let cc = x; cc < x + w; cc++) {
          grid[rr][cc] = 2;
        }
      }
    }
  }
  function isConnected() {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const stack = [];
    outer: for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (grid[rr][cc] === 0) {
          stack.push([rr, cc]);
          break outer;
        }
      }
    }
    while (stack.length) {
      const [rr, cc] = stack.pop();
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
      if (visited[rr][cc] || grid[rr][cc] !== 0) continue;
      visited[rr][cc] = true;
      stack.push([rr + 1, cc], [rr - 1, cc], [rr, cc + 1], [rr, cc - 1]);
    }
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (grid[rr][cc] === 0 && !visited[rr][cc]) return false;
      }
    }
    return true;
  }
  if (!isConnected()) {
    const rr = padding + Math.floor(Math.random() * (rows - padding * 2));
    for (let cc = padding; cc < cols - padding; cc++) grid[rr][cc] = 0;
  }
  const offsetX = -areaSize / 2;
  const offsetZ = -areaSize / 2;
  return { grid, offsetX, offsetZ, areas };
}

const textureLoader = new THREE.TextureLoader();
const enemyTexture = textureLoader.load('assets/steampunk_gears.png');
const groundTexture = textureLoader.load('assets/rusted_metal.png');
const mazeTexture = textureLoader.load('assets/steampunk_wall.png');
const wallTexture = textureLoader.load('assets/steampunk_boundary.png');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);

const enemyGeo = new THREE.CapsuleGeometry(1, 1.5, 4, 8);
const enemyMat = new THREE.MeshStandardMaterial({
  color: 0x8888ff,
  metalness: 0.6,
  roughness: 0.4,
  map: enemyTexture,
  emissive: 0x222222,
  emissiveIntensity: 0.2
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.copy(INITIAL_SPAWN);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.getElementById('threejsContainer').appendChild(renderer.domElement);

const mapSize = 250;
const mapMargin = 5;
const mapCamera = new THREE.OrthographicCamera(
  bounds.minX - 5, bounds.maxX + 5,
  bounds.maxZ + 5, bounds.minZ - 5,
  0.1, 500
);
mapCamera.position.set(0, 50, 0);
mapCamera.up.set(0, 0, -1);
mapCamera.lookAt(0, 0, 0);
mapCamera.layers.enable(1);
mapCamera.zoom = 0.8;
mapCamera.updateProjectionMatrix();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const sky = new Sky();
sky.scale.setScalar(450000);
sky.material.uniforms['turbidity'].value = 30;
sky.material.uniforms['rayleigh'].value = 0.3;
sky.material.uniforms['mieCoefficient'].value = 0.03;
sky.material.uniforms['mieDirectionalG'].value = 0.95;
sky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1, degToRad(75), degToRad(180));
scene.add(sky);

const ambientLight = new THREE.AmbientLight(0xffb380, 0.5);
scene.add(ambientLight);
let flickerTime = 0;
function flickerAmbientLight(dt) {
  flickerTime += dt;
  ambientLight.intensity = 0.5 + Math.sin(flickerTime * 5) * 0.1;
}

const dirLight = new THREE.DirectionalLight(0xffa500, 0.4);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

scene.fog = new THREE.FogExp2(0x4a3726, 0.01);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());
const ui = document.getElementById('ui');
let isPaused = false;
ui.addEventListener('click', () => {
  if (!isPaused && !controls.isLocked) controls.lock();
});
controls.addEventListener('lock', () => ui.classList.add('disabled'));
controls.addEventListener('unlock', () => ui.classList.remove('disabled'));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && controls.isLocked && !isPaused) {
    isPaused = true;
    controls.unlock();
    pauseScreen.style.display = 'flex';
  }
});

const gltfLoader = new GLTFLoader();
let gunModel = null;
gltfLoader.load(
  'assets/models/smith_wesson_cyberpunk_revolver_gltf/scene.gltf',
  gltf => {
    gunModel = gltf.scene;
    const pivot = new THREE.Object3D();
    camera.add(pivot);
    pivot.add(gunModel);
    const bbox = new THREE.Box3().setFromObject(gunModel);
    const center = bbox.getCenter(new THREE.Vector3());
    gunModel.position.sub(center);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    pivot.scale.setScalar(0.8 / maxDim);
    pivot.rotation.order = 'ZYX';
    pivot.rotation.set(0, Math.PI / 2, 0);
    pivot.position.set(0.3, -0.3, -0.7);
  },
  undefined,
  err => console.error('Revolver load error:', err)
);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
  new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8, metalness: 0.5 })
);
ground.rotation.x = -Math.PI / 2;
ground.layers.set(0);
scene.add(ground);

const mazeWalls = [];
const mazeMat = new THREE.MeshStandardMaterial({ map: mazeTexture, roughness: 0.7, metalness: 0.6 });
const mazeGeo = new THREE.BoxGeometry(4, 2, 4);
const platformMat = new THREE.MeshStandardMaterial({ map: mazeTexture, roughness: 0.7, metalness: 0.6 });
const platformGeo = new THREE.BoxGeometry(4, 1, 4);

const areaSize = 100;
const { grid: mazeGrid, offsetX, offsetZ } = generateDynamicMaze(areaSize);

for (let r = 0; r < mazeGrid.length; r++) {
  for (let c = 0; c < mazeGrid[0].length; c++) {
    const cell = mazeGrid[r][c];
    if (cell === 1) {
      const wall = new THREE.Mesh(mazeGeo, mazeMat);
      wall.position.set(offsetX + c * 4, 1, offsetZ + r * 4);
      scene.add(wall);
      mazeWalls.push(wall);
    } else if (cell === 2) {
      const plat = new THREE.Mesh(platformGeo, platformMat);
      plat.position.set(offsetX + c * 4, 1.5, offsetZ + r * 4);
      scene.add(plat);
      mazeWalls.push(plat);
    }
  }
}

(function() {
  const h = 4, t = 2, half = t / 2;
  function mk(w, hgt, th, x, y, z) {
    const mat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.6, metalness: 0.5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, th), mat);
    m.position.set(x, y, z);
    scene.add(m);
    mazeWalls.push(m);
  }
  mk(bounds.maxX - bounds.minX, h, t, 0, h / 2, bounds.maxZ - half);
  mk(bounds.maxX - bounds.minX, h, t, 0, h / 2, bounds.minZ + half);
  mk(t, h, bounds.maxZ - bounds.minZ, bounds.maxX - half, h / 2, 0);
  mk(t, h, bounds.maxZ - bounds.minZ, bounds.minX + half, h / 2, 0);
})();

// Minimap setup
const MINIMAP_LAYER = 1;
const minimapObjects = new THREE.Group();
scene.add(minimapObjects);

const minimapWallMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
const minimapPlatformMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
const minimapPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const minimapEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const minimapEnemyBorderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

const minimapWallGeo = new THREE.PlaneGeometry(4, 4);
for (let r = 0; r < mazeGrid.length; r++) {
  for (let c = 0; c < mazeGrid[0].length; c++) {
    const cell = mazeGrid[r][c];
    if (cell === 1 || cell === 2) {
      const mesh = new THREE.Mesh(
        minimapWallGeo,
        cell === 1 ? minimapWallMaterial : minimapPlatformMaterial
      );
      mesh.position.set(offsetX + c * 4, 0.1, offsetZ + r * 4);
      mesh.rotation.x = -Math.PI / 2;
      mesh.layers.set(MINIMAP_LAYER);
      minimapObjects.add(mesh);
    }
  }
}

(function() {
  const t = 2, half = t / 2;
  function addBoundary(w, th, x, z) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, th), minimapWallMaterial);
    mesh.position.set(x, 0.1, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.layers.set(MINIMAP_LAYER);
    minimapObjects.add(mesh);
  }
  addBoundary(bounds.maxX - bounds.minX, t, 0, bounds.maxZ - half);
  addBoundary(bounds.maxX - bounds.minX, t, 0, bounds.minZ + half);
  addBoundary(t, bounds.maxZ - bounds.minZ, bounds.maxX - half, 0, 0);
  addBoundary(t, bounds.maxZ - bounds.minZ, bounds.minX + half, 0, 0);
})();

const backgroundGeo = new THREE.PlaneGeometry(bounds.maxX - bounds.minX + 10, bounds.maxZ - bounds.minZ + 10);
const backgroundMat = new THREE.MeshBasicMaterial({ color: 0x222222, opacity: 0.6, transparent: true }); // Reduced opacity for better marker visibility
const background = new THREE.Mesh(backgroundGeo, backgroundMat);
background.position.set(0, 0.05, 0);
background.rotation.x = -Math.PI / 2;
background.layers.set(MINIMAP_LAYER);
minimapObjects.add(background);

const playerMarkerGeo = new THREE.CircleGeometry(0.5, 16);
const playerMarker = new THREE.Mesh(playerMarkerGeo, minimapPlayerMaterial);
playerMarker.position.y = 0.2;
playerMarker.rotation.x = -Math.PI / 2;
playerMarker.layers.set(MINIMAP_LAYER);
minimapObjects.add(playerMarker);

const enemyMarkerGeo = new THREE.CircleGeometry(1.5, 16);
const enemyBorderGeo = new THREE.CircleGeometry(1.7, 16);
const enemyMarkers = [];
function updateEnemyMarkers() {
  enemyMarkers.forEach(marker => minimapObjects.remove(marker));
  enemyMarkers.length = 0;
  enemies.forEach(enemy => {
    // Add black border
    const border = new THREE.Mesh(enemyBorderGeo, minimapEnemyBorderMaterial);
    border.position.copy(enemy.position);
    border.position.y = 0.15;
    border.rotation.x = -Math.PI / 2;
    border.layers.set(MINIMAP_LAYER);
    minimapObjects.add(border);
    enemyMarkers.push(border);

    const marker = new THREE.Mesh(enemyMarkerGeo, minimapEnemyMaterial);
    marker.position.copy(enemy.position);
    marker.position.y = 0.2;
    marker.rotation.x = -Math.PI / 2;
    marker.layers.set(MINIMAP_LAYER);
    minimapObjects.add(marker);
    enemyMarkers.push(marker);
  });
}

const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) {
    e.preventDefault();
    keys[k] = true;
  }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) {
    e.preventDefault();
    keys[k] = false;
  }
});

function checkCollision(pos, entity = null, isEnemy = false) {
  const r = isEnemy ? ENEMY_RADIUS : PLAYER_RADIUS;
  for (const wall of mazeWalls) {
    const dx = Math.abs(pos.x - wall.position.x),
          dz = Math.abs(pos.z - wall.position.z);
    if (dx < 2 + r && dz < 2 + r) return true;
  }
  if (isEnemy && entity) {
    const pp = controls.getObject().position;
    if (pos.distanceTo(pp) < ENEMY_RADIUS + PLAYER_RADIUS) return true;
    for (const o of enemies) {
      if (o !== entity && pos.distanceTo(o.position) < ENEMY_RADIUS * 2) return true;
    }
  } else if (!isEnemy) {
    for (const e of enemies) {
      if (pos.distanceTo(e.position) < PLAYER_RADIUS + ENEMY_RADIUS) return true;
    }
  }
  return false;
}

function updateMovement() {
  if (!controls.isLocked || isPaused) return;
  const dir = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const next = controls.getObject().position.clone();
  if (keys.w) next.addScaledVector(dir, MOVE_SPEED);
  if (keys.s) next.addScaledVector(dir, -MOVE_SPEED);
  if (keys.a) next.addScaledVector(right, -MOVE_SPEED);
  if (keys.d) next.addScaledVector(right, MOVE_SPEED);
  const off = PLAYER_RADIUS + 1;
  next.x = Math.max(bounds.minX + off, Math.min(bounds.maxX - off, next.x));
  next.z = Math.max(bounds.minZ + off, Math.min(bounds.maxZ - off, next.z));
  if (!checkCollision(next)) controls.getObject().position.copy(next);
}

const enemies = [];
let enemyShotCount = 0, totalEnemies = 20;
const bullets = [];
const clock = new THREE.Clock();
let startTime = null, gameOver = false;

function updateEnemyMovement(dt) {
  if (isPaused) return;
  enemies.forEach(enemy => {
    const target = enemy.userData.target.clone().sub(enemy.position).setY(0);
    const dist = target.length();
    const nextPos = enemy.position.clone().addScaledVector(target.clone().normalize(), ENEMY_SPEED * dt);
    if (dist < 0.5 || checkCollision(nextPos, enemy, true)) {
      let attempts = 0, newT;
      do {
        newT = getRandomTarget();
        attempts++;
      } while (checkCollision(newT, enemy, true) && attempts < 10);
      enemy.userData.target = newT;
      return;
    }
    const speed = ENEMY_SPEED * (0.8 + Math.random() * 0.4);
    target.normalize();
    const wander = new THREE.Vector3(Math.random() * 0.2 - 0.1, 0, Math.random() * 0.2 - 0.1);
    target.add(wander).normalize();
    const next = enemy.position.clone().addScaledVector(target, speed * dt);
    next.x = Math.max(bounds.minX + 1 + ENEMY_RADIUS, Math.min(bounds.maxX - 1 - ENEMY_RADIUS, next.x));
    next.z = Math.max(bounds.minZ + 1 + ENEMY_RADIUS, Math.min(bounds.maxZ - 1 - ENEMY_RADIUS, next.z));
    if (!checkCollision(next, enemy, true)) enemy.position.copy(next);
  });
}

const bulletGeo = new THREE.SphereGeometry(0.2, 18, 18);
const bulletMat = new THREE.MeshStandardMaterial({
  color: 0xe52b50, metalness: 1, roughness: 0.25,
  emissive: 0xe52b50, emissiveIntensity: 1
});
const gunshot = new Audio('assets/audio/gunshot.mp3');

document.addEventListener('click', () => {
  if (!controls.isLocked || isPaused) return;
  gunshot.currentTime = 0;
  gunshot.play().catch(() => {});
  const b = new THREE.Mesh(bulletGeo, bulletMat);
  const d = camera.getWorldDirection(new THREE.Vector3());
  const muzzleWorld = gunModel
    ? new THREE.Vector3().setFromMatrixPosition(gunModel.matrixWorld)
    : camera.position.clone();
  b.position.copy(muzzleWorld).add(d.clone().multiplyScalar(0.8));
  b.velocity = d.multiplyScalar(BULLET_SPEED);
  bullets.push(b);
  scene.add(b);
});

function updateBullets() {
  if (isPaused) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const prev = b.position.clone();
    b.position.add(b.velocity);
    const rc = new THREE.Raycaster(prev, b.velocity.clone().normalize());
    const hits = rc.intersectObjects(enemies);
    if (hits.length && hits[0].distance <= b.velocity.length()) {
      scene.remove(hits[0].object);
      enemies.splice(enemies.indexOf(hits[0].object), 1);
      scene.remove(b);
      bullets.splice(i, 1);
      enemyShotCount++;
      document.getElementById('counter').innerText = `Kills: ${enemyShotCount}`;
      continue;
    }
    if (b.position.length() > 100) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }
}

function getRandomTarget() {
  const empty = [];
  mazeGrid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === 0) empty.push({ r, c });
    });
  });
  if (!empty.length) return new THREE.Vector3(0, 1, 0);
  const pick = empty[Math.floor(Math.random() * empty.length)];
  return new THREE.Vector3(
    offsetX + pick.c * 4 + (Math.random() - 0.5) * 2,
    1,
    offsetZ + pick.r * 4 + (Math.random() - 0.5) * 2
  );
}

function spawnPlayer() {
  const empty = [];
  mazeGrid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === 0) empty.push({ r, c });
    });
  });
  let pos = null;
  for (let i = 0; i < 50; i++) {
    const pick = empty[Math.floor(Math.random() * empty.length)];
    const x = offsetX + pick.c * 4 + (Math.random() - 0.5) * 2;
    const z = offsetZ + pick.r * 4 + (Math.random() - 0.5) * 2;
    const cand = new THREE.Vector3(x, 2, z);
    if (!checkCollision(cand)) {
      pos = cand;
      break;
    }
  }
  if (!pos) pos = INITIAL_SPAWN.clone();
  controls.getObject().position.copy(pos);
}

function createEnemies(count) {
  enemies.forEach(e => scene.remove(e));
  enemies.length = 0;
  const empty = [];
  mazeGrid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === 0) empty.push({ r, c });
    });
  });
  let attempts = 0;
  while (enemies.length < count && attempts < count * 5) {
    attempts++;
    const pick = empty[Math.floor(Math.random() * empty.length)];
    const pos = new THREE.Vector3(
      offsetX + pick.c * 4 + (Math.random() - 0.5) * 2,
      1,
      offsetZ + pick.r * 4 + (Math.random() - 0.5) * 2
    );
    if (pos.distanceTo(controls.getObject().position) < SAFE_SPAWN_DISTANCE) continue;
    if (checkCollision(pos, null, true)) continue;
    const enemy = new THREE.Mesh(enemyGeo, enemyMat);
    enemy.position.copy(pos);
    enemy.userData.target = getRandomTarget();
    scene.add(enemy);
    enemies.push(enemy);
  }
}

document.getElementById('startButton').addEventListener('click', () => {
  totalEnemies = parseInt(document.getElementById('enemyCount').value) || 20;
  document.getElementById('startScreen').style.display = 'none';
  enemyShotCount = 0;
  isPaused = false;
  document.getElementById('counter').innerText = 'Kills: 0';
  document.getElementById('timer').innerText = 'Time: 0.00s';
  spawnPlayer();
  createEnemies(totalEnemies);
  controls.lock();
  startTime = Date.now();
  gameOver = false;
});

document.getElementById('restartButton').addEventListener('click', () => {
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  isPaused = false;
  spawnPlayer();
});

const pauseScreen = document.createElement('div');
pauseScreen.id = 'pauseScreen';
pauseScreen.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:none;justify-content:center;align-items:center;flex-direction:column;color:white;font-family:Arial,sans-serif;font-size:24px;`;
pauseScreen.innerHTML = `<div>Game Paused</div><button id="resumeButton" style="margin-top:20px;padding:10px 20px;font-size:18px;cursor:pointer;">Resume</button>`;
document.body.appendChild(pauseScreen);
document.getElementById('resumeButton').addEventListener('click', () => {
  isPaused = false;
  pauseScreen.style.display = 'none';
  controls.lock();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !isPaused) {
    isPaused = true;
    controls.unlock();
    pauseScreen.style.display = 'flex';
  }
});
window.addEventListener('blur', () => {
  if (!isPaused) {
    isPaused = true;
    controls.unlock();
    pauseScreen.style.display = 'flex';
  }
});
window.addEventListener('focus', () => {
  if (isPaused) pauseScreen.style.display = 'flex';
});

const enemySpotlight = new THREE.SpotLight(0xffff99, 20, 100, 0.05, 0.3);
const crosshairTarget = new THREE.Object3D();
scene.add(enemySpotlight, crosshairTarget);
enemySpotlight.target = crosshairTarget;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (!isPaused) {
    updateBullets();
    updateEnemyMovement(dt);
    updateMovement();
    flickerAmbientLight(dt);
    if (startTime !== null) {
      const elapsed = (Date.now() - startTime) / 1000;
      document.getElementById('timer').innerText = `Time: ${elapsed.toFixed(2)}s`;
      if (enemies.length === 0 && !gameOver) {
        gameOver = true;
        document.getElementById('finalStats').innerText =
          `Final Time: ${elapsed.toFixed(2)}s\nKills: ${enemyShotCount}`;
        document.getElementById('gameOverScreen').style.display = 'flex';
      }
    }
  }
  enemySpotlight.position.copy(camera.position);
  crosshairTarget.position.copy(
    camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(50))
  );

  playerMarker.position.copy(controls.getObject().position);
  playerMarker.position.y = 0.2;
  playerMarker.rotation.z = -camera.rotation.y;
  updateEnemyMarkers();

  renderer.clear();
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.render(scene, camera);

  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(
    window.innerWidth - mapSize - mapMargin,
    window.innerHeight - mapSize - mapMargin,
    mapSize,
    mapSize
  );
  renderer.setViewport(
    window.innerWidth - mapSize - mapMargin,
    window.innerHeight - mapSize - mapMargin,
    mapSize,
    mapSize
  );
  renderer.render(scene, mapCamera);
  renderer.setScissorTest(false);
}

animate();
