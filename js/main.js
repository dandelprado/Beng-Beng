import { SceneSetup } from './SceneSetup.js';
import { MazeGenerator } from './MazeGenerator.js';
import { Minimap } from './Minimap.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { GameLogic } from './GameLogic.js';
import { UIManager } from './UIManager.js';

const sceneSetup = new SceneSetup();
const mazeGenerator = new MazeGenerator(100);
mazeGenerator.setupMaze(sceneSetup.scene);
const minimap = new Minimap(sceneSetup.scene, mazeGenerator.mazeGrid.grid, mazeGenerator.mazeGrid.offsetX, mazeGenerator.mazeGrid.offsetZ);
const player = new Player(sceneSetup.scene, sceneSetup.camera, sceneSetup);
const enemy = new Enemy(sceneSetup.scene, mazeGenerator.mazeGrid.grid, mazeGenerator.mazeGrid.offsetX, mazeGenerator.mazeGrid.offsetZ, player.controls.getObject().position);
const uiManager = new UIManager(player, sceneSetup);
const gameLogic = new GameLogic(sceneSetup.scene, sceneSetup.camera, player, enemy, uiManager);
gameLogic.mazeWalls = [...sceneSetup.setupBoundaries(), ...mazeGenerator.mazeWalls];

sceneSetup.setEnemy(enemy);
sceneSetup.setMinimap(minimap);

function animate() {
  requestAnimationFrame(animate);
  const dt = gameLogic.clock.getDelta();
  if (!uiManager.isPaused) {
    gameLogic.updateBullets();
    enemy.updateEnemyMovement(dt, gameLogic.checkCollision.bind(gameLogic), uiManager.isPaused);
    player.updateMovement(uiManager.isPaused, gameLogic.checkCollision.bind(gameLogic));
    sceneSetup.flickerAmbientLight(dt);
    gameLogic.updateGameState();
  }

  minimap.playerMarker.position.copy(player.controls.getObject().position);
  minimap.playerMarker.position.y = 0.2;
  minimap.playerMarker.rotation.z = -sceneSetup.camera.rotation.y;
  minimap.playerMarker.material = minimap.isDarkMode ? minimap.minimapPlayerMaterialDark : minimap.minimapPlayerMaterialLight;
  minimap.playerMarker.visible = true;
  minimap.playerMarker.layers.set(1);

  minimap.updateEnemyMarkers(enemy.enemies);

  const isDebug = false;
  if (isDebug) {
    console.log('Rendering minimap. Player marker visible:', minimap.playerMarker.visible, 'Layer:', minimap.playerMarker.layers.mask);
    console.log('Enemy markers count:', minimap.enemyMarkers.length);
  }

  sceneSetup.renderer.clear();
  sceneSetup.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  sceneSetup.renderer.setScissorTest(false);
  sceneSetup.camera.layers.set(0);
  sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);

  sceneSetup.renderer.clearDepth();
  sceneSetup.renderer.setScissorTest(true);
  sceneSetup.renderer.setScissor(
    window.innerWidth - sceneSetup.mapSize - sceneSetup.mapMargin,
    window.innerHeight - sceneSetup.mapSize - sceneSetup.mapMargin,
    sceneSetup.mapSize,
    sceneSetup.mapSize
  );
  sceneSetup.renderer.setViewport(
    window.innerWidth - sceneSetup.mapSize - sceneSetup.mapMargin,
    window.innerHeight - sceneSetup.mapSize - sceneSetup.mapMargin,
    sceneSetup.mapSize,
    sceneSetup.mapSize
  );
  const originalFog = sceneSetup.scene.fog;
  sceneSetup.scene.fog = null;
  sceneSetup.mapCamera.layers.set(1);
  sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.mapCamera);
  sceneSetup.scene.fog = originalFog;
  sceneSetup.renderer.setScissorTest(false);
}

animate();
