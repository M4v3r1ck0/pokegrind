<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useOfflineStore } from '~/stores/offline'
import { useSystemStore } from '~/stores/system'
import { useHeartbeat } from '~/composables/useHeartbeat'

const route = useRoute()
const auth = useAuthStore()
const offlineStore = useOfflineStore()
const systemStore = useSystemStore()
const { start: startHeartbeat, stop: stopHeartbeat } = useHeartbeat()

// Démarrer le heartbeat et vérifier le rapport offline
// dès que le joueur est authentifié et sur une page /jeu
watch(
  () => auth.isAuthenticated,
  (authed) => {
    if (authed) {
      startHeartbeat()
      systemStore.initSystemSocket()
      offlineStore.checkPendingReport().catch(() => {})
    } else {
      stopHeartbeat()
      systemStore.disconnect()
    }
  },
  { immediate: true }
)

// Revérifier à chaque navigation vers /jeu/*
watch(
  () => route.path,
  (path) => {
    if (auth.isAuthenticated && path.startsWith('/jeu')) {
      offlineStore.checkPendingReport().catch(() => {})
    }
  }
)

onUnmounted(() => {
  stopHeartbeat()
  systemStore.disconnect()
})

function broadcastBg(type: string): string {
  const MAP: Record<string, string> = {
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
    success: 'bg-green-600',
    danger: 'bg-red-600',
  }
  return MAP[type] ?? 'bg-gray-700'
}
</script>

<template>
  <!-- Broadcasts système (admins) -->
  <div class="fixed top-0 left-0 right-0 z-50 flex flex-col gap-1 pointer-events-none">
    <div
      v-for="msg in systemStore.broadcasts"
      :key="msg.id"
      class="pointer-events-auto flex items-center justify-between px-4 py-2 text-white text-sm shadow-lg"
      :class="broadcastBg(msg.type)"
    >
      <div>
        <span class="font-bold mr-2">{{ msg.title_fr }}</span>
        <span>{{ msg.body_fr }}</span>
      </div>
      <button
        class="ml-4 text-white opacity-80 hover:opacity-100"
        @click="systemStore.dismissBroadcast(msg.id)"
      >
        ✕
      </button>
    </div>
  </div>

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OfflineReportModal />
</template>
