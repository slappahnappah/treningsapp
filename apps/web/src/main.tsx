import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { audioContext, unlockAudio } from './audio';
import { startSync } from './sync';
import { startUpdateCheck } from './update';
import './styles.css';

// Safari på iPhone slipper ikke gjennom lyd før brukeren har trykket på noe, og
// lyden kan sovne igjen når appen har ligget i bakgrunnen. Berøring teller først
// som et trykk når fingeren slippes, så vi lytter på slipp, klikk og tast.
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  document.addEventListener(type, unlockAudio, { passive: true, capture: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void audioContext()?.resume().catch(() => undefined);
});

// Be nettleseren om ikke å slette dataene når lagringsplassen blir trang.
void navigator.storage?.persist?.();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').then(async () => {
      const reg = await navigator.serviceWorker.ready;
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ type: 'cache', urls });
    });
  });
}

startSync();
startUpdateCheck();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
