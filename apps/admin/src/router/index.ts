import { createRouter, createWebHistory } from 'vue-router'
import { useAdminAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/pages/dashboard/DashboardPage.vue'),
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('@/pages/players/PlayersListPage.vue'),
    },
    {
      path: '/players/:id',
      name: 'player-detail',
      component: () => import('@/pages/players/PlayerDetailPage.vue'),
    },
    {
      path: '/gems-audit',
      name: 'gems-audit',
      component: () => import('@/pages/gems-audit/GemsAuditPage.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/pages/logs/AuditLogPage.vue'),
    },
    {
      path: '/anticheat',
      name: 'anticheat',
      component: () => import('@/pages/anticheat/AlertsPage.vue'),
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/pages/events/EventsPage.vue'),
    },
    {
      path: '/economy',
      name: 'economy',
      component: () => import('@/pages/economy/EconomyPage.vue'),
    },
    {
      path: '/pvp',
      name: 'pvp-admin',
      component: () => import('@/pages/pvp/PvpAdminPage.vue'),
    },
    {
      path: '/bf',
      name: 'bf-admin',
      component: () => import('@/pages/bf/BfAdminPage.vue'),
    },
    {
      path: '/raids',
      name: 'raids-admin',
      component: () => import('@/pages/raids/RaidsAdminPage.vue'),
    },
    {
      path: '/dungeons',
      name: 'dungeons-admin',
      component: () => import('@/pages/dungeons/DonjonAdminPage.vue'),
    },
    {
      path: '/tower',
      name: 'tower-admin',
      component: () => import('@/pages/tower/TowerAdminPage.vue'),
    },
    {
      path: '/economy-v3',
      name: 'economy-v3',
      component: () => import('@/pages/economy/EconomyV3Page.vue'),
    },
    {
      path: '/system',
      name: 'system-health',
      component: () => import('@/pages/system/SystemHealthPage.vue'),
    },
    {
      path: '/config',
      name: 'game-config',
      component: () => import('@/pages/config/GameConfigPage.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAdminAuthStore()
  if (!to.meta.public && !auth.token) {
    return '/login'
  }
  if (to.path === '/login' && auth.token) {
    return '/dashboard'
  }
})

export default router
