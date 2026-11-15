import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { audioContext, unlockAudio } from './audio';
import { startSync } from './sync';
import { startUpdateCheck } from './update';
import './styles.css';

// Safari på iPhone slipper ikke gjennom lyd før brukeren har trykket på noe.
let unlocked = false;
document.addEventListener(
  'pointerdown',
  () => {
    if (!unlocked || audioContext()?.state !== 'running') {
      unlockAudio();
      unlocked = true;
    }
  },
  { passive: true },
);

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
