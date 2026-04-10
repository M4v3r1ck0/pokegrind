<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTowerStore } from '~/stores/tower'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const tower = useTowerStore()
const auth = useAuthStore()

const starting = ref(false)
const error_msg = ref('')

onMounted(async () => {
  const player_id = auth.player?.id
  if (!player_id) {
    await router.push('/jeu/tour-infinie')
    return
  }
  tower.initTowerSocket(player_id)
  await tower.fetchState()
  if (!tower.session_active) {
    await startCombat()
  }
})

onUnmounted(() => {
  const player_id = auth.player?.id
  if (player_id) tower.disconnectSocket(player_id)
})

async function startCombat() {
  starting.value = true
  error_msg.value = ''
  try {
    await tower.startSession()
  } catch (err: any) {
    error_msg.value = err.response?.data?.message ?? 'Impossible de démarrer le combat.'
  } finally {
    starting.value = false
  }
}

async function retreat() {
  await tower.abandonSession()
  await router.push('/jeu/tour-infinie')
}

const snapshot = computed(() => tower.snapshot)
const is_boss = computed(() => snapshot.value?.is_boss ?? false)
const boss_mechanic = computed(() => snapshot.value?.boss_mechanic_type)
const boss_timer_ms = computed(() => snapshot.value?.boss_timer_remaining_ms)
const combat_log = computed(() => tower.combat_log)

const boss_timer_sec = computed(() => {
  if (boss_timer_ms.value === null) return null
  return Math.max(0, Math.floor(boss_timer_ms.value / 1000))
})

function mechanic_label(type: string | null): string {
  const labels: Record<string, string> = {
    enrage: '🔴 Enragé',
    regen: '💚 Régénération',
    reflect: '🔵 Reflet',
    clone: '🟣 Clonage',
    berserk: '🟠 Berserk',
  }
  return type ? (labels[type] ?? type) : ''
}

function mechanic_color(type: string | null): string {
  const colors: Record<string, string> = {
    enrage: 'var(--color-accent-red)',
    regen: 'var(--type-grass)',
    reflect: 'var(--color-accent-blue)',
    clone: 'var(--color-accent-purple)',
    berserk: '#ff9a3c',
  }
  return type ? (colors[type] ?? 'var(--color-text-muted)') : 'var(--color-text-muted)'
}

function mapLogType(t: string) {
  if (t === 'ko' || t === 'defeat') return 'faint'
  if (t === 'victory' || t === 'new_floor' || t === 'boss_defeated') return 'boss'
  if (t === 'move') return 'move'
  if (t === 'status') return 'status'
  return 'move'
}

function mapEffectiveness(e?: number): 'super' | 'weak' | 'immune' | 'normal' | undefined {
  if (e === undefined || e === null) return undefined
  if (e === 0) return 'immune'
  if (e >= 2) return 'super'
  if (e <= 0.5) return 'weak'
  return 'normal'
}

watch(() => tower.session_active, (active) => {
  if (!active) {
    setTimeout(() => { router.push('/jeu/tour-infinie') }, 4000)
  }
})
</script>

<template>
  <div class="tower-combat-page">

    <!-- ── Top bar ─────────────────────────────────────────────── -->
    <div class="top-bar">
      <div class="top-bar-left">
        <span class="mode-badge">TOUR INFINIE</span>
        <span v-if="snapshot" class="floor-info">
          <span class="floor-lbl">Étage</span>
          <span class="floor-val font-display">{{ snapshot.floor }}</span>
        </span>
        <span v-if="is_boss" class="boss-pill">⚔️ BOSS</span>
      </div>
      <div class="top-bar-right">
        <div v-if="boss_timer_sec !== null" class="boss-timer" :class="{ 'timer-low': boss_timer_sec < 30 }">
          ⏱️ {{ boss_timer_sec }}s
        </div>
        <div v-if="boss_mechanic" class="mechanic-pill" :style="{ color: mechanic_color(boss_mechanic), borderColor: mechanic_color(boss_mechanic) }">
          {{ mechanic_label(boss_mechanic) }}
        </div>
        <button class="btn-retreat" @click="retreat">Abandonner</button>
      </div>
    </div>

    <!-- ── Starting / Error ───────────────────────────────────── -->
    <div v-if="starting" class="state-loading">
      <div class="spinner" /> Connexion au serveur…
    </div>
    <div v-else-if="error_msg" class="state-error">{{ error_msg }}</div>

    <!-- ── Combat arena ───────────────────────────────────────── -->
    <div v-else-if="snapshot" class="arena">

      <!-- Enemy side -->
      <div class="arena-side arena-enemy">
        <p class="side-label">Ennemi</p>
        <div v-if="snapshot.enemy" class="combatant-card enemy-card" :class="{ 'is-boss': is_boss }">
          <img
            v-if="snapshot.enemy.species?.sprite_url"
            :src="snapshot.enemy.species.sprite_url"
            :alt="snapshot.enemy.species?.name_fr"
            class="combatant-sprite enemy-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = snapshot.enemy.species.sprite_fallback_url"
          />
          <div class="combatant-info">
            <p class="combatant-name">{{ snapshot.enemy.species?.name_fr }}</p>
            <p class="combatant-level">Niv. {{ snapshot.enemy.level }}</p>
            <UiHpBar :current="snapshot.enemy.hp_current" :max="snapshot.enemy.hp_max" />
            <p class="hp-text">{{ snapshot.enemy.hp_current }} / {{ snapshot.enemy.hp_max }} PV</p>
          </div>
        </div>
      </div>

      <!-- Player side -->
      <div class="arena-side arena-player">
        <p class="side-label">Mon équipe</p>
        <div class="player-team">
          <div
            v-for="pk in snapshot.team"
            :key="pk.id"
            class="combatant-card"
            :class="{ 'fainted': pk.hp_current === 0 }"
          >
            <img
              :src="pk.species.sprite_url"
              :alt="pk.species.name_fr"
              class="combatant-sprite"
              loading="lazy"
              @error="($event.target as HTMLImageElement).src = pk.species.sprite_fallback_url"
            />
            <div class="combatant-info">
              <p class="combatant-name">{{ pk.nickname ?? pk.species.name_fr }}</p>
              <UiHpBar :current="pk.hp_current" :max="pk.hp_max" />
              <p class="hp-text">{{ pk.hp_current }} / {{ pk.hp_max }}</p>
            </div>
            <UiStatusIcon v-if="pk.status" :status="pk.status" class="status-overlay" />
          </div>
        </div>
      </div>

      <!-- Log panel -->
      <div class="log-panel">
        <p class="log-title">Journal</p>
        <UiCombatLog
          :entries="combat_log.map((e: any, i: number) => ({
            id: e.id ?? i,
            turn: e.turn ?? i,
            message: e.message,
            type: mapLogType(e.type),
            effectiveness: mapEffectiveness(e.effectiveness),
            critical: e.critical,
            miss: e.miss,
          }))"
        />
      </div>

    </div>

    <!-- ── Session over ───────────────────────────────────────── -->
    <div v-else-if="!tower.session_active && !starting" class="state-over">
      <p class="over-title font-display">Session terminée</p>
      <p class="over-sub">Retour à l'accueil Tour Infinie…</p>
    </div>

  </div>
</template>

<style scoped>
.tower-combat-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Top bar */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
}
.top-bar-left, .top-bar-right { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }

.mode-badge {
  font-family: var(--font-display);
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: var(--color-accent-purple);
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.3);
  border-radius: var(--radius-full);
  padding: 3px 12px;
}
.floor-info { display: flex; align-items: baseline; gap: 4px; }
.floor-lbl  { font-size: 0.78rem; color: var(--color-text-muted); }
.floor-val  { font-size: 1.6rem; color: var(--color-text-primary); }
.boss-pill {
  font-size: 0.8rem;
  font-weight: 700;
  background: rgba(230,57,70,0.15);
  border: 1px solid rgba(230,57,70,0.4);
  border-radius: var(--radius-full);
  color: var(--color-accent-red);
  padding: 3px 10px;
  animation: pulse-red 1.5s ease infinite;
}
.boss-timer {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--color-text-secondary);
}
.timer-low { color: var(--color-accent-red); animation: pulse-red 0.8s ease infinite; }
.mechanic-pill {
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 3px 10px;
}
.btn-retreat {
  background: rgba(230,57,70,0.12);
  border: 1px solid rgba(230,57,70,0.3);
  border-radius: var(--radius-md);
  color: var(--color-accent-red);
  font-family: var(--font-primary);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-retreat:hover { background: rgba(230,57,70,0.25); }

/* Arena */
.arena {
  display: grid;
  grid-template-columns: 1fr 1fr 280px;
  grid-template-rows: auto;
  gap: var(--space-4);
}
.arena-side {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
}
.side-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.combatant-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
  transition: var(--transition-base);
}
.combatant-card.is-boss {
  border-color: rgba(230,57,70,0.35);
  box-shadow: 0 0 16px rgba(230,57,70,0.12);
}
.fainted { opacity: 0.35; }

.combatant-sprite { width: 64px; height: 64px; image-rendering: pixelated; flex-shrink: 0; }
.enemy-sprite { width: 96px; height: 96px; }
.combatant-info { flex: 1; min-width: 0; }
.combatant-name { font-size: 0.88rem; font-weight: 700; color: var(--color-text-primary); }
.combatant-level { font-size: 0.72rem; color: var(--color-text-muted); margin-bottom: var(--space-1); }
.hp-text { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 3px; }

.status-overlay { position: absolute; top: 8px; right: 8px; }

.player-team { display: flex; flex-direction: column; gap: var(--space-2); }

.log-panel {
  grid-row: 1 / 3;
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 500px;
}
.log-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
}

/* States */
.state-loading, .state-error, .state-over {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-10);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
}
.state-loading { flex-direction: row; }
.state-error   { color: var(--color-accent-red); font-weight: 700; }
.over-title    { font-size: 2rem; color: var(--color-text-primary); }
.over-sub      { font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; }
.spinner { width: 20px; height: 20px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Animations */
@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}

/* Responsive */
@media (max-width: 900px) {
  .arena { grid-template-columns: 1fr; }
  .log-panel { grid-row: auto; min-height: 300px; }
}
</style>
