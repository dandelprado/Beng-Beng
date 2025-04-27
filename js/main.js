import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.153.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { degToRad } from './MathUtils.js';

const INITIAL_SPAWN       = new THREE.Vector3(0, 2, 0);
const SAFE_SPAWN_DISTANCE = 10;
const MOVE_SPEED          = 0.2;
const BULLET_SPEED        = 7;
const ENEMY_SPEED         = 1.0;
const ENEMY_RADIUS        = 1;
const PLAYER_RADIUS       = 0.5;
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
        // draw room walls in grid
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
    if (grid[r][c] === 0 && Math.random() < 0.3) {
      grid[r][c] = 1;
    }
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
        if (grid[rr][cc] === 0) { stack.push([rr, cc]); break outer; }
      }
    }
    while (stack.length) {
      const [rr, cc] = stack.pop();
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
      if (visited[rr][cc] || grid[rr][cc] !== 0) continue;
      visited[rr][cc] = true;
      stack.push([rr+1,cc],[rr-1,cc],[rr,cc+1],[rr,cc-1]);
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
    for (let cc = padding; cc < cols - padding; cc++) {
      grid[rr][cc] = 0;
    }
  }

  const offsetX = -areaSize / 2;
  const offsetZ = -areaSize / 2;
  return { grid, offsetX, offsetZ, areas };
}

const textureLoader = new THREE.TextureLoader();
const enemyTexture  = textureLoader.load('assets/alien.jpg');
const groundTexture = textureLoader.load('assets/floor.jpg');
const mazeTexture   = textureLoader.load('assets/maze.jpg');
const wallTexture   = textureLoader.load('assets/wall.png');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.position.copy(INITIAL_SPAWN);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('threejsContainer').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const sky = new Sky();
sky.scale.setScalar(450000);
sky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1, degToRad(90), degToRad(180));
scene.add(sky);

scene.add(new THREE.AmbientLight(0xffffff, 0.1));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

const bulletLight = new THREE.PointLight(0xffffff, 1, 10);
scene.add(bulletLight);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const ui = document.getElementById('ui');
let isPaused = false;

ui.addEventListener('click', () => {
  if (!isPaused && !controls.isLocked) controls.lock();
});
controls.addEventListener('lock',   () => ui.classList.add('disabled'));
controls.addEventListener('unlock', () => ui.classList.remove('disabled'));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && controls.isLocked && !isPaused) {
    isPaused = true;
    controls.unlock();
    pauseScreen.style.display = 'flex';
  }
});


let gunModel = null;
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  'assets/models/smith_wesson_cyberpunk_revolver_gltf/scene.gltf',
  (gltf) => {
    gunModel = gltf.scene;

    const pivot = new THREE.Object3D();
    camera.add(pivot);
    pivot.add(gunModel);

    const bbox   = new THREE.Box3().setFromObject(gunModel);
    const center = bbox.getCenter(new THREE.Vector3());
    gunModel.position.sub(center);

    const size   = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const desiredSize = 0.8;
    gunModel.scale.setScalar(desiredSize / maxDim);

    pivot.rotation.order = 'ZYX';
    pivot.rotation.set(
      0,
      Math.PI / 2,
      0
    );

    pivot.position.set(0.3, -0.3, -0.7);

    console.log('Revolver positioned for FPS view:', pivot);
  },
  undefined,
  (err) => console.error('GLTF load error:', err)
);


const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
  new THREE.MeshStandardMaterial({ map: groundTexture })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

const mazeWalls = [];
const mazeMat   = new THREE.MeshStandardMaterial({ map: mazeTexture });
const mazeGeo   = new THREE.BoxGeometry(4, 2, 4);
const platformMat = new THREE.MeshStandardMaterial({ map: mazeTexture });
const platformGeo = new THREE.BoxGeometry(4, 1, 4);

const areaSize = 100;
const { grid: mazeGrid, offsetX, offsetZ } = generateDynamicMaze(areaSize);

for (let r = 0; r < mazeGrid.length; r++) {
  for (let c = 0; c < mazeGrid[0].length; c++) {
    const cell = mazeGrid[r][c];
    if (cell === 1) {
      const wall = new THREE.Mesh(mazeGeo, mazeMat);
      wall.position.set(offsetX + c*4, 1, offsetZ + r*4);
      scene.add(wall);
      mazeWalls.push(wall);
    } else if (cell === 2) {
      const plat = new THREE.Mesh(platformGeo, platformMat);
      plat.position.set(offsetX + c*4, 1.5, offsetZ + r*4);
      scene.add(plat);
      mazeWalls.push(plat);
    }
  }
}

(function() {
  const h = 4, t = 2, half = t/2;
  function mk(w,hgt,th,x,y,z) {
    const mat = new THREE.MeshStandardMaterial({ map: wallTexture });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,hgt,th), mat);
    m.position.set(x,y,z);
    scene.add(m);
    mazeWalls.push(m);
  }
  mk(bounds.maxX-bounds.minX, h, t, 0, h/2, bounds.maxZ-half);
  mk(bounds.maxX-bounds.minX, h, t, 0, h/2, bounds.minZ+half);
  mk(t, h, bounds.maxZ-bounds.minZ, bounds.maxX-half, h/2, 0);
  mk(t, h, bounds.maxZ-bounds.minZ, bounds.minX+half, h/2, 0);
})();

const keys = { w:false, a:false, s:false, d:false };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k] = true; }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k] = false; }
});

function checkCollision(pos, entity=null, isEnemy=false) {
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
      if (o !== entity && pos.distanceTo(o.position) < ENEMY_RADIUS*2) return true;
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
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
  const next = controls.getObject().position.clone();
  if (keys.w) next.addScaledVector(dir, MOVE_SPEED);
  if (keys.s) next.addScaledVector(dir, -MOVE_SPEED);
  if (keys.a) next.addScaledVector(right, -MOVE_SPEED);
  if (keys.d) next.addScaledVector(right, MOVE_SPEED);
  const off = PLAYER_RADIUS + 1;
  next.x = Math.max(bounds.minX+off, Math.min(bounds.maxX-off, next.x));
  next.z = Math.max(bounds.minZ+off, Math.min(bounds.maxZ-off, next.z));
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
    const speed = ENEMY_SPEED * (0.8 + Math.random()*0.4);
    target.normalize();
    const wander = new THREE.Vector3(Math.random()*0.2-0.1,0,Math.random()*0.2-0.1);
    target.add(wander).normalize();
    const next = enemy.position.clone().addScaledVector(target, speed*dt);
    next.x = Math.max(bounds.minX+1+ENEMY_RADIUS, Math.min(bounds.maxX-1-ENEMY_RADIUS, next.x));
    next.z = Math.max(bounds.minZ+1+ENEMY_RADIUS, Math.min(bounds.maxZ-1-ENEMY_RADIUS, next.z));
    if (!checkCollision(next, enemy, true)) enemy.position.copy(next);
  });
}

const bulletGeo = new THREE.SphereGeometry(0.2,18,18);
const bulletMat = new THREE.MeshStandardMaterial({
  color:0xe52b50, metalness:1, roughness:0.25,
  emissive:0xe52b50, emissiveIntensity:1
});
const gunshot = new Audio('assets/audio/gunshot.mp3');

document.addEventListener('click', () => {
  if (!controls.isLocked || isPaused) return;
  gunshot.currentTime = 0; gunshot.play().catch(()=>{});
  const b = new THREE.Mesh(bulletGeo, bulletMat);
  const d = camera.getWorldDirection(new THREE.Vector3());
  // muzzle position
  const muzzleWorld = new THREE.Vector3();
  if (gunModel) muzzleWorld.setFromMatrixPosition(gunModel.matrixWorld);
  else muzzleWorld.copy(camera.position);
  const spawnPos = muzzleWorld.clone().add(d.clone().multiplyScalar(0.8));
  b.position.copy(spawnPos);
  b.velocity = d.multiplyScalar(BULLET_SPEED);
  bullets.push(b);
  scene.add(b);
  bulletLight.position.copy(b.position);
});

function updateBullets() {
  if (isPaused) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const prev = b.position.clone();
    b.position.add(b.velocity);
    bulletLight.position.copy(b.position);
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
  if (!empty.length) return new THREE.Vector3(0,1,0);
  const pick = empty[Math.floor(Math.random()*empty.length)];
  return new THREE.Vector3(
    offsetX + pick.c*4 + (Math.random()-0.5)*2,
    1,
    offsetZ + pick.r*4 + (Math.random()-0.5)*2
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
    const pick = empty[Math.floor(Math.random()*empty.length)];
    const x = offsetX + pick.c*4 + (Math.random()-0.5)*2;
    const z = offsetZ + pick.r*4 + (Math.random()-0.5)*2;
    const cand = new THREE.Vector3(x,2,z);
    if (!checkCollision(cand)) { pos = cand; break; }
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
    const pick = empty[Math.floor(Math.random()*empty.length)];
    const x = offsetX + pick.c*4 + (Math.random()-0.5)*2;
    const z = offsetZ + pick.r*4 + (Math.random()-0.5)*2;
    const pos = new THREE.Vector3(x,1,z);
    if (pos.distanceTo(controls.getObject().position) < SAFE_SPAWN_DISTANCE) continue;
    if (checkCollision(pos,null,true)) continue;
    const e = new THREE.Mesh(
      new THREE.BoxGeometry(2,2,2),
      new THREE.MeshStandardMaterial({ color:0x43cd80, map:enemyTexture })
    );
    e.position.copy(pos);
    e.userData.target = getRandomTarget();
    scene.add(e);
    enemies.push(e);
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
pauseScreen.style.cssText = `
  position:absolute;top:0;left:0;width:100%;height:100%;
  background:rgba(0,0,0,0.7);display:none;
  justify-content:center;align-items:center;
  flex-direction:column;color:white;
  font-family:Arial,sans-serif;font-size:24px;
`;
pauseScreen.innerHTML = `
  <div>Game Paused</div>
  <button id="resumeButton" style="margin-top:20px;
    padding:10px 20px;font-size:18px;cursor:pointer;">
    Resume
  </button>`;
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

const enemySpotlight  = new THREE.SpotLight(0x66ff00, 50, 100, 0.02, 0.1);
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
  renderer.render(scene, camera);
}
animate();
