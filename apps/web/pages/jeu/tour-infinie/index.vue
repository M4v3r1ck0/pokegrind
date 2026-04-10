<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTowerStore } from '~/stores/tower'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const tower = useTowerStore()
const auth = useAuthStore()

onMounted(async () => {
  await tower.fetchStatus()
  await tower.fetchBosses()
  await tower.fetchMilestones()
})

const status = computed(() => tower.status)
const next_boss = computed(() => status.value?.next_boss)
const next_milestone = computed(() => status.value?.next_milestone)

function mechanic_label(type: string): string {
  const labels: Record<string, string> = {
    enrage: 'Enragé',
    regen: 'Régénération',
    reflect: 'Reflet',
    clone: 'Clonage',
    berserk: 'Berserk',
  }
  return labels[type] ?? type
}

function mechanic_color(type: string): string {
  const colors: Record<string, string> = {
    enrage: 'var(--color-accent-red)',
    regen: 'var(--type-grass)',
    reflect: 'var(--color-accent-blue)',
    clone: 'var(--color-accent-purple)',
    berserk: '#ff9a3c',
  }
  return colors[type] ?? 'var(--color-text-muted)'
}

async function enterTower() {
  await router.push('/jeu/tour-infinie/combat')
}
</script>

<template>
  <div class="tower-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="tower-header">
      <div>
        <h1 class="font-display tower-title">Tour Infinie</h1>
        <p class="tower-sub">Progressez sans fin — chaque étage est plus difficile que le précédent.</p>
      </div>
      <div v-if="status" class="floor-badge">
        <span class="floor-label">Étage atteint</span>
        <span class="floor-num">{{ status.highest_floor }}</span>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="!status" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <template v-else>

      <!-- ── Progress card ─────────────────────────────────────── -->
      <div class="progress-card">
        <div class="progress-card-top">
          <div class="progress-info">
            <p class="progress-label">Progression globale</p>
            <p class="progress-sub">{{ status.total_kills.toLocaleString('fr-FR') }} ennemis vaincus</p>
          </div>
          <button class="btn-enter" @click="enterTower">
            ⚔️ Entrer dans la Tour
          </button>
        </div>
        <UiProgressBar
          v-if="next_milestone"
          :current="status.highest_floor"
          :max="next_milestone.floor"
          color="var(--color-accent-purple)"
          :height="10"
        />
        <p v-if="next_milestone" class="milestone-hint">
          Prochain milestone : Étage {{ next_milestone.floor }} — {{ next_milestone.reward_description }}
        </p>
      </div>

      <!-- ── Next boss ──────────────────────────────────────────── -->
      <div v-if="next_boss" class="boss-card">
        <div class="boss-card-inner">
          <div class="boss-info">
            <p class="boss-label">Prochain boss</p>
            <p class="boss-name font-display">{{ next_boss.name_fr }}</p>
            <p class="boss-floor">Étage {{ next_boss.floor }}</p>
            <div v-if="next_boss.mechanic_type" class="mechanic-chip" :style="{ borderColor: mechanic_color(next_boss.mechanic_type), color: mechanic_color(next_boss.mechanic_type) }">
              {{ mechanic_label(next_boss.mechanic_type) }}
            </div>
          </div>
          <div class="boss-sprite-wrap">
            <img
              v-if="next_boss.species?.sprite_url"
              :src="next_boss.species.sprite_url"
              :alt="next_boss.name_fr"
              class="boss-sprite"
              loading="lazy"
              @error="($event.target as HTMLImageElement).src = next_boss.species.sprite_fallback_url"
            />
            <span v-else class="boss-sprite-placeholder">👾</span>
          </div>
        </div>
      </div>

      <!-- ── Milestones ─────────────────────────────────────────── -->
      <section v-if="tower.milestones?.length" class="milestones-section">
        <h2 class="font-display section-title">Milestones</h2>
        <div class="milestones-grid">
          <div
            v-for="ms in tower.milestones"
            :key="ms.floor"
            class="milestone-card"
            :class="{ 'milestone-done': status.highest_floor >= ms.floor }"
          >
            <span class="ms-status">{{ status.highest_floor >= ms.floor ? '✅' : '🔒' }}</span>
            <span class="ms-floor font-display">{{ ms.floor }}</span>
            <span class="ms-reward">{{ ms.reward_description }}</span>
          </div>
        </div>
      </section>

    </template>

  </div>
</template>

<style scoped>
.tower-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.tower-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.tower-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: var(--color-text-primary);
  letter-spacing: 0.05em;
}
.tower-sub { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

.floor-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.35);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  flex-shrink: 0;
}
.floor-label { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.floor-num   { font-family: var(--font-display); font-size: 2.2rem; color: var(--color-accent-purple); letter-spacing: 0.04em; line-height: 1; }

/* Progress card */
.progress-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.progress-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.progress-label { font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
.progress-sub   { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px; }

.btn-enter {
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  transition: var(--transition-base);
  box-shadow: var(--shadow-glow-purple);
  white-space: nowrap;
}
.btn-enter:hover { filter: brightness(1.1); transform: translateY(-1px); }

.milestone-hint { font-size: 0.78rem; color: var(--color-text-muted); font-style: italic; }

/* Boss card */
.boss-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(230,57,70,0.3);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  box-shadow: 0 0 20px rgba(230,57,70,0.08);
}
.boss-card-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.boss-label { font-size: 0.72rem; color: var(--color-accent-red); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
.boss-name  { font-size: 1.6rem; color: var(--color-text-primary); letter-spacing: 0.04em; margin-top: 2px; }
.boss-floor { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; }

.mechanic-chip {
  display: inline-block;
  margin-top: var(--space-2);
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 3px 12px;
}

.boss-sprite-wrap { flex-shrink: 0; }
.boss-sprite {
  width: 120px;
  height: 120px;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 12px rgba(230,57,70,0.4));
}
.boss-sprite-placeholder { font-size: 4rem; }

/* Milestones */
.section-title { font-size: 1.3rem; color: var(--color-text-primary); letter-spacing: 0.04em; margin-bottom: var(--space-4); }
.milestones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
}
.milestone-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
  transition: var(--transition-fast);
}
.milestone-done {
  border-color: rgba(86,201,109,0.3);
  background: rgba(86,201,109,0.05);
}
.ms-status { font-size: 1rem; }
.ms-floor  { font-size: 1.4rem; color: var(--color-accent-purple); }
.ms-reward { font-size: 0.72rem; color: var(--color-text-secondary); line-height: 1.4; }

/* States */
.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Responsive */
@media (max-width: 600px) {
  .tower-header { flex-direction: column; align-items: flex-start; }
  .progress-card-top { flex-direction: column; align-items: flex-start; }
  .boss-sprite { width: 80px; height: 80px; }
}
</style>
