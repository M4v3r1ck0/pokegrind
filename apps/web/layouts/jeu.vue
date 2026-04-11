<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mobileMenuOpen = ref(false)

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

interface NavItem {
  label: string
  icon: string
  to: string
  accent?: string
}

const navItems: NavItem[] = [
  { label: 'Combat',       icon: '⚔️',  to: '/jeu/combat',           accent: 'red' },
  { label: 'Équipe',       icon: '👥',  to: '/jeu/equipe',           accent: 'blue' },
  { label: 'Pension',      icon: '🥚',  to: '/jeu/pension',          accent: 'green' },
  { label: 'Gacha',        icon: '🎰',  to: '/jeu/gacha',            accent: 'purple' },
  { label: 'Inventaire',   icon: '🎒',  to: '/jeu/items',            accent: 'blue' },
  { label: 'Pokédex',      icon: '📖',  to: '/jeu/pokedex',          accent: 'yellow' },
  { label: 'BF',           icon: '🏆',  to: '/jeu/battle-frontier',  accent: 'yellow' },
  { label: 'PvP',          icon: '🥊',  to: '/jeu/pvp',              accent: 'red' },
  { label: 'Raids',        icon: '🌐',  to: '/jeu/raids',            accent: 'blue' },
  { label: 'Tour',         icon: '🗼',  to: '/jeu/tour-infinie',     accent: 'gold' },
  { label: 'Donjons',      icon: '🏚️', to: '/jeu/donjons',          accent: 'purple' },
  { label: 'Prestige',     icon: '✦',   to: '/jeu/prestige',         accent: 'purple' },
  { label: 'Boutique',     icon: '💎',  to: '/jeu/boutique',         accent: 'purple' },
]

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

async function logout() {
  await auth.logout()
  router.push('/')
}

watch(() => route.path, () => { mobileMenuOpen.value = false })
</script>

<template>
  <div class="game-layout">

    <!-- ── Sidebar (desktop) ───────────────────────────────────────── -->
    <aside class="sidebar">
      <!-- Logo -->
      <NuxtLink to="/jeu" class="sidebar-logo">
        <span class="sidebar-logo-icon">⚡</span>
        <span class="sidebar-logo-text font-display">PokeGrind</span>
      </NuxtLink>

      <!-- Main nav -->
      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar-item"
          :class="[`accent-${item.accent}`, { active: isActive(item.to) }]"
        >
          <span class="sidebar-active-bar" />
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span class="sidebar-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Footer: profile + resources -->
      <div class="sidebar-footer">
        <div class="sidebar-resources">
          <div v-if="auth.player" class="resource-row">
            <span>💰</span>
            <span class="resource-val resource-gold">{{ Number(auth.player.gold).toLocaleString('fr') }}</span>
          </div>
          <div v-if="auth.player" class="resource-row">
            <span>💎</span>
            <span class="resource-val resource-gems">{{ auth.player.gems.toLocaleString('fr') }}</span>
          </div>
        </div>
        <div class="sidebar-user">
          <NuxtLink v-if="auth.player" to="/jeu/profil" class="sidebar-avatar" :title="auth.player.username">
            {{ auth.player.username.charAt(0).toUpperCase() }}
          </NuxtLink>
          <div v-if="auth.player" class="sidebar-user-info">
            <span class="sidebar-username">{{ auth.player.username }}</span>
          </div>
          <button class="sidebar-logout" title="Déconnexion" @click="logout">🚪</button>
        </div>
      </div>
    </aside>

    <!-- ── Mobile header ────────────────────────────────────────────── -->
    <header class="mobile-header">
      <NuxtLink to="/jeu" class="mobile-logo">
        <span>⚡</span>
        <span class="font-display mobile-logo-text">PokeGrind</span>
      </NuxtLink>
      <div class="mobile-header-right">
        <UiGemCounter v-if="auth.player" :amount="auth.player.gems" :animate="true" size="sm" />
        <button class="mobile-toggle" :aria-expanded="mobileMenuOpen" @click="mobileMenuOpen = !mobileMenuOpen">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect v-if="!mobileMenuOpen" x="2" y="5" width="18" height="2.5" rx="1.25" fill="currentColor"/>
            <rect v-if="!mobileMenuOpen" x="2" y="10" width="18" height="2.5" rx="1.25" fill="currentColor"/>
            <rect v-if="!mobileMenuOpen" x="2" y="15" width="18" height="2.5" rx="1.25" fill="currentColor"/>
            <line v-if="mobileMenuOpen" x1="4" y1="4" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <line v-if="mobileMenuOpen" x1="18" y1="4" x2="4" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Mobile drawer -->
    <Transition name="drawer">
      <nav v-if="mobileMenuOpen" class="mobile-drawer">
        <div class="mobile-drawer-grid">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="mobile-drawer-item"
            :class="{ active: isActive(item.to) }"
          >
            <span class="mobile-drawer-icon">{{ item.icon }}</span>
            <span class="mobile-drawer-label">{{ item.label }}</span>
          </NuxtLink>
        </div>
        <div class="mobile-drawer-footer">
          <NuxtLink to="/jeu/profil" class="mobile-secondary-link">👤 Profil</NuxtLink>
          <NuxtLink to="/jeu/parametres" class="mobile-secondary-link">⚙️ Paramètres</NuxtLink>
          <button class="mobile-logout" @click="logout">🚪 Déconnexion</button>
        </div>
      </nav>
    </Transition>

    <!-- ── Page content ──────────────────────────────────────────────── -->
    <main class="game-main">
      <slot />
    </main>

    <!-- Toast notifications -->
    <UiToast />

    <!-- ── Bottom navigation (mobile ≤860px) ──────────────────────── -->
    <nav class="bottom-nav" aria-label="Navigation rapide mobile">
      <NuxtLink to="/jeu/combat"  class="bottom-nav-item" :class="{ active: isActive('/jeu/combat') }">
        <span>⚔️</span><span>Combat</span>
      </NuxtLink>
      <NuxtLink to="/jeu/equipe"  class="bottom-nav-item" :class="{ active: isActive('/jeu/equipe') }">
        <span>👥</span><span>Équipe</span>
      </NuxtLink>
      <NuxtLink to="/jeu/pension" class="bottom-nav-item" :class="{ active: isActive('/jeu/pension') }">
        <span>🥚</span><span>Pension</span>
      </NuxtLink>
      <NuxtLink to="/jeu/gacha"   class="bottom-nav-item" :class="{ active: isActive('/jeu/gacha') }">
        <span>🎰</span><span>Gacha</span>
      </NuxtLink>
      <NuxtLink to="/jeu/pokedex" class="bottom-nav-item" :class="{ active: isActive('/jeu/pokedex') }">
        <span>📖</span><span>Pokédex</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
/* ─── Root layout ─────────────────────────────────────────────────── */
.game-layout {
  display: flex;
  min-height: 100dvh;
  background: radial-gradient(ellipse at 60% 0%, rgba(156,106,222,0.06) 0%, transparent 55%), var(--color-bg-primary);
}

/* ─── Sidebar ─────────────────────────────────────────────────────── */
.sidebar {
  width: 200px;
  min-width: 200px;
  background: #0f1117;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: var(--z-sticky);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px 16px;
  text-decoration: none;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.sidebar-logo-icon {
  font-size: 1.3rem;
  filter: drop-shadow(0 0 8px rgba(255,215,0,0.7));
}

.sidebar-logo-text {
  font-size: 1.25rem;
  letter-spacing: 0.06em;
  background: linear-gradient(135deg, #ffd700, #ffb300);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  flex: 1;
}

.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px 9px 20px;
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-muted);
  transition: var(--transition-fast);
  border-radius: 0;
  overflow: hidden;
}

.sidebar-item:hover {
  color: var(--color-text-primary);
  background: rgba(255,255,255,0.04);
}

.sidebar-item.active {
  color: var(--color-text-primary);
  background: rgba(156,106,222,0.15);
}

/* Accent active colors */
.sidebar-item.active.accent-red    { background: rgba(230,57,70,0.12);   color: #ff6b7a; }
.sidebar-item.active.accent-green  { background: rgba(86,201,109,0.12);  color: #56c96d; }
.sidebar-item.active.accent-purple { background: rgba(156,106,222,0.15); color: #b894f5; }
.sidebar-item.active.accent-blue   { background: rgba(79,195,247,0.12);  color: #4fc3f7; }
.sidebar-item.active.accent-yellow { background: rgba(255,215,0,0.10);   color: #ffd700; }
.sidebar-item.active.accent-gold   { background: rgba(255,215,0,0.12);   color: #ffd700; }

/* Barre violette à gauche sur l'item actif */
.sidebar-active-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  border-radius: 0 2px 2px 0;
  transition: var(--transition-fast);
}

.sidebar-item.active .sidebar-active-bar {
  background: var(--color-accent-purple);
}
.sidebar-item.active.accent-red    .sidebar-active-bar { background: var(--color-accent-red); }
.sidebar-item.active.accent-green  .sidebar-active-bar { background: var(--type-grass); }
.sidebar-item.active.accent-blue   .sidebar-active-bar { background: var(--color-accent-blue); }
.sidebar-item.active.accent-yellow .sidebar-active-bar,
.sidebar-item.active.accent-gold   .sidebar-active-bar { background: var(--color-accent-yellow); }

.sidebar-icon  { font-size: 1rem; line-height: 1; flex-shrink: 0; }
.sidebar-label { line-height: 1; white-space: nowrap; }

/* Footer */
.sidebar-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 12px 0 8px;
  flex-shrink: 0;
}

.sidebar-resources {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px 10px;
}

.resource-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
}

.resource-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.resource-gold  { color: var(--color-accent-yellow); }
.resource-gems  { color: var(--color-accent-blue); }

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 4px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.sidebar-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a0e8f, #9c6ade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.78rem;
  color: #fff;
  text-decoration: none;
  flex-shrink: 0;
  transition: var(--transition-fast);
}
.sidebar-avatar:hover { transform: scale(1.1); }

.sidebar-user-info {
  flex: 1;
  min-width: 0;
}

.sidebar-username {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.sidebar-logout {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  opacity: 0.5;
  transition: var(--transition-fast);
}
.sidebar-logout:hover { opacity: 1; background: rgba(230,57,70,0.15); }

/* ─── Mobile header (hidden on desktop) ──────────────────────────── */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: calc(var(--z-sticky) + 1);
  background: rgba(15,17,23,0.97);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  height: 52px;
  padding: 0 var(--space-4);
  align-items: center;
  justify-content: space-between;
}

.mobile-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}

.mobile-logo-text {
  font-size: 1.15rem;
  background: linear-gradient(135deg, #ffd700, #ffb300);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.mobile-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.mobile-toggle {
  background: rgba(156,106,222,0.15);
  border: 1px solid rgba(156,106,222,0.3);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 5px 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}
.mobile-toggle:hover { background: rgba(156,106,222,0.3); }

/* Mobile drawer */
.mobile-drawer {
  position: fixed;
  top: 52px;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  background: rgba(15,17,23,0.98);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: var(--space-4);
}

.mobile-drawer-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.mobile-drawer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255,255,255,0.03);
  transition: var(--transition-fast);
}
.mobile-drawer-item:hover,
.mobile-drawer-item.active {
  background: rgba(156,106,222,0.15);
  color: var(--color-text-primary);
}

.mobile-drawer-icon  { font-size: 1.2rem; line-height: 1; }
.mobile-drawer-label { line-height: 1; }

.mobile-drawer-footer {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-wrap: wrap;
}

.mobile-secondary-link {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
}
.mobile-secondary-link:hover { color: var(--color-text-primary); background: rgba(255,255,255,0.06); }

.mobile-logout {
  background: none;
  border: none;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
  font-family: var(--font-primary);
  margin-left: auto;
}
.mobile-logout:hover { color: var(--color-accent-red); background: rgba(230,57,70,0.1); }

/* ─── Main content ────────────────────────────────────────────────── */
.game-main {
  flex: 1;
  margin-left: 200px;
  padding: var(--space-6) var(--space-5);
  min-height: 100dvh;
  width: 0; /* flex child — let flex handle width */
  min-width: 0;
}

/* Drawer transition */
.drawer-enter-active { transition: all 0.2s ease; }
.drawer-leave-active { transition: all 0.15s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translateY(-8px); }

/* ─── Bottom nav (mobile only) ────────────────────────────────────── */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  background: rgba(15,17,23,0.97);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 6px 0 max(6px, env(safe-area-inset-bottom));
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.62rem;
  font-weight: 700;
  transition: var(--transition-fast);
}
.bottom-nav-item span:first-child { font-size: 1.2rem; line-height: 1; }
.bottom-nav-item.active { color: #b894f5; }
.bottom-nav-item:hover  { color: var(--color-text-primary); }

/* ─── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 860px) {
  .sidebar       { display: none; }
  .mobile-header { display: flex; }
  .game-main {
    margin-left: 0;
    padding: calc(52px + var(--space-4)) var(--space-3) calc(var(--space-6) + 60px);
  }
  .bottom-nav { display: flex; }
}

@media (max-width: 480px) {
  .mobile-drawer-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 375px) {
  .game-main { padding-left: var(--space-2); padding-right: var(--space-2); }
  .mobile-drawer-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
