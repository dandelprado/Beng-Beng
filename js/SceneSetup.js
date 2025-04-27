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

    this.setupScene();
  }

  setupScene() {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    sky.material.uniforms['turbidity'].value = 30;
    sky.material.uniforms['rayleigh'].value = 0.3;
    sky.material.uniforms['mieCoefficient'].value = 0.03;
    sky.material.uniforms['mieDirectionalG'].value = 0.95;
    sky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1, degToRad(75), degToRad(180));
    this.scene.add(sky);

    const ambientLight = new THREE.AmbientLight(0xffb380, 0.5);
    this.scene.add(ambientLight);
    this.flickerTime = 0;
    this.flickerAmbientLight = (dt) => {
      this.flickerTime += dt;
      ambientLight.intensity = 0.5 + Math.sin(this.flickerTime * 5) * 0.1;
    };

    const dirLight = new THREE.DirectionalLight(0xffa500, 0.4);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    this.scene.fog = new THREE.FogExp2(0x4a3726, 0.01);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
      new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8, metalness: 0.5 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.layers.set(0);
    this.scene.add(ground);

    this.setupBoundaries();
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
}

export { SceneSetup, bounds };
