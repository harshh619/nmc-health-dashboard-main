// Service Worker custom code for Push Notifications and Badging
declare const self: ServiceWorkerGlobalScope;

// To store current badge count locally in the SW
let unreadCount = 0;

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const title = data.title || 'New NMC Update';
      const options = {
        body: data.body || 'A new update is available.',
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/icon-192x192.png',
        data: {
          url: data.url || '/',
          patientId: data.patientId
        }
      };

      event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
          // Update the App Badge Count
          if ('setAppBadge' in navigator) {
            unreadCount++;
            return navigator.setAppBadge(unreadCount);
          }
        })
      );
    } catch (err) {
      console.error('Failed to parse push data:', err);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Clear the badge count when they click a notification
  if ('clearAppBadge' in navigator) {
    unreadCount = 0;
    navigator.clearAppBadge();
  }

  // Open the target URL
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Clear badge count if the app is opened or focused
self.addEventListener('message', (event) => {
  if (event.data === 'clearAppBadge') {
    if ('clearAppBadge' in navigator) {
      unreadCount = 0;
      navigator.clearAppBadge();
    }
  }
});
