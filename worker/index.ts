// Service Worker custom code for Push Notifications and Badging

const sw = self as any;



sw.addEventListener('push', (event: any) => {
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
        sw.registration.showNotification(title, options).then(() => {
          // Update the App Badge Count from the webhook payload (which includes old pending cases)
          if (navigator && 'setAppBadge' in navigator && data.badgeCount !== undefined) {
            return (navigator as any).setAppBadge(data.badgeCount).catch((err: any) => console.error("Badge error:", err));
          }
        })
      );
    } catch (err) {
      console.error('Failed to parse push data:', err);
    }
  }
});

sw.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  
  // Open the target URL
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
    })
  );
});

// Clear badge count if the app is opened or focused
sw.addEventListener('message', (event: any) => {
  if (event.data === 'clearAppBadge') {
    if (navigator && 'clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
  }
});
