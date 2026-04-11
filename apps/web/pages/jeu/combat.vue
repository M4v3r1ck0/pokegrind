<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useNuxtApp } from '#app'
import { useCombatStore } from '~/stores/combat'
import { useAuthStore } from '~/stores/auth'
import { useSprite } from '~/composables/useSprite'

definePageMeta({ middleware: 'auth', layout: 'jeu', ssr: false })

const combat = useCombatStore()
const auth = useAuthStore()
const nuxtApp = useNuxtApp()
const sprite = useSprite()

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

function playerSpriteUrl(pokemon: any): string {
  if (pokemon.species_id) {
    return sprite.getSpriteUrl(pokemon.species_id, pokemon.is_shiny ?? false, pokemon.sprite_url, pokemon.sprite_shiny_url)
  }
  return pokemon.sprite_url ?? ''
}

function formatTimer(ms: number): string {
  const secs = Math.ceil(ms / 1000)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function hpPct(p: any) { return p.max_hp > 0 ? Math.max(0, Math.round(p.current_hp / p.max_hp * 100)) : 0 }
function hpClass(p: any) {
  const pct = hpPct(p)
  if (pct > 50) return 'hp-high'
  if (pct > 20) return 'hp-med'
  return 'hp-low'
}

const REGIONS: Record<string, string> = {
  kanto: 'Kanto', johto: 'Johto', hoenn: 'Hoenn', sinnoh: 'Sinnoh',
  unova: 'Unova', kalos: 'Kalos', alola: 'Alola', galar: 'Galar', paldea: 'Paldea',
}
function regionLabel(r?: string) { return REGIONS[r ?? ''] ?? (r ?? '') }
</script>

<template>
  <div class="combat-root">
    <!-- Arena -->
    <div class="combat-arena">
      <!-- Ennemis -->
      <section class="arena-zone zone-enemy">
        <div class="zone-label enemy-label">⚔ Ennemis
          <span class="floor-info">Étage {{ combat.floor?.floor_number }} — {{ regionLabel(combat.floor?.region) }} · Combat {{ combat.battle_number }}/10</span>
          <button class="btn-change-floor" @click="showFloorModal = true">Changer d'étage</button>
        </div>
        <div class="poke-cards">
          <div
            v-for="enemy in combat.enemy_team"
            :key="enemy.id"
            class="poke-card enemy-card"
            :class="{ ko: enemy.current_hp <= 0 }"
          >
            <img
              class="poke-sprite"
              :src="enemy.sprite_url || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png`"
              :alt="enemy.name_fr"
              @error="onSpriteError($event, enemy)"
            />
            <div class="poke-name">{{ enemy.name_fr }}</div>
            <div class="poke-lv">Niv.{{ enemy.level }}</div>
            <div class="hp-bar-wrap">
              <div class="hp-bar" :class="hpClass(enemy)" :style="{ width: hpPct(enemy) + '%' }" />
            </div>
            <div class="hp-text">{{ enemy.current_hp <= 0 ? 'K.O.' : enemy.current_hp + '/' + enemy.max_hp }}</div>
          </div>
        </div>
      </section>

      <!-- Équipe joueur -->
      <section class="arena-zone zone-team">
        <div class="zone-label team-label">🛡 Votre équipe</div>
        <div class="poke-cards">
          <div
            v-for="pokemon in combat.player_team"
            :key="pokemon.id"
            class="poke-card team-card"
            :class="{ ko: pokemon.current_hp <= 0 }"
          >
            <img
              class="poke-sprite"
              :src="playerSpriteUrl(pokemon)"
              :alt="pokemon.name_fr"
              @error="onSpriteError($event, pokemon)"
            />
            <div class="poke-name">{{ pokemon.name_fr }}</div>
            <div class="poke-lv">Niv.{{ pokemon.level }}</div>
            <div class="hp-bar-wrap">
              <div class="hp-bar" :class="hpClass(pokemon)" :style="{ width: hpPct(pokemon) + '%' }" />
            </div>
            <div class="hp-text">{{ pokemon.current_hp <= 0 ? 'K.O.' : pokemon.current_hp + '/' + pokemon.max_hp }}</div>
            <!-- XP bar -->
            <div v-if="pokemon.xp_to_next" class="xp-bar-wrap">
              <div class="xp-bar" :style="{ width: Math.min(100, Math.round((pokemon.xp ?? 0) / pokemon.xp_to_next * 100)) + '%' }" />
            </div>
            <!-- Move dots -->
            <div class="move-dots">
              <span
                v-for="(move, i) in pokemon.moves"
                :key="i"
                class="move-dot"
                :class="{ empty: move.pp_current === 0 }"
                :title="move.name_fr + ' ' + move.pp_current + '/' + move.pp_max"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Journal -->
    <aside class="combat-log-col">
      <div class="log-header">Journal</div>
      <UiCombatLog :entries="logEntries" :auto-scroll="true" class="log-body" />
      <div class="log-footer">
        <span class="session-gold">💰 +{{ combat.total_gold_earned_session.toLocaleString('fr') }} or</span>
        <span class="session-dot" :class="{ online: combat.is_connected }" />
      </div>
    </aside>
  </div>

  <!-- Modal étages -->
  <UiModal :open="showFloorModal" title="Changer d'étage" size="md" @close="showFloorModal = false">
    <div class="floor-list">
      <button
        v-for="floor in availableFloors"
        :key="floor.floor_number"
        class="floor-btn"
        :class="{
          active:  floor.floor_number === combat.floor?.floor_number,
          cleared: floor.boss_defeated,
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
</template>

<style scoped>
.combat-root {
  display: flex;
  height: calc(100dvh - 48px);
  overflow: hidden;
  background: #0d0f1a;
}
.combat-arena {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 14px;
  gap: 12px;
  background:
    linear-gradient(180deg, rgba(230,57,70,0.04) 0%, transparent 40%),
    linear-gradient(0deg, rgba(79,195,247,0.04) 0%, transparent 40%);
}
.arena-zone {
  flex: none;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.zone-label {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 10px;
}
.enemy-label { color: #f87171; }
.team-label  { color: #4fc3f7; }
.floor-info { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35); letter-spacing: 0; }
.btn-change-floor {
  margin-left: auto;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.btn-change-floor:hover { background: rgba(255,255,255,0.12); color: #fff; }

.poke-cards { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }

.poke-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 8px;
  width: 88px;
  text-align: center;
  transition: opacity 0.3s;
  flex-shrink: 0;
}
.poke-card.ko { opacity: 0.35; filter: grayscale(0.7); }
.enemy-card { border-color: rgba(248,113,113,0.2); background: rgba(230,57,70,0.04); }
.team-card  { border-color: rgba(79,195,247,0.18); background: rgba(79,195,247,0.04); }

.poke-sprite {
  width: 52px; height: 52px;
  image-rendering: pixelated;
  display: block;
  margin: 0 auto 4px;
  object-fit: contain;
}
.poke-name { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.poke-lv   { font-size: 9px; color: rgba(255,255,255,0.35); margin-bottom: 5px; }

.hp-bar-wrap { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-bottom: 3px; }
.hp-bar      { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.hp-high { background: #56c96d; }
.hp-med  { background: #fbbf24; }
.hp-low  { background: #f87171; }
.hp-text { font-size: 9px; color: rgba(255,255,255,0.3); }

.xp-bar-wrap { height: 2px; background: rgba(255,255,255,0.06); border-radius: 1px; overflow: hidden; margin: 3px 0; }
.xp-bar      { height: 100%; background: #9c6ade; border-radius: 1px; transition: width 0.6s ease; }

.move-dots { display: flex; justify-content: center; gap: 3px; margin-top: 4px; }
.move-dot  { width: 5px; height: 5px; border-radius: 50%; background: rgba(156,106,222,0.55); }
.move-dot.empty { background: rgba(255,255,255,0.1); }

/* Journal */
.combat-log-col {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  background: rgba(6,8,18,0.7);
  border-left: 1px solid rgba(255,255,255,0.05);
}
.log-header {
  padding: 12px 14px 8px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.log-body { flex: 1; min-height: 0; }
.log-footer {
  padding: 10px 14px;
  border-top: 1px solid rgba(255,255,255,0.05);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.session-gold { color: #ffd700; font-weight: 700; }
.session-dot  { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.2); margin-left: auto; }
.session-dot.online { background: #56c96d; box-shadow: 0 0 6px #56c96d66; }

/* Floor modal */
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
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  color: rgba(255,255,255,0.55);
  font-family: inherit;
  font-size: 0.85rem;
  text-align: left;
  transition: all 0.15s;
}
.floor-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.floor-btn.active { border-color: rgba(156,106,222,0.5); background: rgba(156,106,222,0.12); color: #b894f5; }
.floor-btn.cleared { color: #56c96d; }
.floor-btn-num { font-weight: 900; color: #ffd700; margin-right: 8px; }
.floor-boss-icon { font-size: 1rem; }
</style>
