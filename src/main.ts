import './style.css';
import { Game } from './game';

const game = new Game();
window.addEventListener('pagehide', () => game.dispose(), { once: true });
