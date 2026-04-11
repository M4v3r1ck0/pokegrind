/**
 * usePushNotifications — Gestion des notifications push Web API.
 * Enregistre le Service Worker, demande la permission, subscribe/unsubscribe.
 */

import { ref } from 'vue'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const isSupported = ref(
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  )
  const isSubscribed = ref(false)
  const permission = ref<NotificationPermission>('default')

  async function checkSubscriptionStatus(): Promise<void> {
    if (!isSupported.value) return
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) { isSubscribed.value = false; return }
      const sub = await reg.pushManager.getSubscription()
      isSubscribed.value = !!sub
      permission.value = Notification.permission
    } catch {
      isSubscribed.value = false
    }
  }

  async function register(): Promise<void> {
    if (!isSupported.value) return

    // Enregistrer le service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Demander la permission
    permission.value = await Notification.requestPermission()
    if (permission.value !== 'granted') return

    // Récupérer la clé publique VAPID
    const { $api } = useNuxtApp() as any
    const { data: keyData } = await $api.get('/player/push/vapid-key')
    if (!keyData?.public_key) return

    // Créer la subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.public_key),
    })

    // Envoyer au serveur
    await $api.post('/player/push/subscribe', subscription.toJSON())
    isSubscribed.value = true
  }

  async function unregister(): Promise<void> {
    if (!isSupported.value) return
    try {
      const { $api } = useNuxtApp() as any
      await $api.post('/player/push/unsubscribe')

      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      }
      isSubscribed.value = false
    } catch (err) {
      console.error('[usePushNotifications] unregister error:', err)
    }
  }

  return { isSupported, isSubscribed, permission, register, unregister, checkSubscriptionStatus }
}
