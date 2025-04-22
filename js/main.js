import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { MathUtils } from './MathUtils.js';

const INITIAL_SPAWN      = new THREE.Vector3(0, 2, 10);
const SAFE_SPAWN_DISTANCE = 15;
const MOVE_SPEED         = 0.2;
const BULLET_SPEED       = 7;
const ENEMY_SPEED        = 1.0;    
const ENEMY_RADIUS       = 1;      
const PLAYER_RADIUS      = 0.5;   

let enemyShotCount = 0;
let startTime      = null;
let gameOver       = false;
let isPaused       = false;
let totalEnemies   = 20;
const enemies      = [];
const bullets      = [];

const clock = new THREE.Clock();

const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
function getRandomTarget() {
  const pad = ENEMY_RADIUS + 1;
  const x = Math.random() * (bounds.maxX - bounds.minX - pad*2) + bounds.minX + pad;
  const z = Math.random() * (bounds.maxZ - bounds.minZ - pad*2) + bounds.minZ + pad;
  return new THREE.Vector3(x, 1, z);
}

const textureLoader   = new THREE.TextureLoader();
const enemyTexture    = textureLoader.load('assets/alien.jpg');
const enemyGeometry   = new THREE.BoxGeometry(2, 2, 2);
const enemyMaterial   = new THREE.MeshStandardMaterial({ color: 0x43cd80, map: enemyTexture });
const groundTexture   = textureLoader.load('assets/floor.jpg');
const mazeTexture     = textureLoader.load('assets/maze.jpg');
const wallTexture     = textureLoader.load('assets/wall.png');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.copy(INITIAL_SPAWN);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('threejsContainer').appendChild(renderer.domElement);

const sky = new Sky();
sky.scale.setScalar(450000);
const phi   = MathUtils.degToRad(90), theta = MathUtils.degToRad(180);
const sunPos= new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
sky.material.uniforms['sunPosition'].value.copy(sunPos);
scene.add(sky);

scene.add(new THREE.AmbientLight(0xffffff, 0.05));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const bulletLight = new THREE.PointLight(0xffffff, 1, 10);
scene.add(bulletLight);

const controls = new PointerLockControls(camera, renderer.domElement);
document.getElementById('ui').addEventListener('click', () => { if (!isPaused) controls.lock(); });
document.addEventListener('keydown', e => { if (e.key === 'Backspace' && !isPaused) controls.lock(); });
controls.addEventListener('lock',   () => document.getElementById('ui').classList.add('disabled'));
controls.addEventListener('unlock', () => document.getElementById('ui').classList.remove('disabled'));
scene.add(controls.getObject());

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ map: groundTexture })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const mazeWalls = [];
const mazeMat   = new THREE.MeshStandardMaterial({ map: mazeTexture });
const mazeGeo   = new THREE.BoxGeometry(2, 2, 2);
const mazeLayout= [
  "00111111111111111100","01000000000000000010","10000000000000000001","10000000000000000001",
  "10000000000000000001","10000000000000000001","11111111111111111111","00000000000000000000",
  "00000000000000000000","00000000000000000000","00000000000000000000","00000000000000000000",
  "11111111111111111111","00000000000100000001","00000000000100000001","00000000000100000001",
  "00000000000100000001","00000000000010000001","00000000000001000001","00000000000000111110",
];
for (let z = 0; z < mazeLayout.length; z++) {
  for (let x = 0; x < mazeLayout[z].length; x++) {
    if (mazeLayout[z][x] === "1") {
      const wall = new THREE.Mesh(mazeGeo, mazeMat);
      wall.position.set(x * 4 - 18, 1, z * 4 - 18);
      scene.add(wall);
      mazeWalls.push(wall);
    }
  }
}

const wallThickness = 2;
const halfThick     = wallThickness / 2;
const wallHeight    = 4;
function makeWall(w, h, t, x, y, z) {
  const mat  = new THREE.MeshStandardMaterial({ map: wallTexture });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
makeWall(bounds.maxX - bounds.minX, wallHeight, wallThickness,  0, wallHeight/2, bounds.maxZ - halfThick);
makeWall(bounds.maxX - bounds.minX, wallHeight, wallThickness,  0, wallHeight/2, bounds.minZ + halfThick);
makeWall(wallThickness,            wallHeight, bounds.maxZ - bounds.minZ, bounds.maxX - halfThick, wallHeight/2, 0);
makeWall(wallThickness,            wallHeight, bounds.maxZ - bounds.minZ, bounds.minX + halfThick, wallHeight/2, 0);

const pauseScreen = document.createElement('div');
pauseScreen.id = 'pauseScreen';
pauseScreen.style.cssText = `
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center;
  flex-direction: column; color: white; font-family: Arial, sans-serif; font-size: 24px;
`;
pauseScreen.innerHTML = `
  <div>Game Paused</div>
  <button id="resumeButton" style="margin-top: 20px; padding: 10px 20px; font-size: 18px; cursor: pointer;">Resume</button>
`;
document.body.appendChild(pauseScreen);

const keys = { w:false, a:false, s:false, d:false };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k] = true; }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k] = false; }
});

function checkCollision(pos, entity = null, isEnemy = false) {
  const radius = isEnemy ? ENEMY_RADIUS : PLAYER_RADIUS;
  for (const wall of mazeWalls) {
    const dx = Math.abs(pos.x - wall.position.x);
    const dz = Math.abs(pos.z - wall.position.z);
    // Wall size is 2x2, so half-size is 1
    if (dx < 1 + radius && dz < 1 + radius) {
      return true;
    }
  }
  if (isEnemy && entity) {
    const playerPos = controls.getObject().position;
    if (pos.distanceTo(playerPos) < ENEMY_RADIUS + PLAYER_RADIUS) {
      return true;
    }
    for (const other of enemies) {
      if (other !== entity && pos.distanceTo(other.position) < ENEMY_RADIUS * 2) {
        return true;
      }
    }
  }
  return false;
}

function updateMovement() {
  if (!controls.isLocked || isPaused) return;
  const dir   = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
  const next  = controls.getObject().position.clone();

  if (keys.w) next.addScaledVector(dir,  MOVE_SPEED);
  if (keys.s) next.addScaledVector(dir, -MOVE_SPEED);
  if (keys.a) next.addScaledVector(right, -MOVE_SPEED);
  if (keys.d) next.addScaledVector(right,  MOVE_SPEED);

  // Clamp inside walls
  const offset = halfThick + PLAYER_RADIUS;
  next.x = Math.max(bounds.minX + offset, Math.min(bounds.maxX - offset, next.x));
  next.z = Math.max(bounds.minZ + offset, Math.min(bounds.maxZ - offset, next.z));

  if (!checkCollision(next)) {
    controls.getObject().position.copy(next);
  }
}

function updateEnemyMovement(dt) {
  if (isPaused) return;
  enemies.forEach(enemy => {
    const target = enemy.userData.target;
    const toTarget = target.clone().sub(enemy.position).setY(0);
    const dist = toTarget.length();

    const nextPos = enemy.position.clone().addScaledVector(toTarget.clone().normalize(), ENEMY_SPEED * dt);
    if (dist < 0.5 || checkCollision(nextPos, enemy, true)) {
      let newTarget;
      let attempts = 0;
      do {
        newTarget = getRandomTarget();
        attempts++;
      } while (checkCollision(newTarget, enemy, true) && attempts < 10);
      enemy.userData.target = newTarget;
      return;
    }

    const speed = ENEMY_SPEED * (0.8 + Math.random() * 0.4);
    toTarget.normalize();
    const wander = new THREE.Vector3(
      Math.random() * 0.2 - 0.1,
      0,
      Math.random() * 0.2 - 0.1
    );
    toTarget.add(wander).normalize();
    const step = speed * dt;
    nextPos.copy(enemy.position).addScaledVector(toTarget, step);

    const offset = halfThick + ENEMY_RADIUS;
    nextPos.x = Math.max(bounds.minX + offset, Math.min(bounds.maxX - offset, nextPos.x));
    nextPos.z = Math.max(bounds.minZ + offset, Math.min(bounds.maxZ - offset, nextPos.z));

    if (!checkCollision(nextPos, enemy, true)) {
      enemy.position.copy(nextPos);
    }
  });
}

const gunshot   = new Audio('assets/audio/gunshot.mp3');
const bulletGeo = new THREE.SphereGeometry(0.2, 18, 18);
const bulletMat = new THREE.MeshStandardMaterial({
  color:0xe52b50, metalness:1, roughness:0.25,
  emissive:0xe52b50, emissiveIntensity:1
});
function isEnemyInSpotlight(enemy) {
  const angle = camera.getWorldDirection(new THREE.Vector3())
    .angleTo(enemy.position.clone().sub(camera.position).normalize());
  return angle < 0.2;
}
function shootBullet() {
  if (!controls.isLocked || isPaused) return;
  gunshot.currentTime = 0;
  const b = new THREE.Mesh(bulletGeo, bulletMat);
  const d = camera.getWorldDirection(new THREE.Vector3());
  b.position.copy(camera.position).add(d.clone().multiplyScalar(0.15));
  b.velocity = d.multiplyScalar(BULLET_SPEED);
  bullets.push(b);
  scene.add(b);
  bulletLight.position.copy(b.position);
}
document.addEventListener('click', shootBullet);
function updateBullets() {
  if (isPaused) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b    = bullets[i];
    const prev = b.position.clone();
    b.position.add(b.velocity);
    bulletLight.position.copy(b.position);

    const rc   = new THREE.Raycaster(prev, b.velocity.clone().normalize());
    const hits = rc.intersectObjects(enemies);
    if (hits.length && hits[0].distance <= b.velocity.length()) {
      if (isEnemyInSpotlight(hits[0].object)) {
        scene.remove(hits[0].object);
        enemies.splice(enemies.indexOf(hits[0].object), 1);
        enemyShotCount++;
        document.getElementById("counter").innerText = `Kills: ${enemyShotCount}`;
      }
      scene.remove(b);
      bullets.splice(i, 1);
      continue;
    }
    if (b.position.length() > 100) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }
}

function spawnPlayer() {
  controls.getObject().position.copy(INITIAL_SPAWN);
}

function createEnemies(count) {
  enemies.forEach(e => scene.remove(e));
  enemies.length = 0;

  for (let i = 0; i < count; i++) {
    let pos;
    let attempts = 0;
    do {
      pos = getRandomTarget();
      attempts++;
    } while (
      (pos.distanceTo(INITIAL_SPAWN) < SAFE_SPAWN_DISTANCE ||
       checkCollision(pos, null, true)) &&
      attempts < 50
    );

    const e = new THREE.Mesh(enemyGeometry, enemyMaterial);
    e.position.copy(pos);
    e.userData.target = getRandomTarget();
    scene.add(e);
    enemies.push(e);
  }
}

document.getElementById('startButton').addEventListener('click', () => {
  totalEnemies = parseInt(document.getElementById('enemyCount').value) || 20;
  document.getElementById('startScreen').style.display = "none";
  enemyShotCount = 0;
  gameOver      = false;
  isPaused      = false;
  startTime     = Date.now();
  document.getElementById("counter").innerText = "Kills: 0";
  document.getElementById("timer").innerText   = "Time: 0.00s";
  spawnPlayer();
  createEnemies(totalEnemies);
  controls.lock();
});

document.getElementById('restartButton').addEventListener('click', () => {
  document.getElementById('gameOverScreen').style.display = "none";
  document.getElementById('startScreen').style.display   = "flex";
  isPaused = false;
  spawnPlayer();
});

function pauseGame() {
  isPaused = true;
  controls.unlock();
  pauseScreen.style.display = 'flex';
}

function resumeGame() {
  isPaused = false;
  pauseScreen.style.display = 'none';
  controls.lock();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !gameOver) {
    pauseGame();
  }
});

window.addEventListener('blur', () => {
  if (!gameOver && !isPaused) {
    pauseGame();
  }
});

window.addEventListener('focus', () => {
  if (!gameOver && isPaused) {
    pauseScreen.style.display = 'flex';
  }
});

document.body.addEventListener('click', (e) => {
  if (e.target.id === 'resumeButton') {
    resumeGame();
  }
});

const enemySpotlight   = new THREE.SpotLight(0x66ff00, 50, 100, 0.02, 0.1);
scene.add(enemySpotlight);
const crosshairTarget  = new THREE.Object3D();
scene.add(crosshairTarget);
enemySpotlight.target  = crosshairTarget;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (!gameOver && !isPaused) {
    updateBullets();
    updateEnemyMovement(delta);
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      document.getElementById("timer").innerText = `Time: ${elapsed.toFixed(2)}s`;
      if (enemies.length === 0) {
        gameOver = true;
        document.getElementById("finalStats").innerText =
          `Final Time: ${elapsed.toFixed(2)}s\nKills: ${enemyShotCount}`;
        document.getElementById("gameOverScreen").style.display = "flex";
      }
    }
    updateMovement();
  }

  enemySpotlight.position.copy(camera.position);
  const dir = camera.getWorldDirection(new THREE.Vector3());
  crosshairTarget.position.copy(camera.position).add(dir.multiplyScalar(50));

  renderer.render(scene, camera);
}

animate();
