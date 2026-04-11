<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const auth = useAuthStore()

interface HubCard {
  to: string
  icon: string
  title: string
  desc: string
  accent: string
  glow: string
  hot?: boolean
}

const hubCards: HubCard[] = [
  {
    to:     '/jeu/combat',
    icon:   '⚔️',
    title:  'Combat Idle',
    desc:   'Farming automatique — montez les étages, battez les boss.',
    accent: 'red',
    glow:   'rgba(230,57,70,0.35)',
    hot:    true,
  },
  {
    to:     '/jeu/pension',
    icon:   '🥚',
    title:  'Pension',
    desc:   'Élevage, éclosion, Talents Cachés, Shinies.',
    accent: 'green',
    glow:   'rgba(86,201,109,0.3)',
  },
  {
    to:     '/jeu/gacha',
    icon:   '🎰',
    title:  'Gacha',
    desc:   'Obtenez de nouveaux Pokémon. Système pity équitable.',
    accent: 'purple',
    glow:   'rgba(156,106,222,0.35)',
  },
  {
    to:     '/jeu/items',
    icon:   '🎒',
    title:  'Inventaire',
    desc:   'Gérez vos objets équipables et vos ressources.',
    accent: 'blue',
    glow:   'rgba(79,195,247,0.3)',
  },
  {
    to:     '/jeu/pokedex',
    icon:   '📖',
    title:  'Pokédex',
    desc:   '1 025 espèces à compléter, formes régionales incluses.',
    accent: 'yellow',
    glow:   'rgba(255,215,0,0.25)',
  },
  {
    to:     '/jeu/battle-frontier',
    icon:   '🏆',
    title:  'Battle Frontier',
    desc:   'Modes compétitifs rotatifs avec classements hebdomadaires.',
    accent: 'yellow',
    glow:   'rgba(255,215,0,0.25)',
  },
  {
    to:     '/jeu/pvp',
    icon:   '🥊',
    title:  'PvP ELO',
    desc:   'Affrontez d\'autres joueurs, grimpez dans les rangs.',
    accent: 'red',
    glow:   'rgba(230,57,70,0.3)',
  },
  {
    to:     '/jeu/raids',
    icon:   '🌐',
    title:  'Raids Mondiaux',
    desc:   'Coopération multijoueur contre des boss légendaires.',
    accent: 'blue',
    glow:   'rgba(79,195,247,0.3)',
  },
  {
    to:     '/jeu/tour-infinie',
    icon:   '🗼',
    title:  'Tour Infinie',
    desc:   'Mode défi saisonnier avec leaderboard mondial.',
    accent: 'gold',
    glow:   'rgba(255,215,0,0.3)',
  },
  {
    to:     '/jeu/donjons',
    icon:   '🏚️',
    title:  'Donjons Ancestraux',
    desc:   'Roguelite procédural avec modificateurs aléatoires.',
    accent: 'purple',
    glow:   'rgba(156,106,222,0.3)',
  },
  {
    to:     '/jeu/prestige',
    icon:   '✦',
    title:  'Prestige',
    desc:   '50 niveaux — chaque reset amplifie vos gains de façon permanente.',
    accent: 'purple',
    glow:   'rgba(156,106,222,0.35)',
  },
  {
    to:     '/jeu/boutique',
    icon:   '💎',
    title:  'Boutique Gems',
    desc:   'Améliorations de confort. Jamais de pay-to-win.',
    accent: 'purple',
    glow:   'rgba(156,106,222,0.3)',
  },
]
</script>

<template>
  <div class="hub-page">

    <!-- Welcome banner -->
    <div class="welcome-banner">
      <div class="welcome-left">
        <h1 class="welcome-title font-display">
          Bienvenue, <span class="player-name">{{ auth.player?.username }}</span>
        </h1>
        <p class="welcome-sub">Étage actuel : <strong>{{ auth.player?.current_floor ?? 1 }}</strong></p>
      </div>
      <div class="welcome-right">
        <div class="resource-chip resource-gold">
          <span>💰</span>
          <span>{{ Number(auth.player?.gold ?? 0).toLocaleString('fr') }}</span>
        </div>
        <UiGemCounter v-if="auth.player" :amount="auth.player.gems" size="md" />
      </div>
    </div>

    <!-- Hub grid -->
    <div class="hub-grid">
      <NuxtLink
        v-for="card in hubCards"
        :key="card.to"
        :to="card.to"
        class="hub-card"
        :class="`accent-${card.accent}`"
        :style="{ '--glow': card.glow }"
      >
        <span v-if="card.hot" class="hub-hot">ACTIF</span>
        <span class="hub-icon">{{ card.icon }}</span>
        <h2 class="hub-title">{{ card.title }}</h2>
        <p class="hub-desc">{{ card.desc }}</p>
        <span class="hub-arrow">→</span>
      </NuxtLink>
    </div>

    <!-- Quick links -->
    <div class="quick-links">
      <NuxtLink to="/jeu/profil" class="ql-link">👤 Profil</NuxtLink>
      <NuxtLink to="/jeu/boutique-or" class="ql-link">🏪 Boutique Or</NuxtLink>
      <NuxtLink to="/jeu/gigantamax" class="ql-link">🌩️ Gigantamax</NuxtLink>
      <NuxtLink to="/jeu/parametres" class="ql-link">⚙️ Paramètres</NuxtLink>
    </div>

  </div>
</template>

<style scoped>
.hub-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Welcome banner ─────────────────────────────────────────────────── */
.welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 20px 24px;
  background-image: radial-gradient(ellipse at 80% 50%, rgba(156,106,222,0.08) 0%, transparent 60%);
}

.welcome-title {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 900;
  color: #f0f0f0;
}

.player-name {
  background: linear-gradient(135deg, #ffd700, #9c6ade);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-sub {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
}
.welcome-sub strong { color: #ffd700; }

.welcome-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.resource-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 1rem;
}
.resource-gold { color: #ffd700; }

/* ── Hub grid ───────────────────────────────────────────────────────── */
.hub-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.hub-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.hub-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 80% 20%, var(--glow, rgba(156,106,222,0.2)) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.hub-card:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.12);
  transform: translateY(-1px);
}

.hub-card:hover::before { opacity: 1; }

/* accent border-top flash on hover */
.hub-card.accent-red:hover     { border-top-color: #e63946; }
.hub-card.accent-green:hover   { border-top-color: #56c96d; }
.hub-card.accent-purple:hover  { border-top-color: #9c6ade; }
.hub-card.accent-blue:hover    { border-top-color: #4fc3f7; }
.hub-card.accent-yellow:hover,
.hub-card.accent-gold:hover    { border-top-color: #ffd700; }

.hub-hot {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  background: #e63946;
  color: #fff;
  padding: 2px 7px;
  border-radius: 999px;
  animation: pulse-gold 2s ease-in-out infinite;
}

.hub-icon {
  font-size: 1.8rem;
  line-height: 1;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
}

.hub-title {
  font-size: 14px;
  font-weight: 800;
  color: #f0f0f0;
  margin-top: 4px;
}

.hub-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  line-height: 1.5;
  flex: 1;
}

.hub-arrow {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.3);
  transition: all 0.15s;
  align-self: flex-end;
}
.hub-card:hover .hub-arrow {
  color: #f0f0f0;
  transform: translateX(4px);
}

/* ── Quick links ────────────────────────────────────────────────────── */
.quick-links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ql-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  transition: all 0.15s;
}
.ql-link:hover {
  background: rgba(255,255,255,0.09);
  color: #f0f0f0;
  border-color: rgba(255,255,255,0.18);
}

/* ── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  .hub-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .hub-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .hub-page { padding: 16px; }
  .hub-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .hub-card { padding: 12px; }
  .welcome-banner { flex-direction: column; align-items: flex-start; }
}
</style>
