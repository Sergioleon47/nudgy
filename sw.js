const CACHE_NAME = 'nudgy-v9';
const FILES_TO_CACHE = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to get the latest deployed version when online,
// only falling back to the cached copy when there's no connection. A pure
// cache-first strategy (the old behavior) would keep serving the very first
// version ever cached forever, since a byte-identical sw.js never re-triggers
// install/cache refresh even after new deploys.
self.addEventListener('fetch', (event) => {
  // The Cache API only accepts GET requests — Firebase's own network calls
  // (Firestore, FCM) pass through here too and are mostly POST, which used
  // to throw an unhandled rejection on every single one of them.
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      var copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// Fired by check-alarms.js (Netlify Function) via FCM while the browser is
// fully closed — the page isn't around to call showNotification itself, so
// the service worker builds the exact same notification shape it would.
// Data-only payload (never `notification`), so this is the only place that
// ever renders it — no double notification from FCM's own default handler.
// Action labels are hardcoded in Spanish (matching the app's ES defaults):
// the service worker has no access to the page's language preference.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Nudgy', {
      body: payload.body || '',
      tag: payload.tag || 'alarm-push',
      // Matches the urgency of the in-app alarm (which beeps on a loop and
      // vibrates) as closely as a background push notification can: a
      // noticeable vibration pattern, and stays on screen instead of
      // auto-dismissing after a few seconds, since this is a medication/
      // appointment reminder, not an FYI.
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      actions: [
        { action: 'snooze5', title: '+5 min' },
        { action: 'remind15', title: '+15 min' },
        { action: 'dismiss', title: 'Apagar del todo' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || '';
  const tag = event.notification.tag || '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: 'notif-action', action: action, tag: tag });
      }
      if (clientList.length) return clientList[0].focus();
      // No open window to postMessage (app was fully closed) — open one with
      // the action baked into the URL so index.html can apply it once loaded
      // (see applyNotifActionFromUrl in index.html).
      const url = './index.html?action=' + encodeURIComponent(action) + '&tag=' + encodeURIComponent(tag);
      return self.clients.openWindow(url);
    })
  );
});
