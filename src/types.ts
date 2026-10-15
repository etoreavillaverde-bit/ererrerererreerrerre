import type * as THREE from 'three';

export type Quality = 'baja' | 'media' | 'alta';
export type Faction = 'player' | 'enemy';

export interface DamageInfo {
  damage: number;
  part: string;
  hitPoint: THREE.Vector3;
  killed: boolean;
}

export interface Vehicle {
  id: number;
  faction: Faction;
  name: string;
  root: THREE.Group;
  turret: THREE.Group;
  cannon: THREE.Group;
  wheels: THREE.InstancedMesh[];
  trackTreads: THREE.InstancedMesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  turretAngle: number;
  elevation: number;
  hp: number;
  maxHp: number;
  ammo: number;
  magazine: number;
  alive: boolean;
  reload: number;
  aiTimer: number;
  targetHeading: number;
  moveGoal: THREE.Vector3;
  moveClock: number;
  flashTimer: number;
  recoil: number;
  enginePhase: number;
  meshMaterials: THREE.MeshStandardMaterial[];
}

export interface Obstacle {
  position: THREE.Vector3;
  radius: number;
  height: number;
  kind: 'rock' | 'building' | 'tree' | 'barrier';
}

export interface Shell {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  points: THREE.Vector3[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  owner: Vehicle;
  life: number;
  damage: number;
  active: boolean;
}

export interface GameCallbacks {
  message: (text: string, tone?: 'good' | 'bad' | 'neutral') => void;
  hit: (kind: 'hit' | 'bounce' | 'destroy' | 'miss') => void;
  setStatus: (state: 'playing' | 'won' | 'lost') => void;
  shake: (strength: number) => void;
}
