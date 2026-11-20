import './style.css';
import { Game } from './game/Game';

function bootstrap(): void {
  const container = document.getElementById('app')!;
  const game = new Game(container);

  window.addEventListener('beforeunload', () => game.dispose());

  const loading = document.getElementById('loading');
  if (loading) {
    window.setTimeout(() => loading.classList.add('hidden'), 400);
    window.setTimeout(() => loading.remove(), 1100);
  }

  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
