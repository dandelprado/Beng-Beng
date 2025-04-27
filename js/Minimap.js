import * as THREE from 'three';
import { bounds } from './SceneSetup.js';

class Minimap {
  constructor(scene, mazeGrid, offsetX, offsetZ) {
    this.MINIMAP_LAYER = 1;
    this.minimapObjects = new THREE.Group();
    scene.add(this.minimapObjects);

    this.minimapWallMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
    this.minimapPlatformMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    this.minimapPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.minimapEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.minimapEnemyBorderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    this.setupMinimap(mazeGrid, offsetX, offsetZ);
    this.playerMarker = this.createPlayerMarker();
    this.enemyMarkers = [];
  }

  setupMinimap(mazeGrid, offsetX, offsetZ) {
    const minimapWallGeo = new THREE.PlaneGeometry(4, 4);
    for (let r = 0; r < mazeGrid.length; r++) {
      for (let c = 0; c < mazeGrid[0].length; c++) {
        const cell = mazeGrid[r][c];
        if (cell === 1 || cell === 2) {
          const mesh = new THREE.Mesh(
            minimapWallGeo,
            cell === 1 ? this.minimapWallMaterial : this.minimapPlatformMaterial
          );
          mesh.position.set(offsetX + c * 4, 0.1, offsetZ + r * 4);
          mesh.rotation.x = -Math.PI / 2;
          mesh.layers.set(this.MINIMAP_LAYER);
          this.minimapObjects.add(mesh);
        }
      }
    }

    const t = 2, half = t / 2;
    const addBoundary = (w, th, x, z) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, th), this.minimapWallMaterial);
      mesh.position.set(x, 0.1, z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.layers.set(this.MINIMAP_LAYER);
      this.minimapObjects.add(mesh);
    };
    addBoundary(bounds.maxX - bounds.minX, t, 0, bounds.maxZ - half);
    addBoundary(bounds.maxX - bounds.minX, t, 0, bounds.minZ + half);
    addBoundary(t, bounds.maxZ - bounds.minZ, bounds.maxX - half, 0, 0);
    addBoundary(t, bounds.maxZ - bounds.minZ, bounds.minX + half, 0, 0);

    const backgroundGeo = new THREE.PlaneGeometry(bounds.maxX - bounds.minX + 10, bounds.maxZ - bounds.minZ + 10);
    const backgroundMat = new THREE.MeshBasicMaterial({ color: 0x222222, opacity: 0.6, transparent: true });
    const background = new THREE.Mesh(backgroundGeo, backgroundMat);
    background.position.set(0, 0.05, 0);
    background.rotation.x = -Math.PI / 2;
    background.layers.set(this.MINIMAP_LAYER);
    this.minimapObjects.add(background);
  }

  createPlayerMarker() {
    const playerMarkerGeo = new THREE.CircleGeometry(0.5, 16);
    const playerMarker = new THREE.Mesh(playerMarkerGeo, this.minimapPlayerMaterial);
    playerMarker.position.y = 0.2;
    playerMarker.rotation.x = -Math.PI / 2;
    playerMarker.layers.set(this.MINIMAP_LAYER);
    this.minimapObjects.add(playerMarker);
    return playerMarker;
  }

  updateEnemyMarkers(enemies) {
    this.enemyMarkers.forEach(marker => this.minimapObjects.remove(marker));
    this.enemyMarkers.length = 0;
    const enemyMarkerGeo = new THREE.CircleGeometry(1.5, 16);
    const enemyBorderGeo = new THREE.CircleGeometry(1.7, 16);
    enemies.forEach(enemy => {
      const border = new THREE.Mesh(enemyBorderGeo, this.minimapEnemyBorderMaterial);
      border.position.copy(enemy.position);
      border.position.y = 0.15;
      border.rotation.x = -Math.PI / 2;
      border.layers.set(this.MINIMAP_LAYER);
      this.minimapObjects.add(border);
      this.enemyMarkers.push(border);

      const marker = new THREE.Mesh(enemyMarkerGeo, this.minimapEnemyMaterial);
      marker.position.copy(enemy.position);
      marker.position.y = 0.2;
      marker.rotation.x = -Math.PI / 2;
      marker.layers.set(this.MINIMAP_LAYER);
      this.minimapObjects.add(marker);
      this.enemyMarkers.push(marker);
    });
  }
}

export { Minimap };
