import * as THREE from 'three';
import { bounds } from './SceneSetup.js';

const textureLoader = new THREE.TextureLoader();
const enemyTexture = textureLoader.load('assets/steampunk_gears.png');

const enemyGeo = new THREE.CapsuleGeometry(1, 1.5, 4, 8);
const enemyMat = new THREE.MeshStandardMaterial({
  color: 0x8888ff,
  metalness: 0.6,
  roughness: 0.4,
  map: enemyTexture,
  emissive: 0x222222,
  emissiveIntensity: 0.2
});

const ENEMY_SPEED = 1.0;
const ENEMY_RADIUS = 1;
const SAFE_SPAWN_DISTANCE = 10;

class Enemy {
  constructor(scene, mazeGrid, offsetX, offsetZ, playerPosition) {
    this.scene = scene;
    this.mazeGrid = mazeGrid;
    this.offsetX = offsetX;
    this.offsetZ = offsetZ;
    this.playerPosition = playerPosition;
    this.enemies = [];
  }

  getRandomTarget() {
    const empty = [];
    this.mazeGrid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell === 0) empty.push({ r, c });
      });
    });
    if (!empty.length) return new THREE.Vector3(0, 1, 0);
    const pick = empty[Math.floor(Math.random() * empty.length)];
    return new THREE.Vector3(
      this.offsetX + pick.c * 4 + (Math.random() - 0.5) * 2,
      1,
      this.offsetZ + pick.r * 4 + (Math.random() - 0.5) * 2
    );
  }

  createEnemies(count, checkCollision) {
    this.enemies.forEach(e => this.scene.remove(e));
    this.enemies.length = 0;
    const empty = [];
    this.mazeGrid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell === 0) empty.push({ r, c });
      });
    });
    let attempts = 0;
    while (this.enemies.length < count && attempts < count * 5) {
      attempts++;
      const pick = empty[Math.floor(Math.random() * empty.length)];
      const pos = new THREE.Vector3(
        this.offsetX + pick.c * 4 + (Math.random() - 0.5) * 2,
        1,
        this.offsetZ + pick.r * 4 + (Math.random() - 0.5) * 2
      );
      if (pos.distanceTo(this.playerPosition) < SAFE_SPAWN_DISTANCE) continue;
      if (checkCollision(pos, null, true)) continue;
      const enemy = new THREE.Mesh(enemyGeo, enemyMat.clone());
      enemy.position.copy(pos);
      enemy.userData.target = this.getRandomTarget();
      this.scene.add(enemy);
      this.enemies.push(enemy);
    }
  }

  updateEnemyMovement(dt, checkCollision, isPaused) {
    if (isPaused) return;
    this.enemies.forEach(enemy => {
      const target = enemy.userData.target.clone().sub(enemy.position).setY(0);
      const dist = target.length();
      const nextPos = enemy.position.clone().addScaledVector(target.clone().normalize(), ENEMY_SPEED * dt);
      if (dist < 0.5 || checkCollision(nextPos, enemy, true)) {
        let attempts = 0, newT;
        do {
          newT = this.getRandomTarget();
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
}

export { Enemy, ENEMY_RADIUS };
