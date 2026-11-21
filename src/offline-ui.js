// Presentation/storage only; never changes calculator inputs or build history.
export async function initOffline() {
  const status = document.querySelector('#offline-status');
  const button = document.querySelector('#offline-check');
  const notice = document.querySelector('#update-notice');
  const updateButtons = [...document.querySelectorAll('[data-update-now]')];
  const noticeMessage = document.querySelector('#update-notice-message');
  if (!document.querySelector('meta[name="rogue-lab-offline"]')) return;
  status.closest('.offline-panel').hidden = false;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'Offline use is unavailable here.';
    return;
  }
  let registration, checking = false, checkFailed = false;
  function render() {
    const ready = Boolean(registration?.active);
    const updateReady = Boolean(registration?.waiting);
    if (notice) notice.hidden = !updateReady;
    updateButtons.forEach(updateButton => { updateButton.hidden = !updateReady; });
    const connection = navigator.onLine ? '' : 'You are offline. ';
    if (registration?.waiting) status.textContent = connection + 'Update ready. Use Update now, or close all Rogue Lab tabs and reopen to apply it.';
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
    updateButtons.forEach(updateButton => updateButton.addEventListener('click', async () => {
      if (!registration.waiting) return;
      const proceed = window.confirm('Apply the new version now? Any unfinished run plan that has not been saved or exported may be lost.');
      if (!proceed) return;
      updateButtons.forEach(button => { button.disabled = true; button.textContent = 'Updating…'; });
      noticeMessage.textContent = 'Checking for other open Rogue Lab tabs…';
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        updateButtons.forEach(button => { button.disabled = false; button.textContent = 'Update now'; });
        noticeMessage.textContent = 'The update did not start. Close all Rogue Lab tabs and reopen the site to apply it.';
      }, 10000);
      let activationApproved = false, reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!activationApproved || reloading) return;
        reloading = true;
        location.reload();
      });
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        channel.port1.close();
        if (!event.data?.ok) {
          updateButtons.forEach(button => { button.disabled = false; button.textContent = 'Update now'; });
          noticeMessage.textContent = `There are ${event.data?.openTabs || 'multiple'} Rogue Lab tabs open. Close all of them and reopen the site to apply the update safely.`;
          return;
        }
        activationApproved = true;
        noticeMessage.textContent = 'Applying update…';
        window.setTimeout(() => {
          if (!reloading && !registration.waiting) {
            reloading = true;
            location.reload();
          }
        }, 1000);
      };
      registration.waiting.postMessage({ type: 'UPDATE_NOW' }, [channel.port2]);
    }));
    render();
  } catch {
    status.textContent = 'Offline copy could not be prepared. Reopen while connected to try again.';
  }
}
