import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  duration: number;
  rise: number;
  initialScale: number;
  kind: 'spark' | 'smoke' | 'dust' | 'debris';
}

interface Explosion {
  active: boolean;
  age: number;
  duration: number;
  position: THREE.Vector3;
  flash: THREE.Mesh;
  fire: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  scorch: THREE.Mesh;
  scale: number;
}

export class Effects {
  private readonly particles: Particle[] = [];
  private readonly explosions: Explosion[] = [];
  private readonly particleGeometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly fireGeometry = new THREE.IcosahedronGeometry(1, 2);
  private readonly ringGeometry = new THREE.TorusGeometry(1, 0.07, 5, 28);
  private readonly scorchMaterial = new THREE.MeshBasicMaterial({ color: '#1f211d', transparent: true, opacity: 0.74, depthWrite: false });
  private readonly particleMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly shake: (strength: number) => void) {
    const palette: [string, Particle['kind']][] = [
      ['#ffb045', 'spark'], ['#ffd47c', 'spark'], ['#d85c2d', 'spark'], ['#5d514b', 'smoke'],
      ['#776b60', 'smoke'], ['#9a8875', 'smoke'], ['#a89a80', 'dust'], ['#4c514c', 'debris'],
    ];
    for (let i = 0; i < 170; i++) {
      const [color, kind] = palette[i % palette.length]!;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }); this.particleMaterials.push(mat);
      const mesh = new THREE.Mesh(this.particleGeometry, mat); mesh.visible = false; scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, duration: 1, rise: 0, initialScale: 1, kind });
    }
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff9b36', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const flashMat = new THREE.MeshBasicMaterial({ color: '#fff0c1', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc36a', transparent: true, opacity: 0, depthWrite: false });
    const fireMaterials = Array.from({ length: 10 }, () => fireMat.clone());
    const flashMaterials = Array.from({ length: 10 }, () => flashMat.clone());
    const ringMaterials = Array.from({ length: 10 }, () => ringMat.clone());
    for (let i = 0; i < 10; i++) {
      const fire = new THREE.Mesh(this.fireGeometry, fireMaterials[i]!); fire.visible = false; scene.add(fire);
      const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), flashMaterials[i]!); flash.visible = false; scene.add(flash);
      const ring = new THREE.Mesh(this.ringGeometry, ringMaterials[i]!); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
      const light = new THREE.PointLight('#ff9a43', 0, 45, 2); scene.add(light);
      const scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 22), this.scorchMaterial.clone()); scorch.rotation.x = -Math.PI / 2; scorch.visible = false; scene.add(scorch);
      this.explosions.push({ active: false, age: 0, duration: 2.4, position: new THREE.Vector3(), flash, fire, ring, light, scorch, scale: 1 });
    }
  }

  private burst(position: THREE.Vector3, count: number, strength: number, kind: Particle['kind']): void {
    let emitted = 0;
    for (const p of this.particles) {
      if (emitted >= count) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2, up = Math.random() * 2 - 0.32;
      const speed = strength * (0.35 + Math.random() * 0.85);
      p.mesh.position.copy(position);
      p.velocity.set(Math.cos(a) * speed, up * speed * 0.72, Math.sin(a) * speed);
      if (kind === 'smoke' || kind === 'dust') { p.velocity.multiplyScalar(0.23); p.velocity.y += 0.65 + Math.random() * 1.0; }
      p.kind = kind; p.duration = kind === 'smoke' ? 2.2 + Math.random() * 1.6 : kind === 'dust' ? 0.9 + Math.random() * 0.8 : 0.48 + Math.random() * 0.72;
      p.life = p.duration; p.rise = kind === 'smoke' ? 1.0 : 0;
      p.initialScale = kind === 'smoke' ? 0.42 + Math.random() * 0.5 : 0.09 + Math.random() * 0.18;
      p.mesh.scale.setScalar(p.initialScale); p.mesh.visible = true;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(kind === 'smoke' ? (Math.random() > 0.5 ? '#55514c' : '#82796d') : kind === 'dust' ? '#a69a82' : kind === 'debris' ? '#554638' : Math.random() > 0.5 ? '#ffb347' : '#ee6333');
      mat.opacity = kind === 'smoke' ? 0.6 : kind === 'dust' ? 0.36 : 0.94;
      emitted++;
    }
  }

  explosion(position: THREE.Vector3, scale = 1, distance = 25): void {
    const fx = this.explosions.find(item => !item.active) ?? this.explosions[0]!;
    fx.active = true; fx.age = 0; fx.position.copy(position); fx.scale = scale; fx.duration = 2.6 + scale * 0.4;
    for (const mesh of [fx.flash, fx.fire, fx.ring, fx.scorch]) { mesh.position.copy(position); mesh.visible = true; }
    fx.flash.position.y += 0.75 * scale; fx.fire.position.y += 0.52 * scale; fx.ring.position.y += 0.1; fx.scorch.position.y += 0.08;
    fx.fire.scale.setScalar(0.05); fx.flash.scale.setScalar(0.15); fx.ring.scale.setScalar(0.18); fx.scorch.scale.setScalar(0.8 * scale);
    fx.light.position.copy(position).y += 1.2; fx.light.intensity = 8 * scale; fx.light.distance = 30 * scale;
    const scorchMat = fx.scorch.material as THREE.MeshBasicMaterial; scorchMat.opacity = 0.74;
    (fx.fire.material as THREE.MeshBasicMaterial).opacity = 1;
    (fx.flash.material as THREE.MeshBasicMaterial).opacity = 1;
    (fx.ring.material as THREE.MeshBasicMaterial).opacity = 0.85;
    this.burst(position.clone().add(new THREE.Vector3(0, 0.9, 0)), Math.round(34 * scale), 8 * scale, 'spark');
    this.burst(position.clone().add(new THREE.Vector3(0, 0.8, 0)), Math.round(14 * scale), 3.2 * scale, 'debris');
    this.burst(position.clone().add(new THREE.Vector3(0, 0.45, 0)), Math.round(11 * scale), 1.8 * scale, 'smoke');
    this.shake(Math.max(0, 1 - distance / 92) * 0.48 * scale);
  }

  muzzle(position: THREE.Vector3, direction: THREE.Vector3, strength = 1): void {
    this.burst(position, 8, 2.3 * strength, 'spark');
    const point = new THREE.PointLight('#ffc374', 3.4 * strength, 17); point.position.copy(position); this.scene.add(point);
    // Muzzle lights are short-lived and handled by a tiny pooled particle proxy.
    const p = this.particles.find(item => item.life <= 0);
    if (p) {
      p.mesh.position.copy(position).addScaledVector(direction, 0.18); p.mesh.scale.set(0.56, 0.3, 0.75);
      p.mesh.visible = true; p.life = p.duration = 0.055; p.kind = 'spark';
      (p.mesh.material as THREE.MeshBasicMaterial).color.set('#fff0bd'); (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    }
    window.setTimeout(() => { this.scene.remove(point); }, 85);
  }

  impact(position: THREE.Vector3, bounce = false): void { this.burst(position, bounce ? 6 : 13, bounce ? 3.6 : 4.4, bounce ? 'spark' : 'dust'); }
  dust(position: THREE.Vector3, amount = 3): void { this.burst(position, amount, 1.1, 'dust'); }
  smoke(position: THREE.Vector3, amount = 2): void { this.burst(position, amount, 0.55, 'smoke'); }

  tick(delta: number): void {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= delta;
      const age = 1 - Math.max(0, p.life) / p.duration;
      p.mesh.position.addScaledVector(p.velocity, delta);
      if (p.kind === 'smoke') { p.velocity.y += p.rise * delta * 0.38; p.mesh.scale.setScalar(p.initialScale * (1 + age * 2.9)); }
      else if (p.kind === 'dust') { p.mesh.scale.setScalar(p.initialScale * (1 + age * 1.6)); }
      else { p.velocity.y -= 4.8 * delta; p.mesh.scale.setScalar(p.initialScale * (1 - age * 0.45)); }
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (p.kind === 'smoke' ? 0.44 : p.kind === 'dust' ? 0.27 : 0.85) * (1 - age);
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const fx of this.explosions) {
      if (!fx.active) continue;
      fx.age += delta; const t = fx.age / fx.duration;
      if (t >= 1) { fx.active = false; fx.flash.visible = fx.fire.visible = fx.ring.visible = fx.scorch.visible = false; fx.light.intensity = 0; continue; }
      const fireScale = (0.2 + Math.sin(Math.min(1, t * 3) * Math.PI) * 2.25) * fx.scale;
      fx.fire.scale.set(fireScale, fireScale * 1.2, fireScale); fx.fire.position.y = fx.position.y + 0.45 + Math.sin(fx.age * 12) * 0.13;
      (fx.fire.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.88 * (1 - Math.max(0, t - 0.35) / 0.65));
      fx.flash.scale.setScalar((0.7 + (1 - Math.min(1, t * 10)) * 3.2) * fx.scale); (fx.flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t * 12);
      fx.ring.scale.setScalar((0.2 + t * 4.2) * fx.scale); (fx.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      (fx.scorch.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.74 * (1 - t / 9));
      fx.light.intensity = Math.max(0, 8 * fx.scale * (1 - t * 1.4));
    }
  }

  dispose(): void {
    this.scene.traverse(() => undefined);
    for (const p of this.particles) { this.scene.remove(p.mesh); (p.mesh.material as THREE.Material).dispose(); }
    for (const fx of this.explosions) {
      this.scene.remove(fx.flash, fx.fire, fx.ring, fx.light, fx.scorch);
      (fx.flash.material as THREE.Material).dispose(); (fx.fire.material as THREE.Material).dispose(); (fx.ring.material as THREE.Material).dispose(); (fx.scorch.material as THREE.Material).dispose();
    }
    this.particleGeometry.dispose(); this.fireGeometry.dispose(); this.ringGeometry.dispose(); this.scorchMaterial.dispose();
  }
}
