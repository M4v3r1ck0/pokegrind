// Service Worker PokeGrind — Notifications Push Web API

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'PokeGrind'
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/pokeball.png',
    badge: '/icons/badge-72.png',
    data: data.data ?? {},
    vibrate: [100, 50, 100],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Réutiliser un onglet existant si possible
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))
