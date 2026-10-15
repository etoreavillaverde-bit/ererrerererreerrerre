import * as THREE from 'three';
import type { Obstacle } from './types';

const WORLD_SIZE = 340;
const GRID = 110;
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const random = seeded(92841);

export function terrainHeight(x: number, z: number): number {
  const broad = Math.sin(x * 0.018 + 0.7) * 1.45 + Math.cos(z * 0.021 - 0.4) * 1.25;
  const ripple = Math.sin((x + z) * 0.046) * 0.27 + Math.cos((x - z) * 0.038) * 0.22;
  const hills = [
    [-68, -48, 10, 24], [76, -58, 8, 31], [-74, 64, 9, 28], [72, 65, 12, 26],
    [15, -96, 8, 42], [-14, 103, 10, 43], [120, 14, 8, 29], [-125, -12, 8, 30],
  ].reduce((sum, [hx, hz, height, radius]) => sum + height * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (radius * radius)), 0);
  return broad + ripple + hills;
}

export interface World {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  obstacles: Obstacle[];
  ground: THREE.Mesh;
  dispose: () => void;
}

function makeGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#888673'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const shade = 70 + Math.floor(random() * 70);
    ctx.fillStyle = `rgba(${shade},${shade - 3},${shade - 13},${0.11 + random() * 0.18})`;
    const r = random() * 2 + 0.4;
    ctx.fillRect(random() * 512, random() * 512, r, r);
  }
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(178,164,126,${0.035 + random() * 0.045})`;
    ctx.lineWidth = 1 + random() * 2; ctx.beginPath();
    ctx.moveTo(random() * 512, random() * 512); ctx.bezierCurveTo(random() * 512, random() * 512, random() * 512, random() * 512, random() * 512, random() * 512); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(22, 22); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

function material(color: string | number, roughness = 0.95): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function makeRibbon(points: THREE.Vector3[], width: number, mat: THREE.Material, scene: THREE.Scene): THREE.Mesh {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]!, next = points[Math.min(points.length - 1, i + 1)]!;
    const dir = new THREE.Vector2(next.x - prev.x, next.z - prev.z).normalize();
    const side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(width / 2);
    for (const sign of [-1, 1]) {
      const x = points[i]!.x + side.x * sign, z = points[i]!.z + side.y * sign;
      vertices.push(x, terrainHeight(x, z) + 0.12, z);
    }
    if (i < points.length - 1) {
      const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat); mesh.receiveShadow = true; scene.add(mesh); return mesh;
}

export function createWorld(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9bbbd');
  scene.fog = new THREE.Fog('#a9bbbd', 100, 260);
  const hemisphere = new THREE.HemisphereLight('#cadbdd', '#615a4b', 1.72); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff0cf', 3.1); sun.position.set(-52, 78, 36); sun.castShadow = true;
  sun.shadow.camera.left = -145; sun.shadow.camera.right = 145; sun.shadow.camera.top = 145; sun.shadow.camera.bottom = -145; sun.shadow.camera.near = 1; sun.shadow.camera.far = 250;
  sun.shadow.bias = -0.00045; sun.shadow.normalBias = 0.035; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#8eaaad', 0.56); fill.position.set(42, 28, -62); scene.add(fill);

  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let iz = 0; iz <= GRID; iz++) for (let ix = 0; ix <= GRID; ix++) {
    const x = -WORLD_SIZE / 2 + WORLD_SIZE * ix / GRID;
    const z = -WORLD_SIZE / 2 + WORLD_SIZE * iz / GRID;
    const y = terrainHeight(x, z); positions.push(x, y, z);
    const normalized = THREE.MathUtils.clamp((y + 3) / 24, 0, 1);
    const col = new THREE.Color().setRGB(0.76 - normalized * 0.15, 0.72 - normalized * 0.19, 0.59 - normalized * 0.2).convertSRGBToLinear();
    colors.push(col.r, col.g, col.b);
    if (ix < GRID && iz < GRID) {
      const a = iz * (GRID + 1) + ix, b = a + 1, c = a + GRID + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const terrainGeo = new THREE.BufferGeometry(); terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeo.setIndex(indices); terrainGeo.computeVertexNormals();
  const ground = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ map: makeGroundTexture(), vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  const roadMat = material('#746b5a');
  const roadLines = material('#b7a989');
  const roadSets = [
    [[-162, -34], [-100, -18], [-50, 2], [0, 14], [55, 26], [106, 39], [166, 62]],
    [[-120, 154], [-82, 110], [-54, 58], [-28, 18], [-8, -31], [15, -84], [52, -156]],
    [[-166, 74], [-120, 53], [-80, 38], [-54, 4], [-32, -36], [8, -57], [74, -78], [160, -97]],
  ];
  const roadMeshes: THREE.Mesh[] = [];
  for (const raw of roadSets) {
    const curve = new THREE.CatmullRomCurve3(raw.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const pts = curve.getPoints(88); roadMeshes.push(makeRibbon(pts, 11, roadMat, scene));
    roadMeshes.push(makeRibbon(pts, 0.35, roadLines, scene));
  }

  const obstacles: Obstacle[] = [];
  const detailMeshes: THREE.Mesh[] = [];
  const trunkMat = material('#57493a'), pineMat = material('#46594a'), pineLight = material('#61705a');
  const rockMats = ['#6c6c62', '#77766a', '#5b625e'].map(c => material(c));
  const buildingMat = material('#77766b'), roofMat = material('#5f605b'), trimMat = material('#b4aa90');
  const addObstacle = (kind: Obstacle['kind'], x: number, z: number, radius: number, height: number) => obstacles.push({ position: new THREE.Vector3(x, terrainHeight(x, z), z), radius, height, kind });

  // Small fortifications and ruined sheds create readable lanes and hard cover.
  const buildings = [[-38, -54, 13, 9, 7], [44, 49, 16, 11, 8], [-103, 16, 12, 10, 6], [98, -18, 14, 12, 8], [6, 88, 11, 13, 6], [34, 18, 13, 10, 7]] as const;
  for (const [x, z, w, d, h] of buildings) {
    const y = terrainHeight(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat); base.position.y = h / 2; base.castShadow = base.receiveShadow = true; g.add(base);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.9, d + 0.7), roofMat); roof.position.y = h + 0.45; roof.castShadow = true; g.add(roof);
    const facing = new THREE.Group(); facing.position.z = d / 2 + 0.015; g.add(facing);
    for (let i = 0; i < 3; i++) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: '#2e3734', roughness: 0.7 }));
      window.position.set((i - 1) * (w * 0.28), h * 0.66, 0); facing.add(window);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.28, d + 0.12), trimMat); stripe.position.y = h * 0.38; g.add(stripe);
    scene.add(g); detailMeshes.push(base, roof, stripe); addObstacle('building', x, z, Math.max(w, d) * 0.65, h + 2);
  }

  // Stone outcrops, timber barricades and pines are scattered away from the central crossing.
  const rockGeometry = new THREE.DodecahedronGeometry(1, 1);
  const rockInstances = rockMats.map(mat => new THREE.InstancedMesh(rockGeometry, mat, 62));
  const rockCounts = rockInstances.map(() => 0);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 62; i++) {
    const x = (random() - 0.5) * 270, z = (random() - 0.5) * 270;
    if (Math.hypot(x + 20, z - 2) < 21) continue;
    const size = 1.2 + random() * 2.8, y = terrainHeight(x, z);
    const kind = Math.floor(random() * rockInstances.length), batch = rockInstances[kind]!, index = rockCounts[kind]!;
    transform.position.set(x, y + size * 0.55, z); transform.scale.set(size * (1 + random() * 0.8), size * (0.65 + random() * 0.8), size * (0.8 + random() * 0.5));
    transform.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.25); transform.updateMatrix(); batch.setMatrixAt(index, transform.matrix); rockCounts[kind] = index + 1;
    addObstacle('rock', x, z, size * 1.2, size * 1.6);
  }
  rockInstances.forEach((batch, index) => { batch.count = rockCounts[index]!; batch.castShadow = batch.receiveShadow = true; batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); scene.add(batch); detailMeshes.push(batch); });

  const treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.23, 2.5, 6), trunkMat, 92);
  const treeCanopies = [pineLight, pineMat, pineLight].map((mat, layer) => new THREE.InstancedMesh(new THREE.ConeGeometry(1.7 - layer * 0.34, 2.25 - layer * 0.25, 7), mat, 92));
  let treeCount = 0;
  for (let i = 0; i < 92; i++) {
    const x = (random() - 0.5) * 285, z = (random() - 0.5) * 285;
    if (Math.hypot(x + 20, z - 2) < 18) continue;
    const s = 0.65 + random() * 0.7, y = terrainHeight(x, z);
    transform.position.set(x, y + 1.25 * s, z); transform.rotation.set(0, random() * Math.PI, 0); transform.scale.setScalar(s); transform.updateMatrix(); treeTrunk.setMatrixAt(treeCount, transform.matrix);
    for (let layer = 0; layer < 3; layer++) {
      const canopy = treeCanopies[layer]!;
      transform.position.set(x, y + (2.0 + layer * 0.94) * s, z); transform.rotation.set(0, 0, 0); transform.scale.setScalar(s); transform.updateMatrix(); canopy.setMatrixAt(treeCount, transform.matrix);
    }
    treeCount++; addObstacle('tree', x, z, 0.74 * s, 5.3 * s);
  }
  for (const mesh of [treeTrunk, ...treeCanopies]) { mesh.count = treeCount; mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh); detailMeshes.push(mesh); }
  for (const [x, z, angle] of [[-56, 30, 0.15], [62, -40, -0.3], [25, -65, 0.1], [-84, -68, 0.6], [78, 86, -0.55], [130, 16, 1.2]] as const) {
    const y = terrainHeight(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = angle;
    for (let i = -1; i <= 1; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 7, 8), trunkMat); log.rotation.z = Math.PI / 2; log.position.set(i * 0.65, 0.45, 0); log.castShadow = true; g.add(log);
    }
    scene.add(g); detailMeshes.push(...g.children as THREE.Mesh[]); addObstacle('barrier', x, z, 4.6, 1.5);
  }

  // Background ridges hide the edge of the combat basin.
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#81877d', roughness: 1, flatShading: true });
  const ridgeGeometry = new THREE.ConeGeometry(1, 1, 7);
  const ridges = new THREE.InstancedMesh(ridgeGeometry, ridgeMat, 28);
  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2, radius = 198 + random() * 27, width = 14 + random() * 20, height = 22 + random() * 34;
    transform.position.set(Math.cos(angle) * radius, height * 0.35 - 3, Math.sin(angle) * radius); transform.scale.set(width, height, width * 1.6); transform.rotation.set(0, angle, 0); transform.updateMatrix(); ridges.setMatrixAt(i, transform.matrix);
  }
  ridges.castShadow = true; ridges.instanceMatrix.needsUpdate = true; ridges.computeBoundingSphere(); scene.add(ridges); detailMeshes.push(ridges);

  return {
    scene, sun, obstacles, ground,
    dispose: () => {
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
      for (const mesh of [...roadMeshes, ...detailMeshes]) mesh.removeFromParent();
    },
  };
}

export function obstacleCollision(position: THREE.Vector3, radius: number, obstacles: Obstacle[]): Obstacle | null {
  for (const obstacle of obstacles) {
    const dx = position.x - obstacle.position.x, dz = position.z - obstacle.position.z;
    if (dx * dx + dz * dz < (radius + obstacle.radius) ** 2) return obstacle;
  }
  return null;
}
