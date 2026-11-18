// Presentation/storage only; never changes calculator inputs or build history.
export async function initOffline() {
  const status = document.querySelector('#offline-status');
  const button = document.querySelector('#offline-check');
  if (!document.querySelector('meta[name="rogue-lab-offline"]')) return;
  status.closest('.offline-panel').hidden = false;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'Offline use is unavailable here.';
    return;
  }
  let registration, checking = false, checkFailed = false;
  function render() {
    const ready = Boolean(registration?.active);
    const connection = navigator.onLine ? '' : 'You are offline. ';
    if (registration?.waiting) status.textContent = connection + 'Update ready. Save or export unfinished plans, then close all Rogue Lab tabs and reopen to apply the update.';
    else if (checkFailed) status.textContent = connection + (ready ? 'Offline copy ready. ' : '') + 'The update check failed. Try again when connected.';
    else if (checking) status.textContent = connection + 'Checking for updates…';
    else status.textContent = connection + (ready ? 'Offline copy ready.' : 'Preparing offline copy…');
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') checkFailed = true;
      render();
    });
  }
  try {
    status.textContent = 'Preparing offline copy…';
    registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { updateViaCache: 'none' });
    watch(registration.installing);
    registration.addEventListener('updatefound', () => { watch(registration.installing); render(); });
    navigator.serviceWorker.addEventListener('controllerchange', render);
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    button.hidden = false;
    button.addEventListener('click', async () => {
      checking = true; checkFailed = false; button.disabled = true; render();
      try { await registration.update(); } catch { checkFailed = true; }
      finally { checking = false; button.disabled = false; render(); }
    });
    render();
  } catch {
    status.textContent = 'Offline copy could not be prepared. Reopen while connected to try again.';
  }
}
