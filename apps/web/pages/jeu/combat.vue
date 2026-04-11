<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useNuxtApp } from '#app'
import { useCombatStore } from '~/stores/combat'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const combat = useCombatStore()
const auth = useAuthStore()
const nuxtApp = useNuxtApp()

const showFloorModal = ref(false)
const availableFloors = ref<any[]>([])

// Map store log entries to UiCombatLog format
const logEntries = computed(() => combat.combat_log.map((e: any) => ({
  id:            e.id,
  message:       e.message,
  type:          mapEntryType(e.type),
  effectiveness: mapEffectiveness(e.effectiveness),
  critical:      e.type === 'critical',
  miss:          e.type === 'miss',
})))

function mapEntryType(t: string) {
  if (t === 'ko' || t === 'defeat') return 'faint'
  if (t === 'victory' || t === 'new_floor') return 'boss'
  if (t === 'status') return 'status'
  if (t === 'info' || t === 'timeout') return 'info'
  return 'damage'
}

function mapEffectiveness(e?: number): 'super' | 'weak' | 'immune' | 'normal' | undefined {
  if (e === undefined || e === null) return undefined
  if (e >= 2)   return 'super'
  if (e === 0)  return 'immune'
  if (e < 1)    return 'weak'
  return 'normal'
}

onUnmounted(() => {
  combat.destroyCombat()
})

onMounted(async () => {
  if (auth.player?.id) {
    combat.initCombat(auth.player.id)
    try {
      const api = nuxtApp.$api as any
      const { data } = await api.post('/combat/start')
      combat.applyFullState(data)
    } catch (e) {
      console.error('Erreur démarrage combat:', e)
    }
    try {
      const api = nuxtApp.$api as any
      const { data } = await api.get('/combat/floors')
      availableFloors.value = data.floors
    } catch (e) {
      console.error('Erreur chargement étages:', e)
    }
  }
})

async function changeFloor(floor_number: number) {
  showFloorModal.value = false
  try {
    await combat.moveToFloor(floor_number)
  } catch (e) {
    console.error('Erreur changement étage:', e)
  }
}

function onSpriteError(e: Event, pokemon: any) {
  const img = e.target as HTMLImageElement
  if (pokemon.sprite_fallback_url) img.src = pokemon.sprite_fallback_url
}

function formatTimer(ms: number): string {
  const secs = Math.ceil(ms / 1000)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="combat-page">

    <!-- ── Top bar ──────────────────────────────────────────────────── -->
    <div class="combat-topbar">
      <div class="floor-info">
        <span class="floor-label">Étage</span>
        <span v-if="combat.floor" class="floor-name">
          <span class="floor-num">{{ combat.floor.floor_number }}</span>
          — {{ combat.floor.floor_name_fr }}
          <span class="floor-region">({{ combat.floor.region }})</span>
        </span>
        <span v-else class="floor-name text-muted">Connexion…</span>
        <span class="battle-counter">
          Combat {{ combat.battle_number }}/10
          <span v-if="combat.is_boss" class="boss-pill">BOSS</span>
        </span>
      </div>

      <div class="topbar-right">
        <div v-if="combat.is_boss && combat.boss_timer_remaining_ms !== null" class="boss-timer">
          ⏱ {{ formatTimer(combat.boss_timer_remaining_ms) }}
        </div>
        <div class="session-gold">
          💰 <span>+{{ combat.total_gold_earned_session.toLocaleString('fr') }} or</span>
        </div>
        <div :class="['conn-dot', combat.is_connected ? 'conn-ok' : 'conn-off']"
             :title="combat.is_connected ? 'Connecté' : 'Déconnecté'" />
        <button class="btn-floor" @click="showFloorModal = true">Changer d'étage</button>
      </div>
    </div>

    <!-- ── Arena ───────────────────────────────────────────────────── -->
    <div class="arena">

      <!-- Enemy zone -->
      <section class="zone zone-enemy">
        <h3 class="zone-heading">Ennemis</h3>
        <div class="pokemon-row">
          <div
            v-for="enemy in combat.enemy_team"
            :key="enemy.id"
            class="poke-card"
            :class="{ ko: enemy.current_hp <= 0 }"
          >
            <img
              v-if="enemy.sprite_url"
              :src="enemy.sprite_url"
              :alt="enemy.name_fr"
              class="poke-sprite"
            />
            <div v-else class="poke-sprite-ph">?</div>
            <UiStatusIcon
              v-if="enemy.status && enemy.current_hp > 0"
              :status="enemy.status"
              size="sm"
              class="status-overlay"
            />
            <div class="poke-name">{{ enemy.name_fr }}</div>
            <div class="poke-lv">Niv.{{ enemy.level }}</div>
            <UiHpBar
              :current="enemy.current_hp"
              :max="enemy.max_hp"
              height="5px"
              :show-text="true"
            />
            <div v-if="enemy.current_hp <= 0" class="ko-overlay">K.O.</div>
          </div>
          <div v-if="combat.enemy_team.length === 0" class="empty-zone">
            En attente des ennemis…
          </div>
        </div>
      </section>

      <!-- Combat log (center) -->
      <div class="log-panel">
        <div class="log-panel-header">Journal de combat</div>
        <UiCombatLog :entries="logEntries" :auto-scroll="true" />
      </div>

      <!-- Player zone -->
      <section class="zone zone-player">
        <h3 class="zone-heading">Votre équipe</h3>
        <div class="pokemon-row">
          <div
            v-for="pokemon in combat.player_team"
            :key="pokemon.id"
            class="poke-card poke-card-player"
            :class="{ ko: pokemon.current_hp <= 0 }"
          >
            <img
              v-if="pokemon.sprite_url"
              :src="pokemon.sprite_url"
              :alt="pokemon.name_fr"
              class="poke-sprite poke-sprite-player"
              @error="(e: Event) => onSpriteError(e, pokemon)"
            />
            <div v-else class="poke-sprite-ph">?</div>
            <UiStatusIcon
              v-if="pokemon.status && pokemon.current_hp > 0"
              :status="pokemon.status"
              size="sm"
              class="status-overlay"
            />
            <div class="poke-name">{{ pokemon.name_fr }}</div>
            <div class="poke-lv">Niv.{{ pokemon.level }}</div>
            <UiHpBar
              :current="pokemon.current_hp"
              :max="pokemon.max_hp"
              height="5px"
              :show-text="true"
            />
            <!-- Barre XP -->
            <div v-if="pokemon.xp !== undefined" class="xp-bar-wrap">
              <UiProgressBar
                :value="pokemon.xp ?? 0"
                :max="pokemon.xp_to_next ?? 1"
                color="#a78bfa"
                height="3px"
                :show-text="false"
              />
              <span class="xp-label">XP {{ pokemon.xp }}/{{ pokemon.xp_to_next }}</span>
            </div>
            <!-- Move PP -->
            <div class="moves-pp">
              <span
                v-for="move in pokemon.moves"
                :key="move.slot"
                class="pp-chip"
                :class="{ 'pp-empty': move.pp_current === 0 }"
                :title="move.name_fr"
              >{{ move.pp_current }}/{{ move.pp_max }}</span>
            </div>
            <div v-if="pokemon.current_hp <= 0" class="ko-overlay">K.O.</div>
          </div>
          <div v-if="combat.player_team.length === 0" class="empty-zone">
            Aucun Pokémon en équipe. Assignez-en depuis l'inventaire.
          </div>
        </div>
      </section>
    </div>

    <!-- ── Floor modal ─────────────────────────────────────────────── -->
    <UiModal :open="showFloorModal" title="Changer d'étage" size="md" @close="showFloorModal = false">
      <div class="floor-list">
        <button
          v-for="floor in availableFloors"
          :key="floor.floor_number"
          class="floor-btn"
          :class="{
            active:   floor.floor_number === combat.floor?.floor_number,
            cleared:  floor.boss_defeated,
          }"
          @click="changeFloor(floor.floor_number)"
        >
          <span class="floor-btn-name">
            <span class="floor-btn-num">{{ floor.floor_number }}</span>
            {{ floor.name_fr }}
          </span>
          <span v-if="floor.has_boss" class="floor-boss-icon">
            {{ floor.boss_defeated ? '✅' : '👑' }}
          </span>
        </button>
      </div>
    </UiModal>

  <!-- FAB équipe — raccourci visible en permanence -->
  <NuxtLink to="/jeu/equipe" class="equipe-fab" title="Gérer l'équipe">
    👥 Équipe
  </NuxtLink>

  </div>
</template>

<style scoped>
.combat-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Top bar ────────────────────────────────────────────────────────── */
.combat-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.floor-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.floor-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.floor-name {
  font-family: var(--font-primary);
  font-weight: 700;
  color: var(--color-accent-purple);
  font-size: 1rem;
}

.floor-num {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--color-accent-yellow);
}

.floor-region { font-size: 0.8rem; color: var(--color-text-muted); }

.battle-counter {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.boss-pill {
  background: var(--color-accent-red);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  letter-spacing: 0.05em;
  animation: pulse-gold 1.5s ease-in-out infinite;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.boss-timer {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--color-accent-yellow);
  letter-spacing: 0.04em;
}

.session-gold {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-accent-yellow);
}

.conn-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.conn-ok  { background: var(--type-grass); box-shadow: 0 0 6px rgba(86,201,109,0.6); }
.conn-off { background: var(--color-accent-red); }

.btn-floor {
  background: rgba(156,106,222,0.15);
  border: 1px solid rgba(156,106,222,0.4);
  color: #b894f5;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.btn-floor:hover { background: rgba(156,106,222,0.25); }

/* ── Arena ──────────────────────────────────────────────────────────── */
.arena {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: auto 1fr;
  gap: var(--space-4);
  align-items: start;
}

.zone {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
}

.zone-enemy  { grid-column: 1; grid-row: 1; }
.zone-player { grid-column: 1; grid-row: 2; }
.log-panel   { grid-column: 2; grid-row: 1 / 3; display: flex; flex-direction: column; }

.zone-heading {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
  font-weight: 700;
}

/* ── Pokémon cards ──────────────────────────────────────────────────── */
.pokemon-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.poke-card {
  position: relative;
  background: var(--color-bg-tertiary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  width: 108px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transition: var(--transition-fast);
}

.poke-card-player {
  border-color: rgba(156,106,222,0.2);
}

.poke-card.ko {
  opacity: 0.35;
  filter: grayscale(0.7);
}

.poke-sprite {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
}

.poke-sprite-player {
  filter: drop-shadow(0 2px 8px rgba(156,106,222,0.3));
}

.poke-sprite-ph {
  width: 72px;
  height: 72px;
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 1.5rem;
}

.status-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
}

.poke-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poke-lv {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

.ko-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-accent-red);
  letter-spacing: 0.08em;
  border-radius: var(--radius-lg);
}

/* XP bar */
.xp-bar-wrap { margin-top: 2px; width: 100%; }
.xp-label { font-size: 0.55rem; color: var(--color-text-muted); text-align: center; display: block; }

/* PP chips */
.moves-pp {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  margin-top: 2px;
}

.pp-chip {
  font-size: 0.58rem;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255,255,255,0.08);
  color: var(--color-text-secondary);
  font-weight: 600;
}
.pp-chip.pp-empty { background: rgba(230,57,70,0.2); color: var(--color-accent-red); }

.empty-zone {
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.85rem;
  padding: var(--space-4);
}

/* ── Log panel ──────────────────────────────────────────────────────── */
.log-panel {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 680px;
}

.log-panel-header {
  padding: var(--space-3) var(--space-4);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}

/* Override UiCombatLog height inside panel */
.log-panel :deep(.combat-log) {
  flex: 1;
  min-height: 0;
  height: auto;
  overflow-y: auto;
  border: none;
  border-radius: 0;
}

/* ── Floor list (modal) ─────────────────────────────────────────────── */
.floor-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.floor-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  font-size: 0.85rem;
  text-align: left;
  transition: var(--transition-fast);
}
.floor-btn:hover { background: rgba(255,255,255,0.08); color: var(--color-text-primary); }
.floor-btn.active { border-color: rgba(156,106,222,0.5); background: rgba(156,106,222,0.12); color: #b894f5; }
.floor-btn.cleared { color: var(--type-grass); }

.floor-btn-num {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-accent-yellow);
  margin-right: var(--space-2);
}

.floor-boss-icon { font-size: 1rem; }

/* ── FAB équipe ─────────────────────────────────────────────────────── */
.equipe-fab {
  position: fixed;
  bottom: 80px;
  left: var(--space-4);
  z-index: 50;
  background: rgba(79,195,247,0.15);
  border: 1px solid rgba(79,195,247,0.3);
  border-radius: var(--radius-full);
  padding: 8px 16px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #4fc3f7;
  text-decoration: none;
  backdrop-filter: blur(8px);
  transition: var(--transition-fast);
  display: flex;
  align-items: center;
  gap: 6px;
}
.equipe-fab:hover {
  background: rgba(79,195,247,0.25);
  transform: translateY(-2px);
}

/* ── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .arena {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
  .log-panel { grid-column: 1; grid-row: 3; }
  .zone-enemy  { grid-row: 1; }
  .zone-player { grid-row: 2; }
}

@media (max-width: 640px) {
  .poke-card { width: 90px; }
  .poke-sprite { width: 56px; height: 56px; }
}
</style>
