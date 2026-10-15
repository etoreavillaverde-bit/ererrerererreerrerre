import * as THREE from 'three';
import type { Quality } from './types';

const qualityTable: Record<Quality, { pixelRatio: number; shadows: number; shadowSize: number; far: number }> = {
  baja: { pixelRatio: 0.72, shadows: 0, shadowSize: 0, far: 170 },
  media: { pixelRatio: 0.92, shadows: 1, shadowSize: 1024, far: 230 },
  alta: { pixelRatio: 1.35, shadows: 1, shadowSize: 2048, far: 300 },
};

export class Settings {
  quality: Quality = (['baja', 'media', 'alta'].includes(localStorage.getItem('steel-quality') ?? '') ? localStorage.getItem('steel-quality') as Quality : 'media');
  volume = THREE.MathUtils.clamp(Number(localStorage.getItem('steel-volume') ?? '0.55'), 0, 1);

  apply(renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const preset = qualityTable[this.quality] ?? qualityTable.media;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    renderer.shadowMap.enabled = preset.shadows > 0;
    if (preset.shadowSize) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    }
    const fog = scene.fog as THREE.Fog;
    fog.far = preset.far;
    camera.far = preset.far + 100;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    localStorage.setItem('steel-quality', this.quality);
  }

  setQuality(value: Quality): void {
    this.quality = value;
    localStorage.setItem('steel-quality', value);
  }
}
