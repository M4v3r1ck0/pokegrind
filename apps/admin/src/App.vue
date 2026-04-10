<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAdminAuthStore()

const is_public = computed(() => route.meta.public)

const nav_items = [
  { label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { label: 'Joueurs', icon: 'people', to: '/players' },
  { label: 'Audit Gems', icon: 'diamond', to: '/gems-audit' },
  { label: 'Logs admin', icon: 'list_alt', to: '/logs' },
]

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <VaApp>
    <!-- Page publique (login) : pas de layout -->
    <template v-if="is_public">
      <RouterView />
    </template>

    <!-- Layout admin avec sidebar -->
    <VaLayout v-else>
      <template #left>
        <VaSidebar minimized-width="52px">
          <VaSidebarItem to="/dashboard">
            <VaSidebarItemContent>
              <VaIcon name="dashboard" />
              <VaSidebarItemTitle>Dashboard</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>

          <VaSidebarItem to="/players">
            <VaSidebarItemContent>
              <VaIcon name="people" />
              <VaSidebarItemTitle>Joueurs</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>

          <VaSidebarItem to="/gems-audit">
            <VaSidebarItemContent>
              <VaIcon name="diamond" />
              <VaSidebarItemTitle>Audit Gems</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>

          <VaSidebarItem to="/logs">
            <VaSidebarItemContent>
              <VaIcon name="list_alt" />
              <VaSidebarItemTitle>Logs admin</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>

          <VaSidebarItem to="/raids">
            <VaSidebarItemContent>
              <VaIcon name="public" />
              <VaSidebarItemTitle>Raids Mondiaux</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>

          <div class="flex-1" />

          <VaSidebarItem @click="logout">
            <VaSidebarItemContent>
              <VaIcon name="logout" color="danger" />
              <VaSidebarItemTitle class="text-danger">Déconnexion</VaSidebarItemTitle>
            </VaSidebarItemContent>
          </VaSidebarItem>
        </VaSidebar>
      </template>

      <template #content>
        <VaNavbar class="mb-0">
          <template #left>
            <span class="font-bold text-lg">PokeGrind Admin</span>
          </template>
          <template #right>
            <span class="text-sm text-secondary">{{ auth.player?.username }}</span>
            <VaBadge
              v-if="auth.player"
              :text="auth.player.role"
              :color="auth.player.role === 'admin' ? 'danger' : 'warning'"
              class="ml-2"
            />
          </template>
        </VaNavbar>
        <RouterView />
      </template>
    </VaLayout>
  </VaApp>
</template>
