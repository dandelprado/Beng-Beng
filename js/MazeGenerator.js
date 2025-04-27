import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const mazeTexture = textureLoader.load('assets/steampunk_wall.png');

class MazeGenerator {
  constructor(areaSize) {
    this.areaSize = areaSize;
    this.cellSize = 4;
    this.cols = Math.floor(areaSize / this.cellSize);
    this.rows = this.cols;
    this.mazeWalls = [];
    this.mazeGrid = this.generateDynamicMaze();
  }

  generateDynamicMaze() {
    const grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    const areas = [];
    const padding = 1;

    const isValidRect = (x, z, w, h, buffer = 1) => {
      if (x < padding || x + w >= this.cols - padding || z < padding || z + h >= this.rows - padding) return false;
      for (let r = z - buffer; r <= z + h + buffer; r++) {
        for (let c = x - buffer; c <= x + w + buffer; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && grid[r][c] !== 0) return false;
        }
      }
      return true;
    };

    const areaCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < areaCount; i++) {
      const isRoom = Math.random() < 0.5;
      const w = isRoom ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
      const h = isRoom ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
      const x = padding + Math.floor(Math.random() * (this.cols - w - padding * 2));
      const z = padding + Math.floor(Math.random() * (this.rows - h - padding * 2));
      if (isValidRect(x, z, w, h)) {
        areas.push({ x, z, width: w, height: h, isRoom });
        if (isRoom) {
          for (let c = x - 1; c <= x + w; c++) {
            grid[z - 1][c] = 1;
            grid[z + h][c] = 1;
          }
          for (let r = z - 1; r <= z + h; r++) {
            grid[r][x - 1] = 1;
            grid[r][x + w] = 1;
          }
        }
      }
    }

    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      const b = areas[(i + 1) % areas.length];
      const cx1 = a.x + Math.floor(a.width / 2);
      const cz1 = a.z + Math.floor(a.height / 2);
      const cx2 = b.x + Math.floor(b.width / 2);
      const cz2 = b.z + Math.floor(b.height / 2);
      const zLine = Math.round((cz1 + cz2) / 2);
      for (let x = Math.min(cx1, cx2); x <= Math.max(cx1, cx2); x++) {
        grid[zLine][x] = 0;
      }
      const xLine = Math.round((cx1 + cx2) / 2);
      for (let r = Math.min(cz1, cz2); r <= Math.max(cz1, cz2); r++) {
        grid[r][xLine] = 0;
      }
      if (a.isRoom) {
        const doorX = a.x + Math.floor(Math.random() * a.width);
        const doorZ = a.z + Math.floor(Math.random() * a.height);
        if (Math.random() < 0.5) {
          grid[a.z - 1][doorX] = 0;
          grid[a.z + a.height][doorX] = 0;
        } else {
          grid[doorZ][a.x - 1] = 0;
          grid[doorZ][a.x + a.width] = 0;
        }
      }
    }

    const wallCount = Math.floor(this.rows * this.cols * 0.1);
    for (let i = 0; i < wallCount; i++) {
      const r = padding + Math.floor(Math.random() * (this.rows - padding * 2));
      const c = padding + Math.floor(Math.random() * (this.cols - padding * 2));
      if (grid[r][c] === 0 && Math.random() < 0.3) grid[r][c] = 1;
    }

    const platformCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < platformCount; i++) {
      const w = 3 + Math.floor(Math.random() * 3);
      const h = 3 + Math.floor(Math.random() * 3);
      const x = padding + Math.floor(Math.random() * (this.cols - w - padding * 2));
      const z = padding + Math.floor(Math.random() * (this.rows - h - padding * 2));
      if (isValidRect(x, z, w, h, 2)) {
        for (let rr = z; rr < z + h; rr++) {
          for (let cc = x; cc < x + w; cc++) {
            grid[rr][cc] = 2;
          }
        }
      }
    }

    const isConnected = () => {
      const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const stack = [];
      outer: for (let rr = 0; rr < this.rows; rr++) {
        for (let cc = 0; cc < this.cols; cc++) {
          if (grid[rr][cc] === 0) {
            stack.push([rr, cc]);
            break outer;
          }
        }
      }
      while (stack.length) {
        const [rr, cc] = stack.pop();
        if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) continue;
        if (visited[rr][cc] || grid[rr][cc] !== 0) continue;
        visited[rr][cc] = true;
        stack.push([rr + 1, cc], [rr - 1, cc], [rr, cc + 1], [rr, cc - 1]);
      }
      for (let rr = 0; rr < this.rows; rr++) {
        for (let cc = 0; cc < this.cols; cc++) {
          if (grid[rr][cc] === 0 && !visited[rr][cc]) return false;
        }
      }
      return true;
    };

    if (!isConnected()) {
      const rr = padding + Math.floor(Math.random() * (this.rows - padding * 2));
      for (let cc = padding; cc < this.cols - padding; cc++) grid[rr][cc] = 0;
    }

    const offsetX = -this.areaSize / 2;
    const offsetZ = -this.areaSize / 2;
    return { grid, offsetX, offsetZ, areas };
  }

  setupMaze(scene) {
    const mazeMat = new THREE.MeshStandardMaterial({ map: mazeTexture, roughness: 0.7, metalness: 0.6 });
    const mazeGeo = new THREE.BoxGeometry(4, 2, 4);
    const platformMat = new THREE.MeshStandardMaterial({ map: mazeTexture, roughness: 0.7, metalness: 0.6 });
    const platformGeo = new THREE.BoxGeometry(4, 1, 4);

    for (let r = 0; r < this.mazeGrid.grid.length; r++) {
      for (let c = 0; c < this.mazeGrid.grid[0].length; c++) {
        const cell = this.mazeGrid.grid[r][c];
        if (cell === 1) {
          const wall = new THREE.Mesh(mazeGeo, mazeMat);
          wall.position.set(this.mazeGrid.offsetX + c * 4, 1, this.mazeGrid.offsetZ + r * 4);
          scene.add(wall);
          this.mazeWalls.push(wall);
        } else if (cell === 2) {
          const plat = new THREE.Mesh(platformGeo, platformMat);
          plat.position.set(this.mazeGrid.offsetX + c * 4, 1.5, this.mazeGrid.offsetZ + r * 4);
          scene.add(plat);
          this.mazeWalls.push(plat);
        }
      }
    }
  }
}

export { MazeGenerator };
