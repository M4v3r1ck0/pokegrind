<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mobileMenuOpen = ref(false)

// Restaurer la session après un F5 : si le token est en localStorage mais
// que le profil joueur n'est pas encore chargé, on appelle /auth/me.
onMounted(async () => {
  if (auth.accessToken && !auth.player) {
    try {
      await auth.fetchMe()
    } catch {
      // Token expiré et refresh cookie absent → déconnexion propre
      auth.clearSession()
      await router.push('/auth/login')
    }
  }
})

interface NavItem {
  label: string
  icon: string
  to: string
  badge?: string | number
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

const secondaryItems: NavItem[] = [
  { label: 'Profil',       icon: '👤',  to: '/jeu/profil' },
  { label: 'Paramètres',   icon: '⚙️',  to: '/jeu/parametres' },
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
    <!-- Header -->
    <header class="game-header">
      <div class="header-inner">
        <!-- Logo -->
        <NuxtLink to="/jeu" class="header-logo">
          <span class="logo-icon">⚡</span>
          <span class="logo-text font-display">PokeGrind</span>
        </NuxtLink>

        <!-- Center nav (desktop) -->
        <nav class="header-nav" aria-label="Navigation principale">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="[`accent-${item.accent}`, { active: isActive(item.to) }]"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <!-- Right zone -->
        <div class="header-right">
          <!-- Gem counter -->
          <UiGemCounter v-if="auth.player" :amount="auth.player.gems" :animate="true" size="sm" />

          <!-- Gold -->
          <div v-if="auth.player" class="gold-counter">
            <span>💰</span>
            <span class="gold-amount">{{ Number(auth.player.gold).toLocaleString('fr') }}</span>
          </div>

          <!-- Profile -->
          <NuxtLink v-if="auth.player" to="/jeu/profil" class="player-avatar" :title="auth.player.username">
            {{ auth.player.username.charAt(0).toUpperCase() }}
          </NuxtLink>

          <!-- Mobile toggle -->
          <button class="mobile-toggle" :aria-expanded="mobileMenuOpen" @click="mobileMenuOpen = !mobileMenuOpen">
            <span class="sr-only">Menu</span>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect v-if="!mobileMenuOpen" x="2" y="5" width="18" height="2.5" rx="1.25" fill="currentColor"/>
              <rect v-if="!mobileMenuOpen" x="2" y="10" width="18" height="2.5" rx="1.25" fill="currentColor"/>
              <rect v-if="!mobileMenuOpen" x="2" y="15" width="18" height="2.5" rx="1.25" fill="currentColor"/>
              <line v-if="mobileMenuOpen" x1="4" y1="4" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <line v-if="mobileMenuOpen" x1="18" y1="4" x2="4" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu drawer -->
      <Transition name="drawer">
        <nav v-if="mobileMenuOpen" class="mobile-nav" aria-label="Navigation mobile">
          <div class="mobile-nav-grid">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="mobile-nav-link"
              :class="{ active: isActive(item.to) }"
            >
              <span class="mobile-nav-icon">{{ item.icon }}</span>
              <span class="mobile-nav-label">{{ item.label }}</span>
            </NuxtLink>
          </div>
          <div class="mobile-nav-footer">
            <NuxtLink v-for="item in secondaryItems" :key="item.to" :to="item.to" class="mobile-secondary-link">
              {{ item.icon }} {{ item.label }}
            </NuxtLink>
            <button class="mobile-logout" @click="logout">🚪 Déconnexion</button>
          </div>
        </nav>
      </Transition>
    </header>

    <!-- Page content -->
    <main class="game-main">
      <slot />
    </main>

    <!-- Toast notifications -->
    <UiToast />
  </div>
</template>

<style scoped>
.game-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: radial-gradient(ellipse at 50% 0%, rgba(156,106,222,0.08) 0%, transparent 60%), var(--color-bg-primary);
}

/* ─── Header ─────────────────────────────────────────────────────── */
.game-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: rgba(26,28,46,0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  height: 56px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

/* Logo */
.header-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.logo-icon {
  font-size: 1.4rem;
  filter: drop-shadow(0 0 8px rgba(255,215,0,0.8));
}

.logo-text {
  font-size: 1.4rem;
  letter-spacing: 0.06em;
  background: linear-gradient(135deg, #ffd700, #ffb300);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

/* Desktop nav */
.header-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 var(--space-2);
}
.header-nav::-webkit-scrollbar { display: none; }

.nav-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted);
  white-space: nowrap;
  transition: var(--transition-fast);
  flex-shrink: 0;
}
.nav-link:hover { color: var(--color-text-primary); background: rgba(255,255,255,0.06); }
.nav-link.active { color: var(--color-text-primary); background: rgba(156,106,222,0.15); }

.nav-icon  { font-size: 0.9rem; line-height: 1; }
.nav-label { line-height: 1; }

/* Accent active states */
.nav-link.active.accent-red    { background: rgba(230,57,70,0.15);   color: #ff6b7a; }
.nav-link.active.accent-green  { background: rgba(86,201,109,0.15);  color: #56c96d; }
.nav-link.active.accent-purple { background: rgba(156,106,222,0.2);  color: #b894f5; }
.nav-link.active.accent-blue   { background: rgba(79,195,247,0.15);  color: #4fc3f7; }
.nav-link.active.accent-yellow { background: rgba(255,215,0,0.12);   color: #ffd700; }
.nav-link.active.accent-gold   { background: rgba(255,215,0,0.15);   color: #ffd700; }

/* Right zone */
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.gold-counter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent-yellow);
}
.gold-amount { font-variant-numeric: tabular-nums; }

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a0e8f, #9c6ade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
  color: #fff;
  text-decoration: none;
  flex-shrink: 0;
  transition: var(--transition-fast);
}
.player-avatar:hover { transform: scale(1.1); box-shadow: var(--shadow-glow-purple); }

.mobile-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 4px;
}

/* ─── Mobile menu ─────────────────────────────────────────────────── */
.mobile-nav {
  border-top: 1px solid rgba(255,255,255,0.07);
  background: rgba(26,28,46,0.98);
  padding: var(--space-4);
}

.mobile-nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.mobile-nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  background: rgba(255,255,255,0.04);
  transition: var(--transition-fast);
}
.mobile-nav-link:hover, .mobile-nav-link.active {
  background: rgba(156,106,222,0.15);
  color: var(--color-text-primary);
}

.mobile-nav-icon { font-size: 1.3rem; line-height: 1; }

.mobile-nav-footer {
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

/* ─── Main ─────────────────────────────────────────────────────────── */
.game-main {
  flex: 1;
  padding: var(--space-6) var(--space-4);
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

/* Drawer transition */
.drawer-enter-active { transition: all 0.2s ease; }
.drawer-leave-active { transition: all 0.15s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translateY(-8px); }

/* ─── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .header-nav { display: none; }
  .mobile-toggle { display: flex; }
  .gold-counter { display: none; }
}

@media (max-width: 640px) {
  .game-main { padding: var(--space-4) var(--space-3); }
  .mobile-nav-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 375px) {
  .game-main { padding: var(--space-3) var(--space-2); }
  .mobile-nav-grid { grid-template-columns: repeat(2, 1fr); }
  .header-inner { padding: 0 var(--space-3); }
}

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}
</style>
