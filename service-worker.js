// service-worker.js

// Define a name for the cache
const CACHE_NAME = 'capso-dashboard-v2'; // <-- Changed cache name to trigger update

// List all the files that make up the app shell, which we want to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/manifest.json',
  '/Images/logo-192.png', // <-- Added your new logo
  '/Images/logo-512.png', // <-- Added your new logo
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
];

// 1. Installation: Caching the App Shell
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// 2. Activation: Cleaning up old caches
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
        return self.clients.claim();
    })
  );
});


// 3. Fetch: Serving cached content (Offline Strategy)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// 4. Push: Handling Incoming Push Notifications
self.addEventListener('push', event => {
    console.log('Service Worker: Push Received.');
    let data = {
        title: 'New Notification',
        body: 'Something new happened!',
        icon: '/Images/logo-192.png' // <-- Use new logo in notifications
    };

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
        badge: '/Images/logo-192.png',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});
