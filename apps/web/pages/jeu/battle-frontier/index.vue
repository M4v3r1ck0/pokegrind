<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useBattleFrontierStore } from '@/stores/battleFrontier'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const store = useBattleFrontierStore()
const auth = useAuthStore()
const router = useRouter()

const joining = ref<'tower' | 'factory' | 'arena' | null>(null)
const error = ref('')

const MODE_CONFIG: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  tower:   { icon: '🗼', label: 'Battle Tower',   desc: 'Aller le plus loin possible — streak sans fin',          color: 'var(--color-accent-blue)' },
  factory: { icon: '🏭', label: 'Battle Factory', desc: 'Roguelite : remplace un Pokémon vaincu par le pool',     color: 'var(--color-accent-purple)' },
  arena:   { icon: '⚔️', label: 'Battle Arena',   desc: '3 Pokémon × 3 actions max — jugement par HP restants', color: 'var(--color-accent-red)' },
}

const CHALLENGE_LABELS: Record<string, string> = {
  standard:       'Standard',
  monotype:       'Monotype',
  no_legendary:   '🚫 Sans Légendaires',
  legendary_only: '👑 Légendaires Seulement',
  starters_only:  '🌿 Starters Uniquement',
  little_cup:     '🐣 Little Cup',
  speed_demon:    '⚡ Speed Demon',
  no_items:       '🚫 Sans Objets',
}

const challenge_label = computed(() =>
  store.current_rotation
    ? CHALLENGE_LABELS[store.current_rotation.challenge_type] ?? store.current_rotation.challenge_type
    : ''
)

const time_left = computed(() => {
  if (!store.current_rotation?.end_at) return ''
  const ms = new Date(store.current_rotation.end_at).getTime() - Date.now()
  if (ms <= 0) return 'Terminé'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  return `${h}h ${m}m`
})

onMounted(async () => {
  await store.fetchCurrentRotation()
  await store.fetchMySession()
})

onUnmounted(() => {
  if (store.timer_interval) clearInterval(store.timer_interval)
})

async function join(mode: 'tower' | 'factory' | 'arena') {
  joining.value = mode
  error.value = ''
  try {
    await store.joinRotation(mode)
  } catch (e: any) {
    const resp = e.response?.data
    error.value = resp?.errors?.join('\n') ?? resp?.message ?? "Erreur lors de l'inscription"
  } finally {
    joining.value = null
  }
}
</script>

<template>
  <div class="bf-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="bf-header">
      <div>
        <h1 class="font-display bf-title">Battle Frontier</h1>
        <p class="bf-sub">Rotation hebdomadaire — challenges spéciaux avec classement mondial.</p>
      </div>
      <NuxtLink to="/jeu/battle-frontier/classement" class="btn-classement">
        🏆 Classement
      </NuxtLink>
    </div>

    <!-- ── Current rotation ───────────────────────────────────── -->
    <div v-if="store.current_rotation" class="rotation-card">
      <div class="rotation-top">
        <div>
          <p class="rotation-label">Rotation actuelle</p>
          <p class="challenge-name font-display">{{ challenge_label }}</p>
        </div>
        <div class="rotation-timer">
          <span class="timer-icon">⏱️</span>
          <span class="timer-val">{{ time_left }}</span>
        </div>
      </div>
      <p v-if="store.current_rotation.rules_description" class="rotation-desc">
        {{ store.current_rotation.rules_description }}
      </p>
    </div>

    <!-- ── Error ──────────────────────────────────────────────── -->
    <div v-if="error" class="error-msg">{{ error }}</div>

    <!-- ── My session ─────────────────────────────────────────── -->
    <div v-if="store.my_session" class="session-card">
      <p class="session-label">Ma session en cours</p>
      <div class="session-content">
        <div class="session-info">
          <p class="session-mode font-display">{{ MODE_CONFIG[store.my_session.mode]?.label ?? store.my_session.mode }}</p>
          <p class="session-streak">Streak : <strong>{{ store.my_session.streak }}</strong></p>
        </div>
        <button class="btn-continue" @click="router.push('/jeu/battle-frontier/combat')">
          Continuer →
        </button>
      </div>
    </div>

    <!-- ── Mode cards ─────────────────────────────────────────── -->
    <div class="modes-grid">
      <div
        v-for="(config, mode) in MODE_CONFIG"
        :key="mode"
        class="mode-card"
        :style="{ '--mode-color': config.color }"
      >
        <div class="mode-icon">{{ config.icon }}</div>
        <div class="mode-info">
          <p class="mode-label font-display">{{ config.label }}</p>
          <p class="mode-desc">{{ config.desc }}</p>
        </div>
        <button
          class="btn-join"
          :disabled="!!joining || !!store.my_session"
          @click="join(mode as any)"
        >
          <span v-if="joining === mode" class="btn-spinner" />
          <span v-else>{{ store.my_session ? 'En cours' : 'Rejoindre' }}</span>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.bf-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.bf-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.bf-title  { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.bf-sub    { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }
.btn-classement {
  font-size: 0.82rem;
  font-weight: 700;
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: var(--radius-md);
  color: var(--color-accent-yellow);
  font-family: var(--font-primary);
  padding: 8px 16px;
  text-decoration: none;
  transition: var(--transition-fast);
}
.btn-classement:hover { background: rgba(255,215,0,0.2); }

/* Rotation card */
.rotation-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,215,0,0.25);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.rotation-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.rotation-label  { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.challenge-name  { font-size: 1.5rem; color: var(--color-text-primary); letter-spacing: 0.04em; margin-top: 2px; }
.rotation-timer  { display: flex; align-items: center; gap: var(--space-2); }
.timer-icon      { font-size: 1rem; }
.timer-val       { font-family: var(--font-display); font-size: 1.3rem; color: var(--color-accent-yellow); }
.rotation-desc   { font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.6; }

/* Session card */
.session-card {
  background: rgba(156,106,222,0.1);
  border: 1px solid rgba(156,106,222,0.35);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
}
.session-label { font-size: 0.72rem; color: var(--color-accent-purple); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; margin-bottom: var(--space-3); }
.session-content { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.session-mode   { font-size: 1.3rem; color: var(--color-text-primary); letter-spacing: 0.04em; }
.session-streak { font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 4px; }
.session-streak strong { color: var(--color-accent-yellow); }
.btn-continue {
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-continue:hover { filter: brightness(1.1); }

/* Mode cards */
.modes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
.mode-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: var(--transition-base);
}
.mode-card:hover {
  border-color: var(--mode-color, rgba(255,255,255,0.2));
  box-shadow: 0 0 16px color-mix(in srgb, var(--mode-color, transparent), transparent 75%);
}
.mode-icon  { font-size: 2.5rem; }
.mode-info  { flex: 1; }
.mode-label { font-size: 1.1rem; color: var(--color-text-primary); letter-spacing: 0.04em; }
.mode-desc  { font-size: 0.78rem; color: var(--color-text-secondary); margin-top: var(--space-1); line-height: 1.5; }

.btn-join {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: linear-gradient(135deg, rgba(156,106,222,0.3), rgba(156,106,222,0.15));
  border: 1px solid rgba(156,106,222,0.5);
  border-radius: var(--radius-md);
  color: #b894f5;
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.88rem;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-join:hover:not(:disabled) { background: rgba(156,106,222,0.35); }
.btn-join:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(184,148,245,0.3); border-top-color: #b894f5; border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

.error-msg { background: rgba(230,57,70,0.12); border: 1px solid rgba(230,57,70,0.3); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); color: var(--color-accent-red); font-size: 0.85rem; white-space: pre-line; }

@media (max-width: 700px) {
  .modes-grid { grid-template-columns: 1fr; }
  .bf-header  { flex-direction: column; align-items: flex-start; }
}
</style>
