import * as THREE from 'three';
import type { Faction, Vehicle } from './types';
import { terrainHeight } from './world';

let vehicleId = 0;
const standard = (color: string | number, roughness = 0.7, metalness = 0.18) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createVehicle(scene: THREE.Scene, faction: Faction, x: number, z: number, name: string): Vehicle {
  const root = new THREE.Group(); root.position.set(x, terrainHeight(x, z), z); scene.add(root);
  const hullColor = faction === 'player' ? '#596958' : '#765750';
  const darkColor = faction === 'player' ? '#303a34' : '#41322e';
  const edgeColor = faction === 'player' ? '#a1a17b' : '#c28d6e';
  const hullMat = standard(hullColor, 0.75, 0.22), darkMat = standard(darkColor, 0.9, 0.1), trimMat = standard(edgeColor, 0.7, 0.28);
  const metalMat = standard('#373a37', 0.48, 0.62), glassMat = new THREE.MeshStandardMaterial({ color: faction === 'player' ? '#506d73' : '#5d5148', metalness: 0.66, roughness: 0.25, emissive: faction === 'player' ? '#142326' : '#251713' });
  const box = (parent: THREE.Object3D, width: number, height: number, depth: number, mat: THREE.Material, x0: number, y: number, z0: number, bevel = false): THREE.Mesh => {
    const geom: THREE.BufferGeometry = bevel ? new THREE.BoxGeometry(width, height, depth, 1, 1, 1) : new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, mat); mesh.position.set(x0, y, z0); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const wheelBatch = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.13, 14), metalMat, 14);
  const hubBatch = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 10), trimMat, 14);
  const treadBatch = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.055, 0.22), darkMat, 20);
  const wheelAlignment = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const dummy = new THREE.Object3D();
  const hull = new THREE.Group(); root.add(hull);
  box(hull, 1.9, 0.66, 3.0, hullMat, 0, 0.83, 0, true);
  box(hull, 1.72, 0.22, 2.53, trimMat, 0, 1.19, -0.04, true);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.26, 0.65), hullMat); glacis.position.set(0, 0.69, 1.35); glacis.rotation.x = -0.22; glacis.castShadow = true; hull.add(glacis);
  box(hull, 0.48, 0.17, 0.25, glassMat, 0, 1.24, 1.02);
  for (const side of [-1, 1]) {
    box(hull, 0.24, 0.82, 3.36, darkMat, side * 1.06, 0.53, -0.02, true);
    box(hull, 0.12, 0.32, 2.82, hullMat, side * 1.19, 0.92, -0.05, true);
    for (let i = 0; i < 7; i++) {
      const index = (side > 0 ? 7 : 0) + i;
      dummy.position.set(side * 1.16, 0.42, -1.28 + i * 0.42); dummy.quaternion.copy(wheelAlignment); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); wheelBatch.setMatrixAt(index, dummy.matrix);
      dummy.position.x = side * 1.17; dummy.updateMatrix(); hubBatch.setMatrixAt(index, dummy.matrix);
    }
    for (let i = 0; i < 10; i++) {
      const index = (side > 0 ? 10 : 0) + i;
      dummy.position.set(side * 1.198, 0.17, -1.45 + i * 0.31); dummy.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), i < 2 ? -0.12 : i > 7 ? 0.12 : 0); dummy.updateMatrix(); treadBatch.setMatrixAt(index, dummy.matrix);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), new THREE.MeshStandardMaterial({ color: '#d6bd86', emissive: '#63461d', emissiveIntensity: 0.3 }));
    lamp.position.set(side * 0.67, 0.9, 1.5); hull.add(lamp);
    box(hull, 0.1, 0.39, 0.17, metalMat, side * 0.76, 0.66, -1.54);
  }
  for (const batch of [wheelBatch, hubBatch, treadBatch]) { batch.castShadow = batch.receiveShadow = true; batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); hull.add(batch); }

  // Turret bearing and angular cast turret silhouette.
  const turret = new THREE.Group(); turret.position.set(0, 1.38, -0.05); root.add(turret);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.9, 0.22, 12), darkMat); ring.position.y = -0.02; ring.castShadow = true; turret.add(ring);
  const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.53, 0.68, 1.62), hullMat); turretBody.position.set(0, 0.39, -0.06); turretBody.castShadow = turretBody.receiveShadow = true; turret.add(turretBody);
  const turretFront = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.48, 0.55), trimMat); turretFront.position.set(0, 0.39, 0.77); turretFront.castShadow = true; turret.add(turretFront);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.13, 10), darkMat); hatch.position.set(-0.28, 0.79, -0.2); hatch.castShadow = true; turret.add(hatch);
  const hatchBar = box(turret, 0.08, 0.14, 0.43, trimMat, -0.28, 0.86, -0.2);
  const periscope = box(turret, 0.18, 0.13, 0.23, metalMat, 0.42, 0.76, -0.25);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.0, 5), metalMat); antenna.position.set(0.55, 0.91, -0.56); antenna.rotation.z = -0.12; turret.add(antenna);
  // Distinctive two-bar unit marking, fully original.
  const markingMat = standard(faction === 'player' ? '#d0c39c' : '#e0a186', 0.58, 0.1);
  for (const side of [-1, 1]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.72), markingMat); marker.position.set(side * 0.78, 0.42, -0.06); marker.castShadow = true; turret.add(marker);
  }

  const cannon = new THREE.Group(); cannon.position.set(0, 0.44, 0.96); turret.add(cannon);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.16, 2.75, 12), metalMat); barrel.rotation.x = Math.PI / 2; barrel.position.z = 1.34; barrel.castShadow = true; cannon.add(barrel);
  const mantlet = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.32, 0.42, 12), hullMat); mantlet.rotation.x = Math.PI / 2; mantlet.position.z = 0.08; mantlet.castShadow = true; cannon.add(mantlet);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.28, 12), darkMat); muzzle.rotation.x = Math.PI / 2; muzzle.position.z = 2.58; muzzle.castShadow = true; cannon.add(muzzle);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.012, 12), metalMat); bore.rotation.x = Math.PI / 2; bore.position.z = 2.73; cannon.add(bore);
  const recoil = box(cannon, 0.16, 0.17, 0.26, hullMat, 0.0, 0.19, 0.86);

  const position = root.position;
  const vehicle: Vehicle = {
    id: ++vehicleId, faction, name, root, turret, cannon,
    wheels: [wheelBatch, hubBatch], trackTreads: treadBatch,
    position, velocity: new THREE.Vector3(), heading: faction === 'player' ? 0 : Math.PI, turretAngle: 0,
    elevation: 0.03, hp: 100, maxHp: 100, ammo: faction === 'player' ? 5 : 1, magazine: faction === 'player' ? 5 : 1, alive: true, reload: 0, aiTimer: 1.4 + Math.random() * 1.6,
    targetHeading: faction === 'player' ? 0 : Math.PI, moveGoal: new THREE.Vector3(x, terrainHeight(x, z), z), moveClock: 0,
    flashTimer: 0, recoil: 0, enginePhase: Math.random() * 6.28, meshMaterials: [hullMat, darkMat, trimMat, metalMat],
  };
  root.rotation.y = vehicle.heading;
  // Keep local references used by animation alive, while disposing all geometry via scene traversal.
  void hatchBar; void periscope; void recoil;
  return vehicle;
}

export function updateVehicleModel(vehicle: Vehicle, delta: number): void {
  vehicle.root.rotation.y = vehicle.heading;
  vehicle.turret.rotation.y = vehicle.turretAngle;
  vehicle.cannon.rotation.x = -vehicle.elevation;
  vehicle.flashTimer = Math.max(0, vehicle.flashTimer - delta);
  vehicle.recoil = Math.max(0, vehicle.recoil - delta * 0.9);
  const barrel = vehicle.cannon.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry);
  if (barrel) barrel.position.z = 1.34 - vehicle.recoil * 0.5;
  vehicle.enginePhase += delta * Math.min(6, vehicle.velocity.length() * 2.4 + 0.4);
  const roll = vehicle.enginePhase;
  const dummy = new THREE.Object3D(); const alignment = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const spinAxis = new THREE.Vector3(0, 1, 0);
  vehicle.wheels.forEach((batch, batchIndex) => {
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) for (let i = 0; i < 7; i++) {
      const index = sideIndex * 7 + i, side = sideIndex === 0 ? -1 : 1;
      const q = alignment.clone().multiply(new THREE.Quaternion().setFromAxisAngle(spinAxis, roll * 0.35 * (i % 2 ? 1 : -1)));
      dummy.position.set(side * (batchIndex === 0 ? 1.16 : 1.17), 0.42, -1.28 + i * 0.42); dummy.quaternion.copy(q); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); batch.setMatrixAt(index, dummy.matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
  });
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) for (let i = 0; i < 10; i++) {
    const index = sideIndex * 10 + i, side = sideIndex === 0 ? -1 : 1;
    dummy.position.set(side * 1.198, 0.17, -1.45 + i * 0.31); dummy.rotation.set(Math.sin(roll * 2.6 + index * 0.7) * 0.045 + (i < 2 ? -0.12 : i > 7 ? 0.12 : 0), 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); vehicle.trackTreads.setMatrixAt(index, dummy.matrix);
  }
  vehicle.trackTreads.instanceMatrix.needsUpdate = true;
}

export function getMuzzleWorld(vehicle: Vehicle): THREE.Vector3 {
  vehicle.root.updateMatrixWorld(true);
  return vehicle.cannon.localToWorld(new THREE.Vector3(0, 0, 2.74));
}
