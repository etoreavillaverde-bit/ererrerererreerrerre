import * as THREE from 'three';

export class Controls {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  pointerDX = 0;
  pointerDY = 0;
  aimHeading = 0;
  aimElevation = 0.025;
  rightMouse = false;
  zoom = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly keyDown = (event: KeyboardEvent) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyR', 'Escape', 'Space'].includes(event.code)) event.preventDefault();
    if (!this.keys.has(event.code)) this.pressed.add(event.code);
    this.keys.add(event.code);
  };
  private readonly keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private readonly mouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.pointerDX += event.movementX; this.pointerDY += event.movementY;
  };
  private readonly mouseDown = (event: MouseEvent) => {
    if (event.button === 2) { this.rightMouse = true; this.zoom = true; event.preventDefault(); }
  };
  private readonly mouseUp = (event: MouseEvent) => { if (event.button === 2) { this.rightMouse = false; this.zoom = false; } };
  private readonly contextMenu = (event: MouseEvent) => event.preventDefault();
  private readonly lockChange = () => {
    if (document.pointerLockElement !== this.canvas) { this.rightMouse = false; this.zoom = false; }
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    window.addEventListener('mousemove', this.mouseMove); window.addEventListener('mousedown', this.mouseDown); window.addEventListener('mouseup', this.mouseUp);
    window.addEventListener('contextmenu', this.contextMenu);
    document.addEventListener('pointerlockchange', this.lockChange);
  }

  down(code: string): boolean { return this.keys.has(code); }
  consumePress(code: string): boolean { const result = this.pressed.has(code); this.pressed.delete(code); return result; }
  consumeLook(): THREE.Vector2 { const value = new THREE.Vector2(this.pointerDX, this.pointerDY); this.pointerDX = this.pointerDY = 0; return value; }
  clear(): void { this.keys.clear(); this.pressed.clear(); this.pointerDX = this.pointerDY = 0; this.rightMouse = this.zoom = false; }
  capture(): Promise<void> {
    try { return this.canvas.requestPointerLock({ unadjustedMovement: true }).catch(() => this.canvas.requestPointerLock()); }
    catch { return this.canvas.requestPointerLock(); }
  }
  release(): void { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  get captured(): boolean { return document.pointerLockElement === this.canvas; }

  dispose(): void {
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('mousemove', this.mouseMove);
    window.removeEventListener('mousedown', this.mouseDown); window.removeEventListener('mouseup', this.mouseUp); window.removeEventListener('contextmenu', this.contextMenu);
    document.removeEventListener('pointerlockchange', this.lockChange);
  }
}
