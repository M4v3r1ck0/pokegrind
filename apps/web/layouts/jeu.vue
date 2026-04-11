<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  if (auth.accessToken && !auth.player) {
    try {
      await auth.fetchMe()
    } catch (err: any) {
      if (err?.message === 'SESSION_EXPIRED' || !auth.accessToken) {
        auth.clearSession()
        await router.push('/auth/login')
      }
    }
  }
})

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

async function logout() {
  await auth.logout()
  router.push('/')
}

const showBack = computed(() => route.path !== '/jeu' && route.path !== '/jeu/combat')

const PAGE_TITLES: Record<string, string> = {
  '/jeu': 'Accueil',
  '/jeu/combat': 'Combat Idle',
  '/jeu/equipe': 'Mon Équipe',
  '/jeu/gacha': 'Invocations',
  '/jeu/pension': 'Pension Pokémon',
  '/jeu/pokedex': 'Pokédex',
  '/jeu/items': 'Inventaire',
  '/jeu/battle-frontier': 'Battle Frontier',
  '/jeu/pvp': 'PvP ELO',
  '/jeu/raids': 'Raids',
  '/jeu/donjons': 'Donjons',
  '/jeu/prestige': 'Prestige',
}

const pageTitle = computed(() => PAGE_TITLES[route.path] ?? 'PokeGrind')
</script>

<template>
  <div class="pg-root">
    <aside class="pg-sidebar">
      <!-- Logo -->
      <div class="pg-logo">
        <span class="pg-logo-icon">⚡</span>
        <span class="pg-logo-text">POKEGRIND</span>
      </div>

      <!-- Nav items -->
      <nav class="pg-nav">
        <NuxtLink class="pg-nav-item" to="/jeu/combat"          :class="{ active: isActive('/jeu/combat') }">          <span class="nav-icon">⚔️</span> Combat</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/equipe"          :class="{ active: isActive('/jeu/equipe') }">          <span class="nav-icon">👥</span> Équipe</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/gacha"           :class="{ active: isActive('/jeu/gacha') }">           <span class="nav-icon">🎰</span> Gacha</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/pension"         :class="{ active: isActive('/jeu/pension') }">         <span class="nav-icon">🥚</span> Pension</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/pokedex"         :class="{ active: isActive('/jeu/pokedex') }">         <span class="nav-icon">📖</span> Pokédex</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/items"           :class="{ active: isActive('/jeu/items') }">           <span class="nav-icon">🎒</span> Items</NuxtLink>
        <div class="nav-separator" />
        <NuxtLink class="pg-nav-item" to="/jeu/battle-frontier" :class="{ active: isActive('/jeu/battle-frontier') }"><span class="nav-icon">🏆</span> Battle F.</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/pvp"             :class="{ active: isActive('/jeu/pvp') }">             <span class="nav-icon">🥊</span> PvP</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/raids"           :class="{ active: isActive('/jeu/raids') }">           <span class="nav-icon">🌐</span> Raids</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/donjons"         :class="{ active: isActive('/jeu/donjons') }">         <span class="nav-icon">🏚️</span> Donjons</NuxtLink>
        <NuxtLink class="pg-nav-item" to="/jeu/prestige"        :class="{ active: isActive('/jeu/prestige') }">        <span class="nav-icon">✦</span> Prestige</NuxtLink>
      </nav>

      <!-- Footer ressources -->
      <div class="pg-sidebar-footer">
        <div class="pg-resource res-gold">
          <span>💰</span><span>Or</span>
          <span class="res-val">{{ auth.player ? Number(auth.player.gold).toLocaleString('fr') : '—' }}</span>
        </div>
        <div class="pg-resource res-gem">
          <span>💎</span><span>Gems</span>
          <span class="res-val">{{ auth.player ? Number(auth.player.gems).toLocaleString('fr') : '—' }}</span>
        </div>
        <button class="nav-logout" @click="logout">⎋ Déconnexion</button>
      </div>
    </aside>

    <div class="pg-main">
      <!-- Topbar -->
      <header class="pg-topbar">
        <button v-if="showBack" class="btn-back" @click="router.back()">←</button>
        <span class="topbar-title">{{ pageTitle }}</span>
        <div class="topbar-resources">
          <span class="res-or">💰 {{ auth.player?.gold != null ? Number(auth.player.gold).toLocaleString('fr') : '—' }}</span>
          <span class="res-gem">💎 {{ auth.player?.gems != null ? Number(auth.player.gems).toLocaleString('fr') : '—' }}</span>
        </div>
        <div class="topbar-right">
          <span v-if="auth.player" class="player-chip">{{ auth.player.username }}</span>
        </div>
      </header>

      <!-- Contenu -->
      <main class="pg-content">
        <slot />
      </main>
    </div>
  </div>

  <!-- Toast notifications -->
  <UiToast />
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.pg-root {
  display: flex;
  min-height: 100dvh;
  background: #0d0f1a;
  color: #e8eaf0;
  font-family: 'Nunito', sans-serif;
}

/* ── Sidebar ─────────────────────────────────── */
.pg-sidebar {
  width: 200px;
  min-width: 200px;
  background: #10121f;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
}

.pg-logo {
  padding: 18px 16px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.pg-logo-icon { font-size: 18px; }
.pg-logo-text {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #ffd700, #9c6ade);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.pg-nav {
  flex: 1;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.pg-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
  border-radius: 8px;
  margin: 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.4);
  transition: all 0.15s;
  text-decoration: none;
  position: relative;
}
.pg-nav-item:hover {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.75);
}
.pg-nav-item.active {
  background: rgba(156,106,222,0.15);
  color: #c4a0f5;
}
.pg-nav-item.active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 20%;
  bottom: 20%;
  width: 3px;
  background: #9c6ade;
  border-radius: 0 3px 3px 0;
}
.nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
.nav-separator { height: 1px; background: rgba(255,255,255,0.05); margin: 6px 16px; }

.pg-sidebar-footer {
  padding: 10px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}
.pg-resource {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}
.res-val { margin-left: auto; font-variant-numeric: tabular-nums; }
.res-gold { color: #ffd700; }
.res-gem  { color: #a78bfa; }
.nav-logout {
  margin-top: 2px;
  background: none;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  color: rgba(255,255,255,0.25);
  font-size: 11px;
  font-weight: 700;
  padding: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  width: 100%;
}
.nav-logout:hover { background: rgba(230,57,70,0.1); color: #f87171; border-color: rgba(230,57,70,0.2); }

/* ── Main ─────────────────────────────────────── */
.pg-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.pg-topbar {
  height: 48px;
  background: rgba(8,10,22,0.7);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}
.btn-back {
  width: 30px; height: 30px;
  border-radius: 7px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.btn-back:hover { background: rgba(255,255,255,0.12); color: #fff; }
.topbar-title { font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.85); }
.topbar-resources {
  display: none;
  gap: 12px;
  font-size: 12px;
  font-weight: 700;
}
.res-or  { color: #ffd700; }
.res-gem { color: #a78bfa; }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.player-chip {
  font-size: 12px; font-weight: 700;
  padding: 3px 10px;
  background: rgba(156,106,222,0.1);
  border: 1px solid rgba(156,106,222,0.2);
  border-radius: 99px;
  color: #c4a0f5;
}

.pg-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.pg-content > .page-wrap {
  max-width: 1300px;
  margin: 0 auto;
  padding: 24px 28px;
  width: 100%;
}
@media (max-width: 1100px) {
  .pg-content > .page-wrap { padding: 16px 20px; }
}

/* ── Mobile (≤ 768px) ── */
@media (max-width: 768px) {
  .pg-sidebar { display: none; }
  .pg-root { flex-direction: column; }
  .topbar-resources { display: flex; }
}
</style>
