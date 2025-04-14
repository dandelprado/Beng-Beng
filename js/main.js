import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { MathUtils } from './MathUtils.js';
import { OrbitControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/OrbitControls.js';


let enemyShotCount = 0;
let startTime = null;
let gameOver = false;
let totalEnemies = 20;
const enemies = [];
const bullets = [];


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);

setInterval(() => {
  enemies.forEach(enemy => {
    enemy.position.set(
      Math.random() * 50 - 25,
      1,
      Math.random() * 50 - 25
    );
  });
}, 5000);

setInterval(() => {
  enemies.forEach(enemy => {
    enemy.visible = !enemy.visible;
  });
}, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('threejsContainer').appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.minDistance = 0;
orbitControls.maxDistance = 500;
orbitControls.maxPolarAngle = Math.PI / 2;
orbitControls.update();

const sky = new Sky();
sky.scale.setScalar(450000);
const phi = MathUtils.degToRad(90);
const theta = MathUtils.degToRad(180);
const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
sky.material.uniforms['sunPosition'].value.copy(sunPosition);
scene.add(sky);

const controls = new PointerLockControls(camera, renderer.domElement);
document.getElementById('ui').addEventListener('click', () => {
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Backspace') {
    controls.lock();
  }
});
controls.addEventListener('lock', () => {
  const uiElement = document.getElementById('ui');
  if (uiElement) uiElement.classList.add('disabled');
  orbitControls.enabled = false;
});
controls.addEventListener('unlock', () => {
  const uiElement = document.getElementById('ui');
  if (uiElement) uiElement.classList.remove('disabled');
  orbitControls.enabled = true;
});
scene.add(controls.getObject());

/*const textureLoader1 = new THREE.TextureLoader();
const floorTexture = textureLoader1.load('assets/floor.jpg');
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1;
floor.receiveShadow = true;
scene.add(floor);
*/

const groundTexture = new THREE.TextureLoader().load('assets/floor.jpg');
const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemiLight);
const bulletLight = new THREE.PointLight(0xffffff, 1, 10);
scene.add(bulletLight);

const textureLoader2 = new THREE.TextureLoader();
const enemyTexture = textureLoader2.load('assets/alien.jpg');
const enemyGeometry = new THREE.BoxGeometry(2, 2, 2);
const enemyMaterial = new THREE.MeshStandardMaterial({
  color: 0x43cd80,
  map: enemyTexture,
});

const textureLoader3 = new THREE.TextureLoader();
const mazeTexture = textureLoader3.load('assets/maze.jpg');
const mazeMaterial = new THREE.MeshStandardMaterial({ map: mazeTexture });

const mazeWalls = [];
const mazeWallGeometry = new THREE.BoxGeometry(2, 2, 2);

const mazeLayout = [
  "00111111111111111100",
  "01000000000000000010",
  "10000000000000000001",
  "10000000000000000001",
  "10000000000000000001",
  "10000000000000000001",
  "11111111111111111111",
  "00000000000000000000",
  "00000000000000000000",
  "00000000000000000000",
  "00000000000000000000",
  "00000000000000000000",
  "11111111111111111111",
  "00000000000100000001",
  "00000000000100000001",
  "00000000000100000001",
  "00000000000100000001",
  "00000000000010000001",
  "00000000000001000001",
  "00000000000000111110",
];

for (let z = 0; z < mazeLayout.length; z++) {
    for (let x = 0; x < mazeLayout[z].length; x++) {
      if (mazeLayout[z][x] === "1") {
        const wall = new THREE.Mesh(mazeWallGeometry, mazeMaterial);
        wall.position.set(x * 4 - 18, 1, z * 4 - 18);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        mazeWalls.push(wall);
        console.log('Wall at: (${wall.position.x}, ${wall.position.y}, ${wall.position.z})');
      }
    }
}

const textureLoaderWall = new THREE.TextureLoader();
const wallTexture = textureLoaderWall.load('assets/wall.png');
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);
const wallHeight = 20;
const wallThickness = 2;
const bounds = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
const northSouthWallWidth = bounds.maxX - bounds.minX;
const eastWestWallWidth = bounds.maxZ - bounds.minZ;
const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });

const northWallGeometry = new THREE.BoxGeometry(northSouthWallWidth, wallHeight, wallThickness);
const northWall = new THREE.Mesh(northWallGeometry, wallMaterial);
northWall.position.set(0, (wallHeight - 1) / 2, bounds.maxZ - wallThickness);
scene.add(northWall);

const southWallGeometry = new THREE.BoxGeometry(northSouthWallWidth, wallHeight, wallThickness);
const southWall = new THREE.Mesh(southWallGeometry, wallMaterial);
southWall.position.set(0, (wallHeight - 1) / 2, bounds.minZ + wallThickness);
scene.add(southWall);

const eastWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, eastWestWallWidth);
const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
eastWall.position.set(bounds.maxX - wallThickness, (wallHeight - 1) / 2, 0);
scene.add(eastWall);

const westWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, eastWestWallWidth);
const westWall = new THREE.Mesh(westWallGeometry, wallMaterial);
westWall.position.set(bounds.minX + wallThickness, (wallHeight - 1) / 2, 0);
scene.add(westWall);

const moveSpeed = 0.2;
const keys = { w: false, a: false, s: false, d: false };

document.addEventListener('keydown', (event) => {
  if (keys.hasOwnProperty(event.key.toLowerCase())) {
    keys[event.key.toLowerCase()] = true;
  }
});
document.addEventListener('keyup', (event) => {
  if (keys.hasOwnProperty(event.key.toLowerCase())) {
    keys[event.key.toLowerCase()] = false;
  }
});

function checkCollision(newPosition) {
  for (const wall of mazeWalls) {
    if (newPosition.distanceTo(wall.position) < 2) {
      return true;
    }
  }
  return false;
}

/*function updateMovement() {
  if (!controls.isLocked) return;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  //const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();

  const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

  const newPosition = controls.getObject().position.clone();

  if (keys.w) newPosition.addScaledVector(direction, moveSpeed);
  if (keys.s) newPosition.addScaledVector(direction, -moveSpeed);
  if (keys.a) newPosition.addScaledVector(right, moveSpeed);
  if (keys.d) newPosition.addScaledVector(right, -moveSpeed);


  const playerRadius = 2;
  newPosition.x = Math.max(bounds.minX + playerRadius, Math.min(bounds.maxX - playerRadius, newPosition.x));
  newPosition.z = Math.max(bounds.minZ + playerRadius, Math.min(bounds.maxZ - playerRadius, newPosition.z));

  if (!checkCollision(newPosition)) {
    controls.getObject().position.copy(newPosition);
  }

}
*/


function updateMovement() {
  if (!controls.isLocked) return;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

  const newPosition = controls.getObject().position.clone();

  if (keys.w) newPosition.addScaledVector(direction, moveSpeed);
  if (keys.s) newPosition.addScaledVector(direction, -moveSpeed);
  if (keys.a) newPosition.addScaledVector(right, -moveSpeed); 
  if (keys.d) newPosition.addScaledVector(right, moveSpeed);

  const playerRadius = 2;
  newPosition.x = Math.max(bounds.minX + playerRadius, Math.min(bounds.maxX - playerRadius, newPosition.x));
  newPosition.z = Math.max(bounds.minZ + playerRadius, Math.min(bounds.maxZ - playerRadius, newPosition.z));

  if (!checkCollision(newPosition)) {
    controls.getObject().position.copy(newPosition);
  }
}

const gunshotSound = new Audio('assets/audio/gunshot.mp3');
const bulletSpeed = 7;
const bulletGeometry = new THREE.SphereGeometry(0.2, 18, 18);
const bulletMaterial = new THREE.MeshStandardMaterial({
  color: 0xe52b50,
  metalness: 1,
  roughness: 0.25,
  emissive: 0xe52b50,
  emissiveIntensity: 1,
});

function isEnemyInSpotlight(enemy) {
  const angle = camera.getWorldDirection(new THREE.Vector3())
    .angleTo(enemy.position.clone().sub(camera.position).normalize());
  return angle < 0.2;
}

function shootBullet() {
  if (!controls.isLocked) return;

  gunshotSound.currentTime = 0;
//  gunshotSound.play();

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  bullet.position.copy(camera.position).add(direction.multiplyScalar(0.15));
  bullet.velocity = new THREE.Vector3().copy(direction).multiplyScalar(bulletSpeed);

  bullets.push(bullet);
  scene.add(bullet);
  bulletLight.position.copy(bullet.position);

  console.log("Bullet fired", bullet.position);
}

document.addEventListener('click', shootBullet);

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const prevPosition = bullets[i].position.clone();
    bullets[i].position.add(bullets[i].velocity);
    bulletLight.position.copy(bullets[i].position);

    const direction = bullets[i].velocity.clone().normalize();
    const raycaster = new THREE.Raycaster(prevPosition, direction);
    const frameDistance = bullets[i].velocity.length();
    const intersects = raycaster.intersectObjects(enemies);

    if (intersects.length > 0 && intersects[0].distance <= frameDistance) {
      if (isEnemyInSpotlight(intersects[0].object)) {
        scene.remove(intersects[0].object);
        enemies.splice(enemies.indexOf(intersects[0].object), 1);
        enemyShotCount++;
        document.getElementById("counter").innerText = "Kills: " + enemyShotCount;
        scene.remove(bullets[i]);
        bullets.splice(i, 1);
        continue;
      }
    }

    if (bullets[i] && bullets[i].position.length() > 100) {
      scene.remove(bullets[i]);
      bullets.splice(i, 1);
    }
  }
}

document.getElementById('startButton').addEventListener('click', () => {
  totalEnemies = parseInt(document.getElementById('enemyCount').value) || 20;
  document.getElementById('startScreen').style.display = "none";
  enemyShotCount = 0;
  gameOver = false;
  startTime = Date.now();
  document.getElementById("counter").innerText = "Kills: 0";
  document.getElementById("timer").innerText = "Time: 0.00s";
  createEnemies(totalEnemies);
  controls.lock();
});

function createEnemies(count) {
  enemies.forEach(enemy => scene.remove(enemy));
  enemies.length = 0;
  
  for (let i = 0; i < count; i++) {
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    enemy.position.set(Math.random() * 50 - 25, 1, Math.random() * 50 - 25);
    scene.add(enemy);
    enemies.push(enemy);
  }
}

document.getElementById('restartButton').addEventListener('click', () => {
  document.getElementById('gameOverScreen').style.display = "none";
  document.getElementById('startScreen').style.display = "flex";
});

const enemySpotlight = new THREE.SpotLight(0x66ff00);
enemySpotlight.angle = 0.02;
enemySpotlight.penumbra = 0.1;
enemySpotlight.distance = 100;
enemySpotlight.intensity = 50;
scene.add(enemySpotlight);

const crosshairTarget = new THREE.Object3D();
scene.add(crosshairTarget);
enemySpotlight.target = crosshairTarget;

controls.getObject().position.set(0, 2, 10);

function animate() {
  requestAnimationFrame(animate);

  orbitControls.enabled = !controls.isLocked;
  orbitControls.update();
  
  if (!gameOver) {
    updateBullets();
    if (startTime) {
      let elapsed = (Date.now() - startTime) / 1000;
      document.getElementById("timer").innerText = "Time: " + elapsed.toFixed(2) + "s";
      if (enemies.length === 0) {
        gameOver = true;
        document.getElementById("finalStats").innerText = "Final Time: " + elapsed.toFixed(2) + "s\nKills: " + enemyShotCount;
        document.getElementById("gameOverScreen").style.display = "flex";
      }
    }
    updateMovement();
  }
  
  enemySpotlight.position.copy(camera.position);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  crosshairTarget.position.copy(camera.position).add(direction.multiplyScalar(50));
  renderer.render(scene, camera);
}

animate();
