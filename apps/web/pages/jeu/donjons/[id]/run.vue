<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDungeonStore } from '~/stores/dungeon'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const route = useRoute()
const router = useRouter()
const dungeon = useDungeonStore()
const auth = useAuthStore()

const loading = ref(false)
const error_msg = ref('')
const confirming_abandon = ref(false)

const dungeon_id = Number(route.params.id)

onMounted(async () => {
  const player_id = auth.player?.id
  if (!player_id) { await router.push('/jeu/donjons'); return }
  dungeon.initDungeonSocket(player_id)
  await dungeon.fetchCurrentRun()
  if (!dungeon.active_run || dungeon.active_run.dungeon_id !== dungeon_id) {
    loading.value = true
    error_msg.value = ''
    try {
      await dungeon.startRun(dungeon_id)
    } catch (err: any) {
      error_msg.value = err.response?.data?.message ?? 'Impossible de démarrer le run.'
    } finally {
      loading.value = false
    }
  }
})

onUnmounted(() => {
  dungeon.disconnectDungeonSocket()
})

const run = computed(() => dungeon.active_run)
const current_room = computed(() => run.value?.rooms.find((r) => r.room_number === run.value?.current_room))
const last_result = computed(() => dungeon.last_room_result as any)

async function enterRoom() {
  if (!run.value) return
  loading.value = true
  error_msg.value = ''
  try {
    await dungeon.resolveRoom(run.value.run_id, run.value.current_room)
  } catch (err: any) {
    error_msg.value = err.response?.data?.message ?? 'Erreur lors de la résolution de la salle.'
  } finally {
    loading.value = false
  }
}

async function abandon() {
  if (!run.value) return
  await dungeon.abandonRun(run.value.run_id)
  await router.push('/jeu/donjons')
}

function room_icon(type: string, completed: boolean, is_current: boolean): string {
  if (is_current) return '⚡'
  if (completed) return '✓'
  const icons: Record<string, string> = {
    combat: '⚔', elite: '🔥', rest: '🏕',
    treasure: '💎', shop: '🛒', trap: '⚠', boss: '👑',
  }
  return icons[type] ?? '?'
}

function room_label(type: string): string {
  const labels: Record<string, string> = {
    combat: 'Combat', elite: 'Élite', rest: 'Repos',
    treasure: 'Trésor', shop: 'Boutique', trap: 'Piège', boss: 'BOSS',
  }
  return labels[type] ?? type
}

function room_color(type: string): string {
  return {
    combat:   'var(--color-accent-red)',
    elite:    '#ff9a3c',
    boss:     'var(--color-accent-yellow)',
    treasure: 'var(--color-accent-yellow)',
    rest:     'var(--type-grass)',
    shop:     'var(--color-accent-blue)',
    trap:     'var(--color-accent-red)',
  }[type] ?? 'var(--color-text-muted)'
}

const run_finished = computed(() =>
  run.value?.status === 'completed' || run.value?.status === 'failed'
)
</script>

<template>
  <div class="run-page">

    <!-- ── Top bar ─────────────────────────────────────────────── -->
    <div class="run-topbar">
      <div class="topbar-left">
        <NuxtLink to="/jeu/donjons" class="back-link">← Donjons</NuxtLink>
        <span v-if="run" class="run-name font-display">{{ run.dungeon_name_fr }}</span>
      </div>
      <div class="topbar-right">
        <span v-if="run" class="run-status-chip" :class="`status-${run.status}`">
          {{ run.status === 'active' ? 'En cours' : run.status === 'completed' ? 'Complété ✅' : 'Échoué ❌' }}
        </span>
        <button
          v-if="run?.status === 'active'"
          class="btn-abandon"
          @click="confirming_abandon = true"
        >Abandonner</button>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="loading && !run" class="state-loading">
      <div class="spinner" /> Chargement du donjon…
    </div>

    <div v-else-if="error_msg" class="state-error">{{ error_msg }}</div>

    <template v-else-if="run">

      <!-- ── Room breadcrumb ────────────────────────────────────── -->
      <div class="breadcrumb-wrap">
        <div class="breadcrumb">
          <div
            v-for="room in run.rooms"
            :key="room.room_number"
            class="room-step"
            :class="{
              'step-current':   room.room_number === run.current_room,
              'step-completed': room.completed,
              'step-locked':    !room.completed && room.room_number !== run.current_room,
            }"
          >
            <div class="step-circle" :style="{ borderColor: room_color(room.type) }">
              <span class="step-icon">{{ room_icon(room.type, room.completed, room.room_number === run.current_room) }}</span>
            </div>
            <p class="step-label" :style="{ color: room_color(room.type) }">{{ room_label(room.type) }}</p>
            <p class="step-num">{{ room.room_number }}</p>
          </div>
        </div>
      </div>

      <!-- ── Modifiers ─────────────────────────────────────────── -->
      <div v-if="run.active_modifiers?.length" class="modifiers-row">
        <span class="modifiers-label">Modificateurs actifs :</span>
        <span
          v-for="mod in run.active_modifiers"
          :key="mod.id"
          class="modifier-chip"
          :class="`mod-${mod.type}`"
        >{{ mod.name_fr }}</span>
      </div>

      <!-- ── Current room ───────────────────────────────────────── -->
      <div v-if="current_room && run.status === 'active'" class="current-room-card">
        <div class="room-header">
          <div class="room-type-badge" :style="{ background: room_color(current_room.type) + '22', color: room_color(current_room.type), borderColor: room_color(current_room.type) }">
            {{ room_label(current_room.type) }}
          </div>
          <p class="room-number">Salle {{ current_room.room_number }} / {{ run.rooms.length }}</p>
        </div>

        <div class="room-content">
          <!-- Enemy info for combat rooms -->
          <div v-if="current_room.type === 'combat' || current_room.type === 'elite' || current_room.type === 'boss'" class="room-enemy">
            <img
              v-if="current_room.enemy?.species?.sprite_url"
              :src="current_room.enemy.species.sprite_url"
              :alt="current_room.enemy.species?.name_fr"
              class="enemy-sprite"
              loading="lazy"
              @error="($event.target as HTMLImageElement).src = current_room.enemy.species.sprite_fallback_url"
            />
            <div class="enemy-info">
              <p class="enemy-name font-display">{{ current_room.enemy?.species?.name_fr ?? 'Ennemi inconnu' }}</p>
              <p class="enemy-level">Niv. {{ current_room.enemy?.level }}</p>
            </div>
          </div>

          <!-- Non-combat room description -->
          <p v-else class="room-desc">{{ current_room.description_fr }}</p>
        </div>

        <!-- Last result display -->
        <Transition name="slide-down">
          <div v-if="last_result" class="result-panel" :class="last_result.success ? 'result-success' : 'result-fail'">
            <p class="result-title">{{ last_result.success ? '✅ Salle réussie !' : '❌ Salle échouée' }}</p>
            <p v-if="last_result.description" class="result-desc">{{ last_result.description }}</p>
            <div v-if="last_result.rewards?.gems" class="result-reward">+{{ last_result.rewards.gems }} 💎</div>
          </div>
        </Transition>

        <div class="room-actions">
          <button
            class="btn-enter-room"
            :disabled="loading"
            @click="enterRoom"
          >
            <span v-if="loading" class="btn-spinner" />
            <span v-else>{{ current_room.type === 'rest' ? '🏕️ Se reposer' : current_room.type === 'treasure' ? '💎 Ouvrir' : '⚔️ Entrer' }}</span>
          </button>
        </div>
      </div>

      <!-- ── Run finished ───────────────────────────────────────── -->
      <div v-if="run_finished" class="run-finished">
        <p class="finished-title font-display">{{ run.status === 'completed' ? '🏆 Donjon complété !' : '💀 Run terminé' }}</p>
        <p class="finished-sub">{{ run.status === 'completed' ? 'Excellente performance !' : 'Réessayez pour aller plus loin.' }}</p>
        <NuxtLink to="/jeu/donjons" class="btn-back">← Retour aux Donjons</NuxtLink>
      </div>

    </template>

    <!-- ── Abandon confirm modal ─────────────────────────────────── -->
    <UiModal
      :open="confirming_abandon"
      title="Abandonner le run ?"
      size="sm"
      @close="confirming_abandon = false"
    >
      <p style="color: var(--color-text-secondary); font-size: 0.85rem; line-height: 1.6;">
        Toute progression dans ce donjon sera perdue. Vous pourrez recommencer après le prochain reset.
      </p>
      <template #footer>
        <button class="btn-cancel" @click="confirming_abandon = false">Continuer</button>
        <button class="btn-confirm-abandon" @click="abandon(); confirming_abandon = false">Abandonner</button>
      </template>
    </UiModal>

  </div>
</template>

<style scoped>
.run-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

/* Top bar */
.run-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.topbar-left, .topbar-right { display: flex; align-items: center; gap: var(--space-3); }
.back-link { font-size: 0.82rem; color: var(--color-text-muted); text-decoration: none; transition: var(--transition-fast); }
.back-link:hover { color: var(--color-text-primary); }
.run-name { font-size: 1.5rem; color: var(--color-text-primary); letter-spacing: 0.04em; }

.run-status-chip {
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  padding: 4px 12px;
}
.status-active    { background: rgba(255,215,0,0.12); color: var(--color-accent-yellow); border: 1px solid rgba(255,215,0,0.3); }
.status-completed { background: rgba(86,201,109,0.12); color: var(--type-grass); border: 1px solid rgba(86,201,109,0.3); }
.status-failed    { background: rgba(230,57,70,0.12); color: var(--color-accent-red); border: 1px solid rgba(230,57,70,0.3); }

.btn-abandon {
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
.btn-abandon:hover { background: rgba(230,57,70,0.25); }

/* Breadcrumb */
.breadcrumb-wrap {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  overflow-x: auto;
}
.breadcrumb {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: max-content;
}
.room-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  flex: 1;
  min-width: 64px;
}
.room-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 18px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.08);
  z-index: 0;
}
.step-completed::after { background: rgba(86,201,109,0.4) !important; }

.step-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid;
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  position: relative;
  z-index: 1;
  transition: var(--transition-fast);
}
.step-current .step-circle {
  background: rgba(156,106,222,0.2);
  box-shadow: 0 0 12px rgba(156,106,222,0.4);
  animation: pulse-purple 1.5s ease infinite;
}
.step-completed .step-circle { background: rgba(86,201,109,0.15); border-color: var(--type-grass) !important; }
.step-locked .step-circle    { opacity: 0.4; }

.step-icon  { font-size: 0.85rem; }
.step-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.step-num   { font-size: 0.6rem; color: var(--color-text-muted); }

@keyframes pulse-purple {
  0%, 100% { box-shadow: 0 0 12px rgba(156,106,222,0.4); }
  50%       { box-shadow: 0 0 20px rgba(156,106,222,0.7); }
}

/* Modifiers */
.modifiers-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.modifiers-label { font-size: 0.78rem; color: var(--color-text-muted); font-weight: 700; }
.modifier-chip {
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  padding: 3px 10px;
}
.mod-buff   { background: rgba(86,201,109,0.12); color: var(--type-grass); }
.mod-debuff { background: rgba(230,57,70,0.12); color: var(--color-accent-red); }
.mod-neutral { background: rgba(255,215,0,0.12); color: var(--color-accent-yellow); }

/* Current room */
.current-room-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.room-type-badge {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.06em;
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 4px 16px;
}
.room-number { font-size: 0.78rem; color: var(--color-text-muted); }

.room-content { display: flex; align-items: center; gap: var(--space-4); }
.room-enemy  { display: flex; align-items: center; gap: var(--space-4); }
.enemy-sprite { width: 96px; height: 96px; image-rendering: pixelated; }
.enemy-name  { font-size: 1.6rem; color: var(--color-text-primary); letter-spacing: 0.04em; }
.enemy-level { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px; }
.room-desc   { font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.6; }

.result-panel {
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.result-success { background: rgba(86,201,109,0.1); border: 1px solid rgba(86,201,109,0.3); }
.result-fail    { background: rgba(230,57,70,0.1); border: 1px solid rgba(230,57,70,0.3); }
.result-title { font-weight: 700; font-size: 0.9rem; color: var(--color-text-primary); }
.result-desc  { font-size: 0.8rem; color: var(--color-text-secondary); }
.result-reward { font-weight: 700; color: var(--color-accent-yellow); font-size: 0.85rem; }

.room-actions { display: flex; justify-content: center; }
.btn-enter-room {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 1rem;
  padding: var(--space-3) var(--space-8);
  cursor: pointer;
  transition: var(--transition-base);
  box-shadow: var(--shadow-glow-purple);
}
.btn-enter-room:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); }
.btn-enter-room:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Run finished */
.run-finished {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  text-align: center;
}
.finished-title { font-size: 2rem; color: var(--color-text-primary); letter-spacing: 0.04em; }
.finished-sub   { font-size: 0.88rem; color: var(--color-text-muted); font-style: italic; }
.btn-back {
  background: linear-gradient(135deg, rgba(156,106,222,0.25), rgba(156,106,222,0.15));
  border: 1px solid rgba(156,106,222,0.4);
  border-radius: var(--radius-md);
  color: #b894f5;
  font-family: var(--font-primary);
  font-weight: 700;
  padding: var(--space-3) var(--space-6);
  text-decoration: none;
  transition: var(--transition-fast);
}
.btn-back:hover { background: rgba(156,106,222,0.3); }

/* Modal buttons */
.btn-cancel {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-cancel:hover { background: rgba(255,255,255,0.12); }
.btn-confirm-abandon {
  flex: 1;
  background: linear-gradient(135deg, #a02020, #e63946);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  padding: var(--space-2) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-confirm-abandon:hover { filter: brightness(1.1); }

/* States */
.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.state-error   { padding: var(--space-6); color: var(--color-accent-red); font-weight: 700; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Transitions */
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* Responsive */
@media (max-width: 600px) {
  .run-topbar { flex-direction: column; align-items: flex-start; }
  .room-content { flex-direction: column; align-items: flex-start; }
  .enemy-sprite { width: 72px; height: 72px; }
}
</style>
