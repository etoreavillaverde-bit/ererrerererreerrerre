import type { Quality, Vehicle } from './types';

export interface UICallbacks {
  start: () => void;
  resume: () => void;
  menu: () => void;
  replay: () => void;
  quality: (quality: Quality) => void;
  volume: (value: number) => void;
}

export class GameUI {
  private readonly root: HTMLElement;
  private readonly callbacks: UICallbacks;
  private readonly mini: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly notifications: HTMLElement;
  private noticeTimer = 0;
  private readonly hitMark: HTMLElement;
  private hitTimer = 0;
  private readonly lockPrompt: HTMLElement;
  private readonly screens: Record<string, HTMLElement> = {};
  private readonly elements: Record<string, HTMLElement> = {};
  private quality: Quality = 'media';

  constructor(root: HTMLElement, callbacks: UICallbacks, volume: number) {
    this.root = root; this.callbacks = callbacks;
    root.innerHTML = `
      <section class="screen screen-menu active" data-screen="menu">
        <div class="menu-noise"></div><div class="menu-top"><div class="brand-mark"><i></i><i></i></div><span>FRONTERA · SECTOR 07</span><span class="menu-top-right">SIMULACIÓN TÁCTICA <b>● EN LÍNEA</b></span></div>
        <div class="menu-hero"><div class="eyebrow"><span></span> PROTOCOLO DE INTERCEPTACIÓN</div><h1>STEEL<br><em>HORIZON</em></h1><p class="hero-copy">La línea no se sostiene sola.<br>Avanza. Encuentra cobertura. Sobrevive.</p>
          <div class="menu-actions"><button class="btn-primary" data-action="start"><span>INICIAR BATALLA</span><b>↗</b></button><button class="btn-ghost" data-action="controls">VER CONTROLES <span>+</span></button></div>
          <div class="quality-row"><span>CALIDAD GRÁFICA</span><div class="segmented"><button data-quality="baja">BAJA</button><button data-quality="media">MEDIA</button><button data-quality="alta">ALTA</button></div></div>
          <div class="volume-row"><span>VOLUMEN</span><input data-volume type="range" min="0" max="1" step="0.01" value="${volume}" aria-label="Volumen"/><b data-volume-value>${Math.round(volume * 100)}%</b></div>
        </div>
        <div class="menu-footer"><span>DESPLIEGUE 01 <b>·</b> VALLE DE CENIZA</span><span>ACCESO LOCAL <b>v1.0</b></span></div>
        <aside class="menu-stats"><div><small>FUERZA ENEMIGA</small><strong>05 <i>BLINDADOS</i></strong></div><div><small>OBJETIVO</small><strong>NEUTRALIZAR</strong></div><div><small>TERRENO</small><strong>SECTOR RURAL <i>/</i> 24 KM²</strong></div></aside>
      </section>
      <section class="screen modal-screen" data-screen="controls"><div class="modal-card"><div class="eyebrow">MANUAL DE CAMPO</div><h2>CONTROLES</h2><div class="controls-grid">
        <div><kbd>W</kbd><span>AVANZAR</span></div><div><kbd>S</kbd><span>RETROCEDER</span></div><div><kbd>A</kbd> <kbd>D</kbd><span>GIRAR EL CASCO</span></div><div><kbd>MOUSE</kbd><span>APUNTAR TORRETA Y CAÑÓN</span></div><div><kbd>CLICK IZQ.</kbd><span>DISPARAR</span></div><div><kbd>CLICK DER.</kbd><span>APUNTAR CON ZOOM</span></div><div><kbd>R</kbd><span>RECARGAR</span></div><div><kbd>C</kbd><span>CAMBIAR CÁMARA</span></div><div><kbd>ESC</kbd><span>PAUSAR / REANUDAR</span></div></div>
        <p>Haz clic dentro del campo de batalla para capturar el ratón. Pulsa Escape para liberarlo.</p><button class="btn-primary" data-action="back-menu">VOLVER</button></div></section>
      <section class="screen modal-screen" data-screen="pause"><div class="modal-card pause-card"><div class="eyebrow"><span></span> SEÑAL EN ESPERA</div><h2>PAUSA</h2><p>El campo de batalla está detenido.</p><button class="btn-primary" data-action="resume">REANUDAR MISIÓN <b>↗</b></button><button class="btn-ghost" data-action="controls">VER CONTROLES</button><button class="btn-ghost" data-action="back-menu">MENÚ PRINCIPAL</button></div></section>
      <section class="screen modal-screen" data-screen="result"><div class="modal-card result-card"><div class="eyebrow" data-result-eyebrow>INFORME DE MISIÓN</div><h2 data-result-title>VICTORIA</h2><p data-result-copy>Sector asegurado.</p><div class="result-score"><span>OBJETIVOS ELIMINADOS</span><b data-result-kills>05 / 05</b></div><button class="btn-primary" data-action="replay">VOLVER A DESPLEGAR <b>↗</b></button><button class="btn-ghost" data-action="back-menu">MENÚ PRINCIPAL</button></div></section>
      <div class="hud" data-screen="hud">
        <div class="hud-top"><div class="mission-tag"><span class="live-dot"></span><div><small>OPERACIÓN EN CURSO</small><b>VALLE DE CENIZA <i>/</i> 07</b></div></div><div class="objective"><small>OBJETIVO DE SECTOR</small><b>ELIMINA LAS FUERZAS HOSTILES</b></div><div class="enemy-counter"><small>CONTACTOS</small><b data-enemies>05 <i>HOSTILES</i></b></div></div>
        <div class="hud-left"><div class="stat-card"><div class="card-label">BLINDADO <span>◆ M-41 “BISON”</span></div><div class="health-line"><b data-hp>100</b><small>PV</small><span data-armor-state>SISTEMAS NOMINALES</span></div><div class="health-track"><i data-health-bar></i></div><div class="condition-row"><span><i class="cond-dot"></i>MOTOR</span><b data-engine>LISTO</b></div></div>
          <div class="minimap-wrap"><canvas data-minimap width="256" height="256"></canvas><div class="map-label">MAPA TÁCTICO <span>N ↑</span></div></div>
        </div>
        <div class="hud-bottom"><div class="speed-card"><span data-gear>1</span><div><small>VELOCIDAD</small><b data-speed>0 <i>KM/H</i></b></div></div><div class="bearing"><b data-bearing>000°</b><span>RUMBO</span></div><div class="ammo-card"><span class="ammo-symbol">◎</span><div><small>CAÑÓN PRINCIPAL</small><b data-ammo>APFSDS <i>·</i> 05</b></div><div class="reload"><i data-reload-bar></i><b data-reload>LISTO PARA DISPARAR</b></div></div></div>
        <div class="reticle" data-reticle><i class="tick tick-t"></i><i class="tick tick-b"></i><i class="tick tick-l"></i><i class="tick tick-r"></i><b></b><span data-hit-marker></span></div>
        <div class="notifications" data-notifications></div><div class="lock-prompt" data-lock-prompt>HAZ CLIC EN EL CAMPO PARA CAPTURAR EL RATÓN <b>↗</b></div>
        <div class="camera-label" data-camera-label>CHASE CAM <span>●</span></div>
        <div class="event-log" data-event-log><span>COMMS <b>ESTABLE</b></span></div>
      </div>`;
    this.mini = root.querySelector('[data-minimap]') as HTMLCanvasElement;
    this.ctx = this.mini.getContext('2d')!;
    this.notifications = root.querySelector('[data-notifications]') as HTMLElement;
    this.hitMark = root.querySelector('[data-hit-marker]') as HTMLElement;
    this.lockPrompt = root.querySelector('[data-lock-prompt]') as HTMLElement;
    for (const name of ['menu', 'controls', 'pause', 'result', 'hud']) this.screens[name] = root.querySelector(`[data-screen="${name}"]`) as HTMLElement;
    const selectors: Record<string, string> = {
      hp: '[data-hp]', hpbar: '[data-health-bar]', armor: '[data-armor-state]', engine: '[data-engine]', speed: '[data-speed]', gear: '[data-gear]',
      bearing: '[data-bearing]', enemies: '[data-enemies]', reloadbar: '[data-reload-bar]', reload: '[data-reload]', ammo: '[data-ammo]', minimap: '[data-minimap]',
      resultTitle: '[data-result-title]', resultEyebrow: '[data-result-eyebrow]', resultCopy: '[data-result-copy]', resultKills: '[data-result-kills]',
      volume: '[data-volume]', volumeValue: '[data-volume-value]', cameraLabel: '[data-camera-label]',
    };
    for (const [key, selector] of Object.entries(selectors)) this.elements[key] = root.querySelector(selector) as HTMLElement;
    root.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-quality]'); if (!target) return;
      const action = target.dataset.action;
      if (action === 'start') this.callbacks.start();
      else if (action === 'resume') this.callbacks.resume();
      else if (action === 'replay') this.callbacks.replay();
      else if (action === 'controls') this.show('controls');
      else if (action === 'back-menu') this.callbacks.menu();
      else if (target.dataset.quality) { this.quality = target.dataset.quality as Quality; this.callbacks.quality(this.quality); this.updateQualityButtons(); }
    });
    this.elements.volume.addEventListener('input', () => {
      const value = Number((this.elements.volume as HTMLInputElement).value); this.callbacks.volume(value); this.elements.volumeValue.textContent = `${Math.round(value * 100)}%`;
    });
    this.updateQualityButtons();
  }

  private updateQualityButtons(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(button => button.classList.toggle('selected', button.dataset.quality === this.quality));
  }

  setQuality(quality: Quality): void { this.quality = quality; this.updateQualityButtons(); }
  show(name: 'menu' | 'controls' | 'pause' | 'result' | 'hud' | null): void {
    for (const [key, element] of Object.entries(this.screens)) element.classList.toggle('active', key === name || (key === 'hud' && name === 'hud'));
    // The HUD remains over result and pause screens, dimmed beneath the panel.
    if (name === 'pause' || name === 'result') this.screens.hud?.classList.add('visible');
    else this.screens.hud?.classList.toggle('visible', name === 'hud');
  }

  setResult(victory: boolean, kills: number, total: number): void {
    this.elements.resultTitle.textContent = victory ? 'VICTORIA' : 'DERROTA';
    this.elements.resultTitle.classList.toggle('defeat', !victory);
    this.elements.resultEyebrow.textContent = victory ? 'SECTOR ASEGURADO' : 'INFORME DE MISIÓN';
    this.elements.resultCopy.textContent = victory ? 'La línea del horizonte vuelve a ser nuestra.' : 'El blindado ha quedado fuera de combate.';
    this.elements.resultKills.textContent = `${String(kills).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  }

  showMessage(text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral'): void {
    this.notifications.textContent = text; this.notifications.className = `notifications show ${tone}`; this.noticeTimer = 2.7;
  }
  hit(type: 'hit' | 'bounce' | 'destroy' | 'miss'): void {
    this.hitMark.className = type; this.hitTimer = type === 'destroy' ? 0.72 : 0.36;
  }
  setLocked(locked: boolean): void { this.lockPrompt.classList.toggle('show', !locked); }

  update(delta: number, player: Vehicle, enemies: Vehicle[], cameraMode: number): void {
    this.noticeTimer = Math.max(0, this.noticeTimer - delta); if (this.noticeTimer === 0) this.notifications.className = 'notifications';
    this.hitTimer = Math.max(0, this.hitTimer - delta); if (this.hitTimer === 0) this.hitMark.className = '';
    this.elements.hp.textContent = `${Math.ceil(player.hp)}`;
    (this.elements.hpbar as HTMLElement).style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
    this.elements.armor.textContent = player.hp > 66 ? 'SISTEMAS NOMINALES' : player.hp > 30 ? 'BLINDAJE DAÑADO' : 'ESTADO CRÍTICO';
    this.elements.armor.classList.toggle('critical', player.hp <= 30);
    this.elements.engine.textContent = player.alive ? 'LISTO' : 'DETENIDO';
    const speed = Math.round(player.velocity.length() * 3.6);
    this.elements.speed.innerHTML = `${speed} <i>KM/H</i>`; this.elements.gear.textContent = `${Math.max(1, Math.min(4, Math.ceil(speed / 10)))}`;
    this.elements.bearing.textContent = `${String(Math.round(((player.heading * 180 / Math.PI + 360) % 360))).padStart(3, '0')}°`;
    const remaining = enemies.filter(enemy => enemy.alive).length;
    this.elements.enemies.innerHTML = `${String(remaining).padStart(2, '0')} <i>HOSTILES</i>`;
    const reload = Math.max(0, player.reload); const fraction = 1 - Math.min(1, reload / 4.2);
    (this.elements.reloadbar as HTMLElement).style.width = `${fraction * 100}%`;
    this.elements.reload.textContent = reload > 0.04 ? `RECARGANDO ${reload.toFixed(1)}s` : 'LISTO PARA DISPARAR';
    this.elements.reload.classList.toggle('loading', reload > 0.04);
    this.elements.ammo.innerHTML = `APFSDS <i>·</i> ${String(player.ammo).padStart(2, '0')}`;
    this.elements.cameraLabel.innerHTML = `${cameraMode === 0 ? 'CHASE CAM' : 'COMMAND CAM'} <span>●</span>`;
    this.drawMap(player, enemies);
  }

  private drawMap(player: Vehicle, enemies: Vehicle[]): void {
    const ctx = this.ctx, size = this.mini.width, center = size / 2;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(center, center, center - 5, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#313b36'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(210,197,164,.12)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const p = i * size / 4; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke(); }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#716a58'; ctx.lineWidth = 7;
    const mapLine = (points: [number, number][]) => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
    mapLine([[-20, 0], [57, 18], [121, 42], [210, 58]]); mapLine([[54, 254], [103, 164], [125, 95], [154, 5]]); mapLine([[-8, 180], [69, 145], [108, 121], [174, 76], [255, 48]]);
    const toMap = (x: number, z: number) => [center + x / 320 * size, center + z / 320 * size] as const;
    ctx.fillStyle = 'rgba(181,169,142,.42)';
    for (const [x, z, w, h] of [[-38, -54, 13, 9], [44, 49, 16, 11], [-103, 16, 12, 10], [98, -18, 14, 12], [6, 88, 11, 13], [-18, 7, 13, 10]]) {
      const [mx, my] = toMap(x, z); ctx.fillRect(mx - w / 2, my - h / 2, w, h);
    }
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const [x, y] = toMap(enemy.position.x, enemy.position.z);
      ctx.fillStyle = '#ee7357'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f6c1a5'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    const [px, py] = toMap(player.position.x, player.position.z); ctx.save(); ctx.translate(px, py); ctx.rotate(player.heading);
    ctx.fillStyle = '#e3dfbd'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 5); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore(); ctx.strokeStyle = 'rgba(213,207,181,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(center, center, center - 5, 0, Math.PI * 2); ctx.stroke();
  }
}
