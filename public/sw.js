self.addEventListener('push', function (event) {
    if (event.data) {
        let data;
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'New Notification', body: event.data.text() };
        }

        const options = {
            body: data.body,
            icon: data.icon || '/vite.svg', // Fallback icon
            badge: data.icon || '/vite.svg',
            data: { url: data.url || '/' },
            requireInteraction: true // Keep it on screen until user dismisses or clicks
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                // If it's already open, just focus it
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not open, open a new tab/window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
