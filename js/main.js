
// main.js

import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { MathUtils } from './MathUtils.js';

//
// ————— Constants —————
//
const INITIAL_SPAWN       = new THREE.Vector3(0, 2, 10);
const SAFE_SPAWN_DISTANCE = 15;
const MOVE_SPEED          = 0.2;
const BULLET_SPEED        = 7;
const ENEMY_SPEED         = 1.0;
const ENEMY_RADIUS        = 1;
const PLAYER_RADIUS       = 0.5;
const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

//
// ————— Maze Generator with Rooms & Loops —————
//

// perfect‐maze using Prim’s algorithm
function generatePerfectMaze(rows, cols) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const walls = [];
  const start = { r: 1, c: 1 };
  grid[start.r][start.c] = 0;
  [[2,0],[-2,0],[0,2],[0,-2]].forEach(([dr,dc]) => {
    walls.push({ r: start.r+dr, c: start.c+dc, pr: start.r, pc: start.c });
  });
  while (walls.length) {
    const idx = Math.floor(Math.random()*walls.length);
    const { r, c, pr, pc } = walls.splice(idx,1)[0];
    if (r<1||c<1||r>=rows-1||c>=cols-1) continue;
    if (grid[r][c]===1) {
      grid[pr + (r-pr)/2][pc + (c-pc)/2] = 0;
      grid[r][c] = 0;
      [[2,0],[-2,0],[0,2],[0,-2]].forEach(([dr,dc]) => {
        walls.push({ r:r+dr, c:c+dc, pr:r, pc:c });
      });
    }
  }
  return grid;
}

// carve a few loops by removing interior walls
function carveLoops(grid, rows, cols, percent=0.02) {
  const loops = Math.floor(rows*cols*percent);
  for (let i=0;i<loops;i++) {
    let attempts=0;
    while (attempts<50) {
      const r = 1 + Math.floor(Math.random()*(rows-2));
      const c = 1 + Math.floor(Math.random()*(cols-2));
      if (grid[r][c]===1 &&
          ((grid[r-1][c]===0 && grid[r+1][c]===0) ||
           (grid[r][c-1]===0 && grid[r][c+1]===0))) {
        grid[r][c] = 0;
        break;
      }
      attempts++;
    }
  }
}

// carve some random rectangular rooms
function carveRooms(grid, rows, cols, roomCount=5) {
  for (let i=0;i<roomCount;i++) {
    const roomW = 3 + 2*Math.floor(Math.random()*3); // 3,5,7
    const roomH = 3 + 2*Math.floor(Math.random()*3);
    const r0 = 1 + Math.floor(Math.random()*(rows-roomH-2));
    const c0 = 1 + Math.floor(Math.random()*(cols-roomW-2));
    for (let rr=r0; rr<r0+roomH; rr++) {
      for (let cc=c0; cc<c0+roomW; cc++) {
        grid[rr][cc] = 0;
      }
    }
  }
}

// full generator: perfect maze + loops + rooms
function generateMazeWithFeatures(rows, cols) {
  const grid = generatePerfectMaze(rows, cols);
  carveLoops(grid, rows, cols, 0.03);
  carveRooms(grid, rows, cols, Math.floor((rows*cols)/200));
  return grid;
}

//
// ————— Scene Setup —————
//
const textureLoader = new THREE.TextureLoader();
const enemyTexture  = textureLoader.load('assets/alien.jpg');
const groundTexture = textureLoader.load('assets/floor.jpg');
const mazeTexture   = textureLoader.load('assets/maze.jpg');
const wallTexture   = textureLoader.load('assets/wall.png');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
camera.position.copy(INITIAL_SPAWN);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio,1));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('threejsContainer').appendChild(renderer.domElement);

// sky
const sky = new Sky();
sky.scale.setScalar(450000);
const phi   = MathUtils.degToRad(90), theta = MathUtils.degToRad(180);
sky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1,phi,theta);
scene.add(sky);

// lights
scene.add(new THREE.AmbientLight(0xffffff,0.05));
const dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(10,20,10);
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1));
const bulletLight = new THREE.PointLight(0xffffff,1,10);
scene.add(bulletLight);

// controls
const controls = new PointerLockControls(camera, renderer.domElement);
const ui       = document.getElementById('ui');
let isPaused   = false;
ui.addEventListener('click',() => { if(!isPaused) controls.lock(); });
document.addEventListener('keydown', e => {
  if(e.key==='Backspace' && !isPaused) controls.lock();
});
controls.addEventListener('lock',  ()=> ui.classList.add('disabled'));
controls.addEventListener('unlock',()=> ui.classList.remove('disabled'));
scene.add(controls.getObject());

// ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(bounds.maxX-bounds.minX, bounds.maxZ-bounds.minZ),
  new THREE.MeshStandardMaterial({ map:groundTexture })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

//
// ————— Dynamic Maze Construction —————
const mazeWalls = [];
const mazeMat   = new THREE.MeshStandardMaterial({ map:mazeTexture });
const mazeGeo   = new THREE.BoxGeometry(2,2,2);

const cellSize = 4;
let cols = Math.floor((bounds.maxX-bounds.minX)/cellSize);
let rows = Math.floor((bounds.maxZ-bounds.minZ)/cellSize);
if (cols%2===0) cols--;
if (rows%2===0) rows--;

const mazeGrid = generateMazeWithFeatures(rows, cols);
const offsetX = bounds.minX + ((bounds.maxX-bounds.minX) - (cols-1)*cellSize)/2;
const offsetZ = bounds.minZ + ((bounds.maxZ-bounds.minZ) - (rows-1)*cellSize)/2;

for (let r=0; r<rows; r++) {
  for (let c=0; c<cols; c++) {
    if (mazeGrid[r][c] === 1) {
      const wall = new THREE.Mesh(mazeGeo, mazeMat);
      wall.position.set(
        offsetX + c*cellSize,
        1,
        offsetZ + r*cellSize
      );
      scene.add(wall);
      mazeWalls.push(wall);
    }
  }
}

//
// ————— Boundary Walls —————
const wallThickness = 2, halfThick = wallThickness/2, wallHeight = 4;
function makeWall(w,h,t,x,y,z) {
  const mat = new THREE.MeshStandardMaterial({ map:wallTexture });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,t), mat);
  mesh.position.set(x,y,z);
  scene.add(mesh);
}
makeWall(bounds.maxX-bounds.minX, wallHeight, wallThickness,  0, wallHeight/2, bounds.maxZ-halfThick);
makeWall(bounds.maxX-bounds.minX, wallHeight, wallThickness,  0, wallHeight/2, bounds.minZ+halfThick);
makeWall(wallThickness, wallHeight, bounds.maxZ-bounds.minZ, bounds.maxX-halfThick, wallHeight/2, 0);
makeWall(wallThickness, wallHeight, bounds.maxZ-bounds.minZ, bounds.minX+halfThick, wallHeight/2, 0);

//
// ————— Pause Screen —————
const pauseScreen = document.createElement('div');
pauseScreen.id = 'pauseScreen';
pauseScreen.style.cssText = `
  position:absolute;top:0;left:0;width:100%;height:100%;
  background:rgba(0,0,0,0.7);display:none;justify-content:center;
  align-items:center;flex-direction:column;color:white;
  font-family:Arial,sans-serif;font-size:24px;
`;
pauseScreen.innerHTML = `
  <div>Game Paused</div>
  <button id="resumeButton" style="
    margin-top:20px;padding:10px 20px;font-size:18px;cursor:pointer;
  ">Resume</button>
`;
document.body.appendChild(pauseScreen);

//
// ————— Input Handling —————
const keys = { w:false, a:false, s:false, d:false };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k]=true; }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) { e.preventDefault(); keys[k]=false; }
});

//
// ————— Collision Detection —————
function checkCollision(pos, entity=null, isEnemy=false) {
  const radius = isEnemy ? ENEMY_RADIUS : PLAYER_RADIUS;
  for (const wall of mazeWalls) {
    const dx = Math.abs(pos.x - wall.position.x);
    const dz = Math.abs(pos.z - wall.position.z);
    if (dx < 1 + radius && dz < 1 + radius) return true;
  }
  if (isEnemy && entity) {
    const playerPos = controls.getObject().position;
    if (pos.distanceTo(playerPos) < ENEMY_RADIUS+PLAYER_RADIUS) return true;
    for (const other of enemies) {
      if (other!==entity && pos.distanceTo(other.position) < ENEMY_RADIUS*2) return true;
    }
  } else if (!isEnemy) {
    for (const enemy of enemies) {
      if (pos.distanceTo(enemy.position) < PLAYER_RADIUS+ENEMY_RADIUS) return true;
    }
  }
  return false;
}

//
// ————— Movement & Game Logic —————
function updateMovement() {
  if (!controls.isLocked || isPaused) return;
  const dir   = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
  const next  = controls.getObject().position.clone();
  if (keys.w) next.addScaledVector(dir,  MOVE_SPEED);
  if (keys.s) next.addScaledVector(dir, -MOVE_SPEED);
  if (keys.a) next.addScaledVector(right, -MOVE_SPEED);
  if (keys.d) next.addScaledVector(right,  MOVE_SPEED);
  const offset = halfThick + PLAYER_RADIUS;
  next.x = Math.max(bounds.minX+offset, Math.min(bounds.maxX-offset, next.x));
  next.z = Math.max(bounds.minZ+offset, Math.min(bounds.maxZ-offset, next.z));
  if (!checkCollision(next)) controls.getObject().position.copy(next);
}

function updateEnemyMovement(dt) {
  if (isPaused) return;
  enemies.forEach(enemy => {
    const target   = enemy.userData.target;
    const toTarget = target.clone().sub(enemy.position).setY(0);
    const dist     = toTarget.length();
    const nextPos  = enemy.position.clone().addScaledVector(toTarget.clone().normalize(), ENEMY_SPEED*dt);
    if (dist<0.5 || checkCollision(nextPos,enemy,true)) {
      let newT, at=0;
      do { newT = getRandomTarget(); at++; }
      while(checkCollision(newT,enemy,true)&&at<10);
      enemy.userData.target = newT;
      return;
    }
    const speed = ENEMY_SPEED*(0.8+Math.random()*0.4);
    toTarget.normalize();
    const wander = new THREE.Vector3(Math.random()*0.2-0.1,0,Math.random()*0.2-0.1);
    toTarget.add(wander).normalize();
    nextPos.copy(enemy.position).addScaledVector(toTarget, speed*dt);
    nextPos.x = Math.max(bounds.minX+halfThick+ENEMY_RADIUS, Math.min(bounds.maxX-halfThick-ENEMY_RADIUS, nextPos.x));
    nextPos.z = Math.max(bounds.minZ+halfThick+ENEMY_RADIUS, Math.min(bounds.maxZ-halfThick-ENEMY_RADIUS, nextPos.z));
    if (!checkCollision(nextPos,enemy,true)) enemy.position.copy(nextPos);
  });
}

const bullets = [];
const gunshot = new Audio('assets/audio/gunshot.mp3');
const bulletGeo = new THREE.SphereGeometry(0.2,18,18);
const bulletMat = new THREE.MeshStandardMaterial({
  color:0xe52b50, metalness:1, roughness:0.25,
  emissive:0xe52b50, emissiveIntensity:1
});

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
  for (let i=bullets.length-1; i>=0; i--) {
    const b = bullets[i], prev = b.position.clone();
    b.position.add(b.velocity);
    bulletLight.position.copy(b.position);
    const rc = new THREE.Raycaster(prev, b.velocity.clone().normalize());
    const hits = rc.intersectObjects(enemies);
    if (hits.length && hits[0].distance <= b.velocity.length()) {
      if (camera.getWorldDirection(new THREE.Vector3())
          .angleTo(hits[0].object.position.clone().sub(camera.position).normalize())<0.2) {
        scene.remove(hits[0].object);
        enemies.splice(enemies.indexOf(hits[0].object),1);
        enemyShotCount++;
        document.getElementById("counter").innerText = `Kills: ${enemyShotCount}`;
      }
      scene.remove(b);
      bullets.splice(i,1);
      continue;
    }
    if (b.position.length()>100) {
      scene.remove(b);
      bullets.splice(i,1);
    }
  }
}

function getRandomTarget() {
  const pad = ENEMY_RADIUS+1;
  const x = Math.random()*(bounds.maxX-bounds.minX-pad*2)+bounds.minX+pad;
  const z = Math.random()*(bounds.maxZ-bounds.minZ-pad*2)+bounds.minZ+pad;
  return new THREE.Vector3(x,1,z);
}

function spawnPlayer() {
  controls.getObject().position.copy(INITIAL_SPAWN);
}

const enemies = [];
let enemyShotCount = 0, totalEnemies = 20;

function createEnemies(count) {
  enemies.forEach(e=>scene.remove(e));
  enemies.length=0;
  for (let i=0;i<count;i++) {
    let pos, at=0;
    do { pos = getRandomTarget(); at++; }
    while((pos.distanceTo(INITIAL_SPAWN)<SAFE_SPAWN_DISTANCE||checkCollision(pos,null,true))&&at<50);
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

document.getElementById('startButton').addEventListener('click',()=>{
  totalEnemies = parseInt(document.getElementById('enemyCount').value)||20;
  document.getElementById('startScreen').style.display="none";
  enemyShotCount=0; isPaused=false;
  document.getElementById("counter").innerText="Kills: 0";
  document.getElementById("timer").innerText="Time: 0.00s";
  spawnPlayer(); createEnemies(totalEnemies);
  controls.lock();
});

document.getElementById('restartButton').addEventListener('click',()=>{
  document.getElementById('gameOverScreen').style.display="none";
  document.getElementById('startScreen').style.display="flex";
  isPaused=false; spawnPlayer();
});

function pauseGame() {
  isPaused=true; controls.unlock(); pauseScreen.style.display='flex';
}
function resumeGame() {
  isPaused=false; pauseScreen.style.display='none'; controls.lock();
}
document.getElementById('resumeButton').addEventListener('click', resumeGame);
document.addEventListener('visibilitychange',()=> { if(document.hidden&&!isPaused) pauseGame(); });
window.addEventListener('blur', ()=>{ if(!isPaused) pauseGame(); });
window.addEventListener('focus',()=>{ if(isPaused) pauseScreen.style.display='flex'; });

const enemySpotlight  = new THREE.SpotLight(0x66ff00,50,100,0.02,0.1);
const crosshairTarget = new THREE.Object3D();
scene.add(enemySpotlight); scene.add(crosshairTarget);
enemySpotlight.target=crosshairTarget;

const clock = new THREE.Clock();
let startTime=null, gameOver=false;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (!isPaused) {
    updateBullets();
    updateEnemyMovement(dt);
    updateMovement();
    if (startTime!==null) {
      const elapsed=(Date.now()-startTime)/1000;
      document.getElementById("timer").innerText=`Time: ${elapsed.toFixed(2)}s`;
      if (enemies.length===0 && !gameOver) {
        gameOver=true;
        document.getElementById("finalStats").innerText=
          `Final Time: ${elapsed.toFixed(2)}s\nKills: ${enemyShotCount}`;
        document.getElementById("gameOverScreen").style.display="flex";
      }
    }
  }
  enemySpotlight.position.copy(camera.position);
  crosshairTarget.position.copy(
    camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(50))
  );
  renderer.render(scene,camera);
}

animate();

