const CACHE_VERSION = 'v1.74';
const CACHE_NAME = `hexer-cache-${CACHE_VERSION}`;

// Static resources to be cached using cache-first strategy
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/bg-light.jpg',
  '/bg-dark.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[Service Worker] Removing old cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Prohibited: NEVER cache responses from under *.supabase.co or any API route
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-First for main page navigation (navigate) to prevent stale UI
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Keep a backup of the document in the cache
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // If offline, return the cached navigation shell
          return caches.match('/');
        })
    );
    return;
  }

  // Cache-First for static assets (fonts, icons, manifest, static paths)
  const isStaticAsset = 
    STATIC_ASSETS.includes(url.pathname) || 
    url.hostname.includes('fonts.googleapis.com') || 
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clonedResponse);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: Network-First strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});

function checkIfShownAndRegister(messageId) {
  return new Promise((resolve) => {
    if (!messageId) {
      resolve(false); // If no id, don't block
      return;
    }
    const request = indexedDB.open('hexer-offline');
    request.onerror = () => resolve(false);
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('shown')) {
        db.close();
        resolve(false);
        return;
      }
      try {
        const tx = db.transaction('shown', 'readwrite');
        const store = tx.objectStore('shown');
        const getReq = store.get(messageId);
        getReq.onsuccess = () => {
          if (getReq.result !== undefined) {
            db.close();
            resolve(true); // Already shown!
          } else {
            // Not shown, let's put it
            const putReq = store.put({ messageId: messageId, timestamp: Date.now() });
            putReq.onsuccess = () => {
              db.close();
              resolve(false);
            };
            putReq.onerror = () => {
              db.close();
              resolve(false);
            };
          }
        };
        getReq.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch (err) {
        db.close();
        resolve(false);
      }
    };
  });
}

// Web Push Events
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'هکسر', body: event.data.text() };
    }
  }
  const title = data.title || 'یادآوری جدید';
  const tag = data.tag || 'general-notification';
  const messageId = data.messageId || (data.data && data.data.messageId);

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    tag: tag,
    data: data.data || {}
  };

  event.waitUntil(
    checkIfShownAndRegister(messageId).then((isShown) => {
      if (isShown) {
        console.log(`[Service Worker] Notification already shown: ${messageId}`);
        return;
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
