import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.153.0/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.153.0/examples/jsm/loaders/GLTFLoader.js';
import { bounds } from './SceneSetup.js';

const INITIAL_SPAWN = new THREE.Vector3(0, 2, 0);
const MOVE_SPEED = 0.2;
const PLAYER_RADIUS = 0.5;

class Player {
  constructor(scene, camera, sceneSetup) {
    this.sceneSetup = sceneSetup;
    this.controls = new PointerLockControls(camera, document.body);
    scene.add(this.controls.getObject());
    this.keys = { w: false, a: false, s: false, d: false, f: false, l: false };
    this.setupControls();
    this.loadGun(camera);
  }

  setupControls() {
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(k)) {
        e.preventDefault();
        this.keys[k] = true;
        if (k === 'f' && this.controls.isLocked) {
          this.sceneSetup.toggleFlashlight();
        }
        if (k === 'l' && this.controls.isLocked) {
          this.sceneSetup.toggleDarkMode();
        }
      }
    });
    document.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(k)) {
        e.preventDefault();
        this.keys[k] = false;
      }
    });
  }

  loadGun(camera) {
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
        this.gunModel = gunModel;
      },
      undefined,
      err => console.error('Revolver load error:', err)
    );
  }

  updateMovement(isPaused, checkCollision) {
    if (!this.controls.isLocked || isPaused) return;
    const dir = this.controls.getObject().getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const next = this.controls.getObject().position.clone();
    if (this.keys.w) next.addScaledVector(dir, MOVE_SPEED);
    if (this.keys.s) next.addScaledVector(dir, -MOVE_SPEED);
    if (this.keys.a) next.addScaledVector(right, -MOVE_SPEED);
    if (this.keys.d) next.addScaledVector(right, MOVE_SPEED);
    const off = PLAYER_RADIUS + 1;
    next.x = Math.max(bounds.minX + off, Math.min(bounds.maxX - off, next.x));
    next.z = Math.max(bounds.minZ + off, Math.min(bounds.maxZ - off, next.z));
    if (!checkCollision(next)) this.controls.getObject().position.copy(next);
  }

  spawnPlayer(mazeGrid, offsetX, offsetZ, checkCollision) {
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
    this.controls.getObject().position.copy(pos);
  }
}

export { Player, PLAYER_RADIUS };
