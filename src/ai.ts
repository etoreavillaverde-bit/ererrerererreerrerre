import * as THREE from 'three';
import type { Obstacle, Vehicle } from './types';
import { obstacleCollision, terrainHeight } from './world';
import { updateVehicleModel } from './vehicle';
import { Effects } from './effects';
import { Combat } from './combat';

const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

function hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3, obstacles: Obstacle[]): boolean {
  const delta = to.clone().sub(from); const distance = delta.length(); const steps = Math.ceil(distance / 3.5);
  for (let i = 1; i < steps; i++) {
    const p = from.clone().addScaledVector(delta, i / steps);
    if (obstacles.some(o => (p.x - o.position.x) ** 2 + (p.z - o.position.z) ** 2 < o.radius ** 2 * 0.48 && p.y < o.position.y + o.height * 0.82)) return false;
  }
  return true;
}

function moveVehicle(vehicle: Vehicle, direction: number, turning: number, delta: number, obstacles: Obstacle[], effects: Effects, steeringBoost = 1): void {
  const dt = Math.min(delta, 0.04);
  const speed = vehicle.velocity.length();
  const grip = Math.max(0.27, 1 - speed / 17);
  vehicle.heading += turning * (1.3 + grip * 1.4) * steeringBoost * dt;
  const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
  const hillAhead = terrainHeight(vehicle.position.x + forward.x * 1.3, vehicle.position.z + forward.z * 1.3) - vehicle.position.y;
  const slopePenalty = hillAhead > 0 ? Math.max(0.35, 1 - hillAhead * 0.18) : 1;
  vehicle.velocity.addScaledVector(forward, direction * (direction > 0 ? 8.0 : 4.9) * slopePenalty * dt);
  if (Math.abs(direction) < 0.05) vehicle.velocity.multiplyScalar(Math.exp(-1.55 * dt));
  else vehicle.velocity.multiplyScalar(Math.exp(-0.24 * dt));
  const lateral = vehicle.velocity.clone().sub(forward.clone().multiplyScalar(vehicle.velocity.dot(forward)));
  vehicle.velocity.addScaledVector(lateral, -Math.min(1, dt * 2.1));
  const next = vehicle.position.clone().addScaledVector(vehicle.velocity, dt);
  next.x = THREE.MathUtils.clamp(next.x, -158, 158); next.z = THREE.MathUtils.clamp(next.z, -158, 158);
  if (obstacleCollision(next, 1.23, obstacles)) vehicle.velocity.multiplyScalar(-0.16);
  else {
    vehicle.position.x = next.x; vehicle.position.z = next.z;
    vehicle.position.y = terrainHeight(next.x, next.z);
  }
  if (speed > 3 && Math.random() < dt * 2.3) effects.dust(vehicle.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.16, (Math.random() - 0.5) * 1.4)), 2);
}

export class TankAI {
  constructor(private readonly obstacles: Obstacle[], private readonly effects: Effects, private readonly combat: Combat) {}

  update(enemies: Vehicle[], player: Vehicle, delta: number): void {
    if (!player.alive) return;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dt = Math.min(delta, 0.05);
      const toPlayer = player.position.clone().sub(enemy.position); toPlayer.y = 0;
      const distance = toPlayer.length();
      enemy.aiTimer -= dt;
      if (enemy.aiTimer <= 0 || enemy.moveGoal.distanceTo(enemy.position) < 5) {
        const targetDirection = toPlayer.clone().normalize();
        const flank = new THREE.Vector3(-targetDirection.z, 0, targetDirection.x).multiplyScalar((Math.random() - 0.5) * 50);
        const standOff = distance > 58 ? 24 : distance < 27 ? -22 : 4;
        enemy.moveGoal.copy(enemy.position).addScaledVector(targetDirection, standOff).add(flank);
        enemy.moveGoal.x = THREE.MathUtils.clamp(enemy.moveGoal.x, -148, 148); enemy.moveGoal.z = THREE.MathUtils.clamp(enemy.moveGoal.z, -148, 148);
        enemy.aiTimer = 1.8 + Math.random() * 2.4;
      }
      const goal = enemy.moveGoal.clone().sub(enemy.position); goal.y = 0;
      const desiredMoveHeading = Math.atan2(goal.x, goal.z);
      const turnToGoal = THREE.MathUtils.clamp(angleDiff(desiredMoveHeading, enemy.heading) * 1.3, -1, 1);
      const headingError = Math.abs(angleDiff(desiredMoveHeading, enemy.heading));
      const drive = headingError > 1.2 && enemy.velocity.length() > 2 ? -0.5 : distance > 18 ? 0.78 : Math.max(0.22, Math.min(0.58, (distance - 13) / 25));
      moveVehicle(enemy, drive, turnToGoal, dt, this.obstacles, this.effects, 0.76);
      const aimPoint = player.position.clone().add(new THREE.Vector3(0, 0.96, 0)).addScaledVector(player.velocity, 0.42);
      const deltaToAim = aimPoint.clone().sub(enemy.position); const targetWorldHeading = Math.atan2(deltaToAim.x, deltaToAim.z);
      const turretWorld = enemy.heading + enemy.turretAngle;
      enemy.turretAngle += THREE.MathUtils.clamp(angleDiff(targetWorldHeading, turretWorld), -1.65 * dt, 1.65 * dt);
      const horizontal = Math.hypot(deltaToAim.x, deltaToAim.z);
      const desiredElevation = THREE.MathUtils.clamp(Math.atan2(deltaToAim.y, horizontal) + horizontal * 0.0007, -0.08, 0.24);
      enemy.elevation = THREE.MathUtils.damp(enemy.elevation, desiredElevation, 1.8, dt);
      enemy.reload = Math.max(0, enemy.reload - dt);
      enemy.moveClock += dt;
      if (enemy.hp < 42 && Math.random() < dt * 0.9) this.effects.smoke(enemy.position.clone().add(new THREE.Vector3(0, 1.7, 0)), 2);
      if (distance < 108 && distance > 10 && Math.abs(angleDiff(targetWorldHeading, turretWorld)) < 0.09 && hasLineOfSight(enemy.position.clone().add(new THREE.Vector3(0, 1.8, 0)), aimPoint, this.obstacles) && enemy.reload <= 0) {
        this.combat.fire(enemy, 28 + Math.random() * 8);
      }
      updateVehicleModel(enemy, dt);
    }
  }
}

export { moveVehicle, angleDiff };
