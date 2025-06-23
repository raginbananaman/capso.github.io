// service-worker.js

// Define a name for the cache
const CACHE_NAME = 'capso-dashboard-v1';

// List all the files that make up the app shell, which we want to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://placehold.co/192x192/ffec4d/000000?text=CAPSo',
  'https://placehold.co/512x512/ffec4d/000000?text=CAPSo'
];

// 1. Installation: Caching the App Shell
// This event fires when the service worker is first installed.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  // waitUntil ensures that the service worker will not install until the code inside has successfully completed.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// 2. Activation: Cleaning up old caches
// This event fires after installation. It's a good place to manage old caches.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        // Tell the active service worker to take control of the page immediately.
        return self.clients.claim();
    })
  );
});


// 3. Fetch: Serving cached content (Offline Strategy)
// This event fires for every network request.
// We use a "Cache first, falling back to network" strategy.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the request is in the cache, return the cached response
        if (response) {
          return response;
        }
        // If it's not in the cache, fetch it from the network
        return fetch(event.request);
      })
  );
});

// 4. Push: Handling Incoming Push Notifications
// This event fires when the device receives a push message from the server.
self.addEventListener('push', event => {
    console.log('Service Worker: Push Received.');
    // Default data if payload is empty
    let data = {
        title: 'New Notification',
        body: 'Something new happened!',
        icon: 'https://placehold.co/192x192/ffec4d/000000?text=CAPSo'
    };

    // Try to parse the data sent with the push
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('Push event data is not valid JSON', e);
        }
    }
    
    const title = data.title;
    const options = {
        body: data.body,
        icon: data.icon,
        badge: 'https://placehold.co/192x192/ffec4d/000000?text=CAPSo', // Small icon for notification bar
        vibrate: [200, 100, 200]
    };

    // Show the notification
    event.waitUntil(self.registration.showNotification(title, options));
});
