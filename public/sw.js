self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title || "SWU Med", {
      body: data.body || "It's your turn!",
      icon: data.icon || "/logo.png",
      badge: data.badge || "/logo.png",
      data: {
        url: data.url || "/",
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }

      return self.clients.openWindow(url)
    })
  )
})