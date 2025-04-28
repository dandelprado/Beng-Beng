class UIManager {
  constructor(player, sceneSetup) {
    this.player = player;
    this.sceneSetup = sceneSetup;
    this.isPaused = false;
    this.setupUI();
  }

  setupUI() {
    const ui = document.getElementById('ui');
    const crosshair = document.getElementById('crosshair');
    const pauseScreen = document.getElementById('pauseScreen');

    ui.addEventListener('click', () => {
      if (!this.isPaused && !this.player.controls.isLocked) this.player.controls.lock();
    });

    this.player.controls.addEventListener('lock', () => {
      ui.classList.add('disabled');
      crosshair.style.display = 'block';
    });

    this.player.controls.addEventListener('unlock', () => {
      ui.classList.remove('disabled');
      crosshair.style.display = 'none';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.player.controls.isLocked && !this.isPaused) {
        this.isPaused = true;
        this.player.controls.unlock();
        pauseScreen.style.display = 'flex';
      }
    });

    document.getElementById('resumeButton').addEventListener('click', () => {
      this.isPaused = false;
      pauseScreen.style.display = 'none';
      this.player.controls.lock();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.isPaused) {
        this.isPaused = true;
        this.player.controls.unlock();
        pauseScreen.style.display = 'flex';
      }
    });

    window.addEventListener('blur', () => {
      if (!this.isPaused) {
        this.isPaused = true;
        this.player.controls.unlock();
        pauseScreen.style.display = 'flex';
      }
    });

    window.addEventListener('focus', () => {
      if (this.isPaused) pauseScreen.style.display = 'flex';
    });

    document.getElementById('startButton').addEventListener('click', () => {
      const totalEnemies = parseInt(document.getElementById('enemyCount').value) || 20;
      document.getElementById('startScreen').style.display = 'none';
      this.isPaused = false;
      document.getElementById('counter').innerText = 'Kills: 0';
      document.getElementById('timer').innerText = 'Time: 0.00s';
      this.player.controls.lock();
      if (this.onStart) this.onStart(totalEnemies);
    });

    document.getElementById('restartButton').addEventListener('click', () => {
      document.getElementById('gameOverScreen').style.display = 'none';
      document.getElementById('startScreen').style.display = 'flex';
      this.isPaused = false;
      if (this.onRestart) this.onRestart();
    });

    const modeToggleButton = document.getElementById('modeToggleButton');
    modeToggleButton.innerText = this.sceneSetup.isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
    modeToggleButton.addEventListener('click', () => {
      this.sceneSetup.toggleDarkMode();
      modeToggleButton.innerText = this.sceneSetup.isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
    });
  }

  updateKills(kills) {
    document.getElementById('counter').innerText = `Kills: ${kills}`;
  }

  updateTimer(elapsed) {
    document.getElementById('timer').innerText = `Time: ${elapsed.toFixed(2)}s`;
  }

  showGameOver(finalTime, kills) {
    document.getElementById('finalStats').innerText =
      `Final Time: ${finalTime.toFixed(2)}s\nKills: ${kills}`;
    document.getElementById('gameOverScreen').style.display = 'flex';
  }

  setOnStart(callback) {
    this.onStart = callback;
  }

  setOnRestart(callback) {
    this.onRestart = callback;
  }
}

export { UIManager };
