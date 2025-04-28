import * as THREE from 'three';
import { Sky } from 'https://unpkg.com/three@0.153.0/examples/jsm/objects/Sky.js';
import { degToRad } from './MathUtils.js';

const textureLoader = new THREE.TextureLoader();
const groundTexture = textureLoader.load('assets/rusted_metal.png');
const wallTexture = textureLoader.load('assets/steampunk_boundary.png');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(10, 2);

const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

class SceneSetup {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.autoClear = false;
    document.getElementById('threejsContainer').appendChild(this.renderer.domElement);

    this.mapSize = 250;
    this.mapMargin = 5;
    this.mapCamera = new THREE.OrthographicCamera(
      bounds.minX - 5, bounds.maxX + 5,
      bounds.maxZ + 5, bounds.minZ - 5,
      0.1, 500
    );
    this.mapCamera.position.set(0, 50, 0);
    this.mapCamera.up.set(0, 0, -1);
    this.mapCamera.lookAt(0, 0, 0);
    this.mapCamera.layers.enable(1);
    this.mapCamera.zoom = 0.8;
    this.mapCamera.updateProjectionMatrix();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.enemy = null;
    this.minimap = null;
    this.uiManager = null;
    this.setupScene();
  }

  setEnemy(enemy) {
    this.enemy = enemy;
  }

  setMinimap(minimap) {
    this.minimap = minimap;
  }

  setUIManager(uiManager) {
    this.uiManager = uiManager;
  }

  setupScene() {
    this.lightModeSky = new Sky();
    this.lightModeSky.scale.setScalar(450000);
    this.lightModeSky.layers.set(0);

    const darkSkyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    darkSkyGeometry.scale(-1, 1, 1);
    const starsCanvas = document.createElement('canvas');
    starsCanvas.width = 512;
    starsCanvas.height = 512;
    const starsContext = starsCanvas.getContext('2d');
    starsContext.fillStyle = '#1C2526';
    starsContext.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = Math.random() * 1.5;
      starsContext.beginPath();
      starsContext.arc(x, y, radius, 0, Math.PI * 2);
      starsContext.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
      starsContext.fill();
    }
    const starsTexture = new THREE.CanvasTexture(starsCanvas);
    starsTexture.needsUpdate = true;
    this.darkModeSkyMaterial = new THREE.MeshBasicMaterial({
      map: starsTexture,
      side: THREE.BackSide,
      color: 0x1C2526,
    });
    this.darkModeSky = new THREE.Mesh(darkSkyGeometry, this.darkModeSkyMaterial);
    this.darkModeSky.layers.set(0);

    this.scene.add(this.lightModeSky);

    this.ambientLight = new THREE.AmbientLight(0xffb380, 0.5);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffa500, 0.4);
    this.dirLight.position.set(5, 10, 5);
    this.scene.add(this.dirLight);

    this.spotLight = new THREE.SpotLight(0xffffff, 3, 30, Math.PI / 8, 0.5, 1);
    this.spotLight.position.set(0, 0, 0);
    this.camera.add(this.spotLight);
    this.spotLight.target = new THREE.Object3D();
    this.camera.add(this.spotLight.target);
    this.spotLight.target.position.set(0, 0, -1);
    this.spotLight.visible = false;

    this.fixedSpotlights = [];
    const spotlightPositions = [
      new THREE.Vector3(-40, 10, -40),
      new THREE.Vector3(40, 10, -40),
      new THREE.Vector3(-40, 10, 40),
      new THREE.Vector3(40, 10, 40),
      new THREE.Vector3(0, 10, 0),
    ];
    spotlightPositions.forEach((pos) => {
      const spotlight = new THREE.SpotLight(0xffa500, 2, 50, Math.PI / 4, 0.5, 1);
      spotlight.position.copy(pos);
      spotlight.target = new THREE.Object3D();
      spotlight.target.position.set(pos.x, 0, pos.z);
      this.scene.add(spotlight);
      this.scene.add(spotlight.target);
      spotlight.visible = false;
      this.fixedSpotlights.push(spotlight);
    });

    this.scene.fog = new THREE.FogExp2(0x4a3726, 0.01);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
      new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8, metalness: 0.5 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.layers.set(0);
    this.scene.add(ground);

    this.setupBoundaries();

    this.isDarkMode = false;
    this.originalAmbientIntensity = 0.5;
    this.originalDirLightIntensity = 0.4;
    this.updateLighting();
  }

  setupBoundaries() {
    const h = 4, t = 2, half = t / 2;
    const mazeWalls = [];
    const mk = (w, hgt, th, x, y, z) => {
      const mat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.6, metalness: 0.5 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, th), mat);
      m.position.set(x, y, z);
      this.scene.add(m);
      mazeWalls.push(m);
    };
    mk(bounds.maxX - bounds.minX, h, t, 0, h / 2, bounds.maxZ - half);
    mk(bounds.maxX - bounds.minX, h, t, 0, h / 2, bounds.minZ + half);
    mk(t, h, bounds.maxZ - bounds.minZ, bounds.maxX - half, h / 2, 0);
    mk(t, h, bounds.maxZ - bounds.minZ, bounds.minX + half, h / 2, 0);
    return mazeWalls;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.updateLighting();
    // Force UI update after mode change
    if (this.uiManager) {
      setTimeout(() => {
        this.uiManager.updateModeHint();
      }, 0);
    }
  }

  updateLighting() {
    if (this.isDarkMode) {
      this.ambientLight.intensity = 0.02;
      this.dirLight.intensity = 0.01;
      this.scene.fog.density = 0.05;
      this.fixedSpotlights.forEach((spotlight) => (spotlight.visible = true));
      this.scene.remove(this.lightModeSky);
      this.scene.add(this.darkModeSky);
      this.darkModeSky.material.needsUpdate = true;
      if (this.enemy) {
        this.enemy.resetEnemies();
        this.enemy.createEnemies(5, this.checkCollision.bind(this));
      } else {
        console.warn('Enemy instance not set in SceneSetup');
      }
      if (this.minimap) {
        this.minimap.updateMaterials(this.isDarkMode);
      } else {
        console.warn('Minimap instance not set in SceneSetup');
      }
    } else {
      this.ambientLight.intensity = this.originalAmbientIntensity;
      this.dirLight.intensity = this.originalDirLightIntensity;
      this.scene.fog.density = 0.01;
      this.fixedSpotlights.forEach((spotlight) => (spotlight.visible = false));
      this.spotLight.visible = false;
      this.scene.remove(this.darkModeSky);
      this.scene.add(this.lightModeSky);
      this.lightModeSky.material.uniforms['turbidity'].value = 10;
      this.lightModeSky.material.uniforms['rayleigh'].value = 1.0;
      this.lightModeSky.material.uniforms['mieCoefficient'].value = 1.0;
      this.lightModeSky.material.uniforms['mieDirectionalG'].value = 0.7;
      this.lightModeSky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1, degToRad(75), degToRad(180));
      this.lightModeSky.material.needsUpdate = true;
      if (this.enemy) {
        this.enemy.resetEnemies();
        this.enemy.createEnemies(5, this.checkCollision.bind(this));
      } else {
        console.warn('Enemy instance not set in SceneSetup');
      }
      if (this.minimap) {
        this.minimap.updateMaterials(this.isDarkMode);
      } else {
        console.warn('Minimap instance not set in SceneSetup');
      }
    }
    // Force UI update after lighting changes
    if (this.uiManager) {
      setTimeout(() => {
        this.uiManager.updateModeHint();
      }, 0);
    }
  }

  toggleFlashlight() {
    if (this.isDarkMode) {
      this.spotLight.visible = !this.spotLight.visible;
    } else {
      this.spotLight.visible = false;
    }
    if (this.uiManager) {
      this.uiManager.updateModeHint();
    }
  }

  flickerAmbientLight(dt) {
    // Placeholder for ambient light flicker effect
  }
}

export { SceneSetup, bounds };
