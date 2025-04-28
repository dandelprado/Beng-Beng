import * as THREE from 'three';
import { bounds } from './SceneSetup.js';

class Minimap {
  constructor(scene, mazeGrid, offsetX, offsetZ) {
    this.MINIMAP_LAYER = 1;
    this.minimapObjects = new THREE.Group();
    this.minimapObjects.layers.set(this.MINIMAP_LAYER);
    this.minimapObjects.visible = true;
    scene.add(this.minimapObjects);

    this.minimapWallMaterial = new THREE.MeshBasicMaterial({ color: 0xA9C1D4 });
    this.minimapPlatformMaterial = new THREE.MeshBasicMaterial({ color: 0x6B8294 });
    this.minimapPlayerMaterialLight = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
    this.minimapEnemyMaterialLight = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    this.minimapEnemyBorderMaterialLight = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    this.minimapPlayerMaterialDark = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    this.minimapEnemyMaterialDark = new THREE.MeshBasicMaterial({ color: 0xFF69B4 });
    this.minimapEnemyBorderMaterialDark = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

    this.isDarkMode = false;

    this.minimapPlayerMaterial = this.minimapPlayerMaterialLight;
    this.minimapEnemyMaterial = this.minimapEnemyMaterialLight;
    this.minimapEnemyBorderMaterial = this.minimapEnemyBorderMaterialLight;

    console.log('Minimap colors set:');
    console.log('Wall color:', this.minimapWallMaterial.color.getHexString());
    console.log('Platform color:', this.minimapPlatformMaterial.color.getHexString());
    console.log('Background color (to be set): 1C2526');

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
    const backgroundMat = new THREE.MeshBasicMaterial({ color: 0x1C2526, opacity: 0.8, transparent: true });
    const background = new THREE.Mesh(backgroundGeo, backgroundMat);
    background.position.set(0, 0.05, 0);
    background.rotation.x = -Math.PI / 2;
    background.layers.set(this.MINIMAP_LAYER);
    this.minimapObjects.add(background);
  }

  createPlayerMarker() {
    const shape = new THREE.Shape();
    const size = 1.5;
    shape.moveTo(0, size);
    shape.lineTo(-size * 0.866, -size * 0.5);
    shape.lineTo(size * 0.866, -size * 0.5);
    shape.lineTo(0, size);
    const playerMarkerGeo = new THREE.ShapeGeometry(shape);
    const playerMarker = new THREE.Mesh(playerMarkerGeo, this.minimapPlayerMaterial);
    playerMarker.position.y = 0.2;
    playerMarker.rotation.x = -Math.PI / 2;
    playerMarker.layers.set(this.MINIMAP_LAYER);
    playerMarker.visible = true;
    this.minimapObjects.add(playerMarker);
    console.log('Player marker created. Visible:', playerMarker.visible, 'Layer:', playerMarker.layers.mask);
    return playerMarker;
  }

  updateEnemyMarkers(enemies) {
    this.enemyMarkers.forEach(marker => this.minimapObjects.remove(marker));
    this.enemyMarkers.length = 0;
    const enemyMarkerGeo = new THREE.CircleGeometry(1.0, 16);
    const enemyBorderGeo = new THREE.CircleGeometry(1.2, 16);

    this.minimapEnemyMaterial = this.isDarkMode ? this.minimapEnemyMaterialDark : this.minimapEnemyMaterialLight;
    this.minimapEnemyBorderMaterial = this.isDarkMode ? this.minimapEnemyBorderMaterialDark : this.minimapEnemyBorderMaterialLight;

    console.log('Updating enemy markers. Enemies count:', enemies.length);
    enemies.forEach(enemy => {
      const border = new THREE.Mesh(enemyBorderGeo, this.minimapEnemyBorderMaterial);
      border.position.copy(enemy.position);
      border.position.y = 0.15;
      border.rotation.x = -Math.PI / 2;
      border.layers.set(this.MINIMAP_LAYER);
      border.visible = true;
      this.minimapObjects.add(border);
      this.enemyMarkers.push(border);

      const marker = new THREE.Mesh(enemyMarkerGeo, this.minimapEnemyMaterial);
      marker.position.copy(enemy.position);
      marker.position.y = 0.2;
      marker.rotation.x = -Math.PI / 2;
      marker.layers.set(this.MINIMAP_LAYER);
      marker.visible = true;
      this.minimapObjects.add(marker);
      this.enemyMarkers.push(marker);
    });
    console.log('Updated enemy markers. Total markers:', this.enemyMarkers.length);
    this.enemyMarkers.forEach((marker, index) => {
      console.log(`Marker ${index}: Visible: ${marker.visible}, Layer: ${marker.layers.mask}, Color: ${marker.material.color.getHexString()}`);
    });
    this.minimapObjects.visible = true;
    this.minimapObjects.layers.set(this.MINIMAP_LAYER);
  }

  updateMaterials(isDarkMode) {
    this.isDarkMode = isDarkMode;

    this.minimapObjects.traverse(object => {
      if (object.isMesh) {
        if (object.material === this.minimapWallMaterial) {
          object.material = new THREE.MeshBasicMaterial({ color: 0xA9C1D4 });
        } else if (object.material === this.minimapPlatformMaterial) {
          object.material = new THREE.MeshBasicMaterial({ color: 0x6B8294 });
        } else if (object.material.color.getHex() === 0x1C2526) {
          object.material = new THREE.MeshBasicMaterial({ color: 0x1C2526, opacity: 0.8, transparent: true });
        }
      }
    });

    this.minimapPlayerMaterial = this.isDarkMode ? this.minimapPlayerMaterialDark : this.minimapPlayerMaterialLight;
    this.playerMarker.material = this.minimapPlayerMaterial;

    console.log('Minimap materials updated. Dark mode:', this.isDarkMode, 'Player marker color:', this.playerMarker.material.color.getHexString());
  }
}

export { Minimap };
