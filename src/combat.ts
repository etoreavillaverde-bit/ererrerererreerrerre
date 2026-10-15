import * as THREE from 'three';
import type { GameCallbacks, Obstacle, Shell, Vehicle } from './types';
import { terrainHeight } from './world';
import { getMuzzleWorld } from './vehicle';
import { Effects } from './effects';
import { AudioSystem } from './audio';

function segmentDistanceSquared(start: THREE.Vector3, end: THREE.Vector3, point: THREE.Vector3): number {
  const segment = end.clone().sub(start); const lenSq = segment.lengthSq();
  const t = lenSq > 0 ? THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lenSq, 0, 1) : 0;
  return point.distanceToSquared(start.clone().addScaledVector(segment, t));
}

export class Combat {
  private readonly shells: Shell[] = [];
  private readonly shellGeometry = new THREE.SphereGeometry(0.09, 8, 6);
  private readonly shellMaterial = new THREE.MeshBasicMaterial({ color: '#ffd18c' });
  private readonly trailMaterials: THREE.LineBasicMaterial[] = [];
  private readonly trailMaterial = new THREE.LineBasicMaterial({ color: '#ffb357', transparent: true, opacity: 0.63, blending: THREE.AdditiveBlending });
  private readonly sound: AudioSystem;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly obstacles: Obstacle[],
    private readonly vehicles: () => Vehicle[],
    private readonly effects: Effects,
    private readonly callbacks: GameCallbacks,
    sound: AudioSystem,
  ) { this.sound = sound; }

  private acquireShell(owner: Vehicle): Shell {
    let shell = this.shells.find(candidate => !candidate.active);
    if (!shell) {
      const mesh = new THREE.Mesh(this.shellGeometry, this.shellMaterial); mesh.visible = false; this.scene.add(mesh);
      const geometry = new THREE.BufferGeometry(); geometry.setFromPoints(Array.from({ length: 5 }, () => new THREE.Vector3()));
      const material = this.trailMaterial.clone(); this.trailMaterials.push(material);
      const trail = new THREE.Line(geometry, material); trail.visible = false; this.scene.add(trail);
      shell = { mesh, trail, points: Array.from({ length: 5 }, () => new THREE.Vector3()), position: new THREE.Vector3(), velocity: new THREE.Vector3(), owner, life: 0, damage: 0, active: false };
      this.shells.push(shell);
    }
    return shell;
  }

  fire(owner: Vehicle, damage = 44): boolean {
    if (!owner.alive || owner.reload > 0 || (owner.faction === 'player' && owner.ammo <= 0)) return false;
    const shell = this.acquireShell(owner);
    const muzzle = getMuzzleWorld(owner);
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(owner.cannon.quaternion).applyQuaternion(owner.turret.quaternion).applyQuaternion(owner.root.quaternion).normalize();
    shell.owner = owner; shell.position.copy(muzzle); shell.velocity.copy(direction).multiplyScalar(owner.faction === 'player' ? 83 : 69);
    shell.life = owner.faction === 'player' ? 3.5 : 4.2; shell.damage = damage; shell.active = true;
    shell.mesh.position.copy(muzzle); shell.mesh.visible = true;
    shell.points.forEach((point, index) => point.copy(muzzle).addScaledVector(direction, -index * 0.55));
    const positions = new Float32Array(shell.points.length * 3);
    shell.points.forEach((point, i) => { positions[i * 3] = point.x; positions[i * 3 + 1] = point.y; positions[i * 3 + 2] = point.z; });
    shell.trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); shell.trail.geometry.attributes.position.needsUpdate = true; shell.trail.geometry.computeBoundingSphere();
    shell.trail.visible = true;
    if (owner.faction === 'player') { owner.ammo--; owner.reload = owner.ammo === 0 ? 4.2 : 2.4; }
    else owner.reload = 3.6 + Math.random() * 1.4;
    owner.recoil = 0.65;
    this.effects.muzzle(muzzle, direction, owner.faction === 'player' ? 1 : 0.82); this.sound.cannon();
    if (owner.faction === 'player') this.callbacks.shake(0.2);
    return true;
  }

  private deactivate(shell: Shell): void { shell.active = false; shell.mesh.visible = false; shell.trail.visible = false; }

  private destroy(vehicle: Vehicle, point: THREE.Vector3): void {
    vehicle.alive = false; vehicle.hp = 0; vehicle.velocity.set(0, 0, 0); vehicle.root.rotation.z = 0.07; vehicle.position.y -= 0.22;
    vehicle.meshMaterials.forEach(material => { material.color.set('#383832'); material.emissive.set('#100d0b'); material.emissiveIntensity = 0.12; });
    this.effects.explosion(point, vehicle.faction === 'player' ? 1.35 : 1, 20);
    this.sound.explosion(); this.callbacks.hit('destroy');
    if (vehicle.faction === 'enemy') {
      this.callbacks.message(`${vehicle.name} destruido`, 'good');
    } else {
      this.callbacks.message('Vehículo destruido · misión fallida', 'bad'); this.callbacks.setStatus('lost');
    }
  }

  private applyHit(shell: Shell, vehicle: Vehicle, point: THREE.Vector3): void {
    const incoming = shell.velocity.clone().normalize();
    vehicle.root.updateMatrixWorld(true);
    const local = vehicle.root.worldToLocal(point.clone());
    let part = 'casco'; let multiplier = 1;
    if (local.y > 1.45) { part = 'torreta'; multiplier = 0.9; }
    else if (local.y > 1.05 && Math.abs(local.x) < 0.36 && local.z > 1.0) { part = 'cañón'; multiplier = 0.5; }
    else if (Math.abs(local.x) > 0.87 && local.y < 1.05) { part = 'orugas'; multiplier = 0.62; }
    const normal = point.clone().sub(vehicle.position.clone().add(new THREE.Vector3(0, 0.8, 0))).normalize();
    const incidence = Math.abs(incoming.dot(normal));
    const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
    const frontHit = forward.dot(incoming.clone().negate()) > 0.24;
    const bounceChance = incidence < 0.32 ? 0.72 : frontHit ? 0.14 : 0.045;
    if (Math.random() < bounceChance) {
      this.effects.impact(point, true); this.sound.ricochet(); this.callbacks.hit('bounce');
      this.callbacks.message(`Rebote · impacto en ${part}`, 'neutral'); return;
    }
    let damage = shell.damage * multiplier * (frontHit ? 0.8 : 1) * (0.88 + Math.random() * 0.24);
    if (part === 'torreta') vehicle.turretAngle += (Math.random() - 0.5) * 0.22;
    if (part === 'orugas') vehicle.velocity.multiplyScalar(0.4);
    vehicle.hp = Math.max(0, vehicle.hp - damage);
    for (const mat of vehicle.meshMaterials) { mat.emissive.set('#b85b2b'); mat.emissiveIntensity = 0.55; }
    window.setTimeout(() => vehicle.meshMaterials.forEach(mat => { mat.emissive.set('#000000'); mat.emissiveIntensity = 0; }), 110);
    this.effects.impact(point); this.sound.impact(); this.callbacks.hit('hit');
    if (vehicle.faction === 'player') this.callbacks.shake(0.26);
    this.callbacks.message(`${part.toUpperCase()} impactado · −${Math.round(damage)} PV`, vehicle.faction === 'enemy' ? 'good' : 'bad');
    if (vehicle.hp <= 0) this.destroy(vehicle, point);
  }

  update(delta: number): void {
    const dt = Math.min(delta, 0.045);
    for (const shell of this.shells) {
      if (!shell.active) continue;
      const previous = shell.position.clone(); shell.position.addScaledVector(shell.velocity, dt); shell.velocity.y -= 9.81 * dt; shell.life -= dt;
      shell.mesh.position.copy(shell.position);
      shell.points.unshift(shell.position.clone()); shell.points.pop();
      const attr = shell.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      shell.points.forEach((point, i) => attr.setXYZ(i, point.x, point.y, point.z)); attr.needsUpdate = true; shell.trail.geometry.computeBoundingSphere();
      let hit = false;
      for (const target of this.vehicles()) {
        if (!target.alive || target === shell.owner) continue;
        const center = target.position.clone().add(new THREE.Vector3(0, 0.9, 0));
        if (segmentDistanceSquared(previous, shell.position, center) < 1.35 ** 2) {
          this.applyHit(shell, target, shell.position.clone()); hit = true; break;
        }
      }
      if (!hit) {
        for (const obstacle of this.obstacles) {
          const dx = shell.position.x - obstacle.position.x, dz = shell.position.z - obstacle.position.z;
          if (dx * dx + dz * dz < obstacle.radius ** 2 && shell.position.y < obstacle.position.y + obstacle.height && shell.position.y > obstacle.position.y - 0.3) {
            this.effects.impact(shell.position, true); this.sound.ricochet(); this.callbacks.hit('miss'); hit = true; break;
          }
        }
      }
      if (!hit && shell.position.y <= terrainHeight(shell.position.x, shell.position.z) + 0.05) {
        const point = shell.position.clone(); point.y = terrainHeight(point.x, point.z) + 0.04;
        this.effects.impact(point); this.sound.impact();
        if (shell.owner.faction === 'player') this.callbacks.hit('miss');
        hit = true;
      }
      if (hit || shell.life <= 0 || Math.abs(shell.position.x) > 180 || Math.abs(shell.position.z) > 180) this.deactivate(shell);
    }
  }

  dispose(): void {
    for (const shell of this.shells) { this.scene.remove(shell.mesh, shell.trail); shell.trail.geometry.dispose(); }
    for (const mat of this.trailMaterials) mat.dispose(); this.shellGeometry.dispose(); this.shellMaterial.dispose(); this.trailMaterial.dispose();
  }
}
