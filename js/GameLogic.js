import * as THREE from 'three';

class GameLogic {
  constructor(scene, camera, player, enemy, uiManager) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.enemy = enemy;
    this.uiManager = uiManager;
    this.bullets = [];
    this.enemyShotCount = 0;
    this.totalEnemies = 20;
    this.clock = new THREE.Clock();
    this.startTime = null;
    this.gameOver = false;
    this.setupShooting();
    this.setupUIManager();
  }

  setupUIManager() {
    this.uiManager.setOnStart((totalEnemies) => {
      this.totalEnemies = totalEnemies;
      this.enemyShotCount = 0;
      this.player.spawnPlayer(this.enemy.mazeGrid, this.enemy.offsetX, this.enemy.offsetZ, this.checkCollision.bind(this));
      this.enemy.createEnemies(this.totalEnemies, this.checkCollision.bind(this));
      this.startTime = Date.now();
      this.gameOver = false;
    });

    this.uiManager.setOnRestart(() => {
      this.player.spawnPlayer(this.enemy.mazeGrid, this.enemy.offsetX, this.enemy.offsetZ, this.checkCollision.bind(this));
    });
  }

  setupShooting() {
    const bulletGeo = new THREE.SphereGeometry(0.2, 18, 18);
    const bulletMat = new THREE.MeshStandardMaterial({
      color: 0xe52b50, metalness: 1, roughness: 0.25,
      emissive: 0xe52b50, emissiveIntensity: 1
    });
    const gunshot = new Audio('assets/audio/gunshot.mp3');
    const hitSound = new Audio('assets/audio/hit.mp3');

    document.addEventListener('click', () => {
      if (!this.player.controls.isLocked || this.uiManager.isPaused) return;
      gunshot.currentTime = 0;
      gunshot.play().catch(() => {});

      const raycaster = new THREE.Raycaster();
      raycaster.set(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
      const hits = raycaster.intersectObjects(this.enemy.enemies);
      if (hits.length > 0) {
        const enemy = hits[0].object;
        const originalColor = enemy.material.color.getHex();
        enemy.material.color.setHex(0xff0000);
        hitSound.currentTime = 0;
        hitSound.play().catch(() => {});
        setTimeout(() => {
          this.scene.remove(enemy);
          this.enemy.enemies.splice(this.enemy.enemies.indexOf(enemy), 1);
          this.enemyShotCount++;
          this.uiManager.updateKills(this.enemyShotCount);
        }, 100);
      }

      const b = new THREE.Mesh(bulletGeo, bulletMat);
      const d = this.camera.getWorldDirection(new THREE.Vector3());
      const muzzleWorld = this.player.gunModel
        ? new THREE.Vector3().setFromMatrixPosition(this.player.gunModel.matrixWorld)
        : this.camera.position.clone();
      b.position.copy(muzzleWorld).add(d.clone().multiplyScalar(0.8));
      b.velocity = d.multiplyScalar(7);
      this.bullets.push(b);
      this.scene.add(b);
    });
  }

  updateBullets() {
    if (this.uiManager.isPaused) return;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.position.add(b.velocity);
      if (b.position.length() > 100) {
        this.scene.remove(b);
        this.bullets.splice(i, 1);
      }
    }
  }

  checkCollision(pos, entity = null, isEnemy = false) {
    const r = isEnemy ? 1 : 0.5;
    for (const wall of this.mazeWalls) {
      const dx = Math.abs(pos.x - wall.position.x),
            dz = Math.abs(pos.z - wall.position.z);
      if (dx < 2 + r && dz < 2 + r) return true;
    }
    if (isEnemy && entity) {
      const pp = this.player.controls.getObject().position;
      if (pos.distanceTo(pp) < 1 + 0.5) return true;
      for (const o of this.enemy.enemies) {
        if (o !== entity && pos.distanceTo(o.position) < 1 * 2) return true;
      }
    } else if (!isEnemy) {
      for (const e of this.enemy.enemies) {
        if (pos.distanceTo(e.position) < 0.5 + 1) return true;
      }
    }
    return false;
  }

  updateGameState() {
    if (this.startTime !== null) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.uiManager.updateTimer(elapsed);
      if (this.enemy.enemies.length === 0 && !this.gameOver) {
        this.gameOver = true;
        this.uiManager.showGameOver(elapsed, this.enemyShotCount);
      }
    }
  }
}

export { GameLogic };
