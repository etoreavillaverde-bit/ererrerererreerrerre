import * as THREE from 'three';
import { createWorld, obstacleCollision, terrainHeight } from './world';
import { createVehicle, updateVehicleModel } from './vehicle';
import { Controls } from './controls';
import { moveVehicle, TankAI, angleDiff } from './ai';
import { Combat } from './combat';
import { Effects } from './effects';
import { AudioSystem } from './audio';
import { Settings } from './settings';
import { GameUI } from './ui';
import type { GameCallbacks, Quality, Shell, Vehicle } from './types';

type State = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

interface GameTestApi {
  snapshot: () => { state: State; playerId: number; playerHp: number; ammo: number; enemies: { id: number; hp: number; alive: boolean }[] };
  hit: (vehicleId: number, damage: number) => void;
  fireAt: (vehicleId: number) => void;
}

declare global { interface Window { __steelHorizonTest?: GameTestApi } }

function disposeVehicle(vehicle: Vehicle): void {
  vehicle.root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose());
    else node.material.dispose();
  });
  vehicle.root.removeFromParent();
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world = createWorld();
  private readonly settings = new Settings();
  private readonly controls: Controls;
  private readonly effects: Effects;
  private readonly audio: AudioSystem;
  private readonly ui: GameUI;
  private combat: Combat;
  private ai!: TankAI;
  private vehicles: Vehicle[] = [];
  private player!: Vehicle;
  private enemies: Vehicle[] = [];
  private state: State = 'menu';
  private lastTime = 0;
  private animation = 0;
  private lastFire = false;
  private cameraMode = 0;
  private shake = 0;
  private fireHeld = false;
  private shotQueued = false;
  private manualReload = false;
  private escapeGuard = 0;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraOffset = new THREE.Vector3();
  private readonly keydown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      if (this.state === 'playing') { event.preventDefault(); this.pause(); }
      else if (this.state === 'paused') { event.preventDefault(); this.resume(); }
    }
  };
  private readonly pointerChange = () => {
    this.ui.setLocked(this.controls.captured);
    if (!this.controls.captured && this.state === 'playing' && performance.now() > this.escapeGuard) this.pause(true);
  };
  private readonly canvasClick = () => {
    if (this.state === 'playing' && !this.controls.captured) void this.captureMouse();
  };
  private readonly canvasMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && this.state === 'playing' && this.controls.captured) { this.fireHeld = true; this.shotQueued = true; }
  };
  private readonly canvasMouseUp = (event: MouseEvent) => { if (event.button === 0) this.fireHeld = false; };
  private readonly resize = () => {
    const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.quality === 'alta' ? 1.35 : this.settings.quality === 'media' ? 0.92 : 0.72));
  };

  constructor() {
    this.canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.17;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 360);
    this.controls = new Controls(this.canvas);
    this.audio = new AudioSystem(this.settings.volume);
    this.effects = new Effects(this.world.scene, strength => { this.shake = Math.min(0.75, this.shake + strength); });
    const root = document.querySelector<HTMLElement>('#ui-root')!;
    this.ui = new GameUI(root, {
      start: () => this.startBattle(), resume: () => this.resume(), menu: () => this.showMenu(), replay: () => this.startBattle(),
      quality: quality => this.setQuality(quality), volume: value => { this.audio.setVolume(value); },
    }, this.audio.volume);
    this.combat = this.makeCombat();
    // A parked tank gives the title screen a quiet, in-world backdrop.
    this.player = createVehicle(this.world.scene, 'player', -20, 0, 'BISON-01'); this.vehicles = [this.player];
    this.player.heading = 0; updateVehicleModel(this.player, 0);
    this.camera.position.set(-78, 68, 88); this.camera.lookAt(0, 3, 0);
    this.settings.apply(this.renderer, this.world.sun, this.world.scene, this.camera);
    this.ui.setQuality(this.settings.quality);
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.keydown);
    document.addEventListener('pointerlockchange', this.pointerChange);
    this.canvas.addEventListener('click', this.canvasClick); this.canvas.addEventListener('mousedown', this.canvasMouseDown); window.addEventListener('mouseup', this.canvasMouseUp);
    this.resize(); this.animation = requestAnimationFrame(this.frame);
    this.installDevTestApi();
  }

  private installDevTestApi(): void {
    if (!import.meta.env.DEV) return;
    window.__steelHorizonTest = {
      snapshot: () => ({ state: this.state, playerId: this.player.id, playerHp: this.player.hp, ammo: this.player.ammo, enemies: this.enemies.map(enemy => ({ id: enemy.id, hp: enemy.hp, alive: enemy.alive })) }),
      fireAt: vehicleId => {
        const target = this.vehicles.find(candidate => candidate.id === vehicleId);
        if (!target?.alive || !this.player?.alive) return;
        const playerPos = this.player.position.clone();
        let destination: THREE.Vector3 | null = null;
        let chosenAngle = 0;
        for (let i = 0; i < 32; i++) {
          const angle = i * Math.PI * 2 / 32, direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
          const candidate = playerPos.clone().addScaledVector(direction, 12); candidate.y = terrainHeight(candidate.x, candidate.z);
          const blocked = obstacleCollision(candidate, 1.4, this.world.obstacles) || [3, 6, 9].some(distance => obstacleCollision(playerPos.clone().addScaledVector(direction, distance), 0.7, this.world.obstacles));
          if (!blocked) { destination = candidate; chosenAngle = angle; break; }
        }
        if (!destination) throw new Error('No se encontró una línea corta libre para comprobar el proyectil.');
        target.position.copy(destination); target.velocity.set(0, 0, 0); target.heading = chosenAngle; target.root.rotation.y = chosenAngle;
        target.moveGoal.copy(destination).add(new THREE.Vector3(Math.sin(chosenAngle) * 25, 0, Math.cos(chosenAngle) * 25)); target.moveGoal.y = terrainHeight(target.moveGoal.x, target.moveGoal.z); target.aiTimer = 4; target.reload = 4;
        this.player.velocity.set(0, 0, 0); this.player.heading = chosenAngle; this.player.root.rotation.y = chosenAngle;
        this.controls.aimHeading = chosenAngle; this.player.turretAngle = 0;
        this.player.elevation = THREE.MathUtils.clamp(Math.atan2(destination.y + 0.9 - (this.player.position.y + 1.82), 12) + 12 * 0.0007, -0.09, 0.27);
        this.player.reload = 0; if (this.player.ammo <= 0) this.player.ammo = this.player.magazine;
        updateVehicleModel(this.player, 0); this.combat.fire(this.player);
      },
      hit: (vehicleId, damage) => {
        const vehicle = this.vehicles.find(candidate => candidate.id === vehicleId);
        if (!vehicle?.alive || !this.player) return;
        const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
        const point = vehicle.root.localToWorld(new THREE.Vector3(0, 0.82, -1.25));
        const shell = { owner: this.player, velocity: forward, damage } as Shell;
        (this.combat as unknown as { applyHit: (shell: Shell, target: Vehicle, point: THREE.Vector3) => void }).applyHit(shell, vehicle, point);
      },
    };
  }

  private makeCombat(): Combat {
    return new Combat(this.world.scene, this.world.obstacles, () => this.vehicles, this.effects, {
      message: (text, tone) => this.ui?.showMessage(text, tone),
      hit: kind => this.ui?.hit(kind), setStatus: status => this.endBattle(status),
      shake: strength => { this.shake = Math.min(0.75, this.shake + strength); },
    } satisfies GameCallbacks, this.audio);
  }

  private setQuality(quality: Quality): void {
    this.settings.setQuality(quality); this.settings.apply(this.renderer, this.world.sun, this.world.scene, this.camera); this.ui.setQuality(quality);
  }

  private openSpawn(x: number, z: number): THREE.Vector3 {
    let candidate = new THREE.Vector3(x, terrainHeight(x, z), z);
    for (let i = 0; i < 18 && obstacleCollision(candidate, 2.2, this.world.obstacles); i++) {
      const angle = i * 2.4; candidate.x += Math.cos(angle) * 3; candidate.z += Math.sin(angle) * 3; candidate.y = terrainHeight(candidate.x, candidate.z);
    }
    return candidate;
  }

  private clearVehicles(): void {
    for (const vehicle of this.vehicles) disposeVehicle(vehicle);
    this.vehicles = []; this.enemies = [];
  }

  private startBattle(): void {
    this.fireHeld = false; this.shotQueued = false; this.lastFire = false; this.manualReload = false; this.controls.clear();
    this.clearVehicles(); this.combat.dispose(); this.combat = this.makeCombat();
    this.player = createVehicle(this.world.scene, 'player', -20, 0, 'BISON-01');
    this.player.heading = Math.atan2(80, -24); this.player.turretAngle = 0; this.player.elevation = 0.055;
    const spawn = [[60, -24], [-72, -37], [80, 64], [-95, 72], [7, 126]] as const;
    const names = ['WRAITH-21', 'WRAITH-08', 'WRAITH-13', 'WRAITH-04', 'WRAITH-19'];
    this.enemies = spawn.map(([x, z], i) => {
      const p = this.openSpawn(x, z); const enemy = createVehicle(this.world.scene, 'enemy', p.x, p.z, names[i]!);
      const direction = this.player.position.clone().sub(enemy.position); enemy.heading = Math.atan2(direction.x, direction.z); enemy.turretAngle = 0; enemy.moveGoal.copy(this.player.position).add(new THREE.Vector3(Math.random() * 16 - 8, 0, Math.random() * 16 - 8));
      enemy.root.rotation.y = enemy.heading; return enemy;
    });
    this.vehicles = [this.player, ...this.enemies]; this.ai = new TankAI(this.world.obstacles, this.effects, this.combat);
    this.controls.aimHeading = this.player.heading; this.controls.aimElevation = this.player.elevation;
    const initialForward = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
    this.camera.position.copy(this.player.position).add(new THREE.Vector3(0, 5, 0)).addScaledVector(initialForward, -11.7);
    this.camera.lookAt(this.player.position.clone().addScaledVector(initialForward, 90));
    this.state = 'playing'; this.cameraMode = 0; this.lastTime = performance.now(); this.ui.show('hud'); this.ui.showMessage('Contacto confirmado · elimina los 5 blindados', 'neutral');
    this.audio.resume(); void this.captureMouse(); this.ui.setLocked(false);
  }

  private async captureMouse(): Promise<void> {
    this.audio.resume();
    try { await this.controls.capture(); }
    catch { this.ui.setLocked(false); this.ui.showMessage('El navegador bloqueó la captura. Haz clic dentro del campo para intentarlo de nuevo.', 'bad'); }
    this.ui.setLocked(this.controls.captured);
  }

  private pause(fromPointer = false): void {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.fireHeld = false; this.controls.clear(); this.escapeGuard = performance.now() + 250;
    if (!fromPointer) this.controls.release();
    this.ui.show('pause');
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing'; this.lastTime = performance.now(); this.ui.show('hud'); this.audio.resume(); void this.captureMouse();
  }

  private showMenu(): void {
    this.state = 'menu'; this.fireHeld = false; this.controls.clear(); this.escapeGuard = performance.now() + 250; this.controls.release(); this.ui.show('menu');
  }

  private endBattle(status: 'playing' | 'won' | 'lost'): void {
    if (status === 'playing' || this.state === 'won' || this.state === 'lost') return;
    if (status === 'won' && this.enemies.some(enemy => enemy.alive)) return;
    this.state = status; this.fireHeld = false; this.escapeGuard = performance.now() + 600; this.controls.release();
    const kills = this.enemies.filter(enemy => !enemy.alive).length;
    this.ui.setResult(status === 'won', kills, this.enemies.length); this.ui.show('result');
    this.audio.resume(); this.audio.explosion();
  }

  private updatePlayer(delta: number): void {
    const dt = Math.min(delta, 0.04);
    const look = this.controls.consumeLook();
    if (this.controls.captured) {
      this.controls.aimHeading -= look.x * 0.0024;
      this.controls.aimElevation = THREE.MathUtils.clamp(this.controls.aimElevation - look.y * 0.0021, -0.09, 0.27);
    }
    const throttle = (this.controls.down('KeyW') ? 1 : 0) - (this.controls.down('KeyS') ? 1 : 0);
    const steering = (this.controls.down('KeyA') ? 1 : 0) - (this.controls.down('KeyD') ? 1 : 0);
    moveVehicle(this.player, throttle, steering, dt, this.world.obstacles, this.effects, 1);
    this.player.turretAngle = angleDiff(this.controls.aimHeading, this.player.heading);
    this.player.elevation = this.controls.aimElevation;
    const wasReloading = this.player.reload;
    this.player.reload = Math.max(0, this.player.reload - dt);
    if (wasReloading > 0 && this.player.reload === 0 && this.player.ammo === 0) this.player.ammo = this.player.magazine;
    if (wasReloading > 0 && this.player.reload === 0 && this.manualReload) { this.player.ammo = this.player.magazine; this.manualReload = false; this.ui.showMessage('Cargador listo · 5 proyectiles', 'good'); }
    const rPressed = this.controls.consumePress('KeyR');
    if (rPressed && this.player.ammo < this.player.magazine && this.player.alive) {
      this.player.reload = 3.1; this.manualReload = true; this.ui.showMessage('Recarga del cargador iniciada', 'neutral'); this.audio.enginePing();
    }
    if (this.controls.consumePress('KeyC')) { this.cameraMode = 1 - this.cameraMode; this.audio.enginePing(); }
    if (this.shotQueued || (this.fireHeld && !this.lastFire)) this.combat.fire(this.player);
    this.shotQueued = false;
    this.lastFire = this.fireHeld;
    if (this.player.hp < 42 && Math.random() < dt * 0.9) this.effects.smoke(this.player.position.clone().add(new THREE.Vector3(0, 1.7, 0)), 2);
    this.audio.updateEngine(throttle, this.player.velocity.length());
    updateVehicleModel(this.player, dt);
  }

  private updateCamera(delta: number): void {
    const dt = Math.min(delta, 0.05); const zoom = this.controls.zoom && this.controls.captured;
    const forward = new THREE.Vector3(Math.sin(this.controls.aimHeading), 0, Math.cos(this.controls.aimHeading));
    const target = this.player.position.clone().add(new THREE.Vector3(0, this.cameraMode ? 1.35 : 1.1, 0));
    const distance = zoom ? 6.8 : this.cameraMode ? 7.5 : 11.7;
    const height = zoom ? 2.5 : this.cameraMode ? 3.4 : 5.0;
    const desired = target.clone().addScaledVector(forward, -distance); desired.y += height;
    const terrain = terrainHeight(desired.x, desired.z); if (desired.y < terrain + 1.2) desired.y = terrain + 1.2;
    this.camera.position.lerp(desired, 1 - Math.exp(-5.8 * dt));
    const aimPoint = target.clone().addScaledVector(forward, 90);
    aimPoint.y += Math.tan(this.controls.aimElevation) * 90;
    this.camera.lookAt(aimPoint);
    const targetFov = zoom ? 39 : this.cameraMode ? 60 : 68;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.5, dt); this.camera.updateProjectionMatrix();
    this.shake = Math.max(0, this.shake - dt * 1.65);
    if (this.shake > 0) {
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.7, (Math.random() - 0.5) * this.shake));
    }
    this.cameraTarget.copy(aimPoint); this.cameraOffset.copy(desired);
  }

  private readonly frame = (time: number): void => {
    this.animation = requestAnimationFrame(this.frame);
    if (document.hidden) { this.lastTime = time; return; }
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0.016; this.lastTime = time;
    if (this.state === 'playing') {
      this.updatePlayer(delta); this.ai.update(this.enemies, this.player, delta); this.combat.update(delta); this.effects.tick(delta); this.updateCamera(delta);
      if (this.enemies.length > 0 && this.enemies.every(enemy => !enemy.alive)) this.endBattle('won');
      this.ui.setLocked(this.controls.captured);
      this.ui.update(delta, this.player, this.enemies, this.cameraMode);
    } else if (this.state === 'menu') {
      this.effects.tick(delta); this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, -20 + Math.sin(time * 0.00011) * 2, 0.2, delta);
      this.camera.lookAt(-20, 1.2, -3);
    } else {
      this.effects.tick(delta);
      if (this.vehicles.length) this.ui.update(0, this.player, this.enemies, this.cameraMode);
    }
    this.renderer.render(this.world.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.animation); window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.keydown);
    document.removeEventListener('pointerlockchange', this.pointerChange); this.canvas.removeEventListener('click', this.canvasClick); this.canvas.removeEventListener('mousedown', this.canvasMouseDown); window.removeEventListener('mouseup', this.canvasMouseUp);
    this.controls.dispose(); this.combat.dispose(); this.effects.dispose(); this.audio.dispose(); this.clearVehicles(); this.world.dispose(); this.renderer.dispose();
  }
}
