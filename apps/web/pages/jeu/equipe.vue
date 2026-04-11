<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTeamStore, type TeamPokemon, type AvailableMove } from '~/stores/team'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const team = useTeamStore()

// ─── État des modals ───────────────────────────────────────────────────────
const selectedPokemon = ref<TeamPokemon | null>(null)
const showDetailModal = ref(false)
const showMoveModal = ref(false)
const showSlotModal = ref(false)
const targetSlot = ref<number | null>(null)

// Données du sélecteur de moves
const availableMoves = ref<AvailableMove[]>([])
const pendingMoveSlots = ref<{ slot: number; move_id: number }[]>([])
const moveLoading = ref(false)
const moveError = ref<string | null>(null)
const savingMoves = ref(false)

// Filtres collection
const filterMode = ref<'all' | 'team' | 'bench'>('all')
const sortMode = ref<'recent' | 'level' | 'name' | 'rarity'>('level')

// ─── Filtres & tri ────────────────────────────────────────────────────────
const filteredPokemons = computed(() => {
  let list = [...team.pokemons]
  if (filterMode.value === 'team') list = list.filter((p) => p.slot_team !== null)
  if (filterMode.value === 'bench') list = list.filter((p) => p.slot_team === null && p.slot_daycare === null)
  switch (sortMode.value) {
    case 'level': list.sort((a, b) => b.level - a.level); break
    case 'name': list.sort((a, b) => a.name_fr.localeCompare(b.name_fr)); break
    case 'rarity': {
      const order: Record<string, number> = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 }
      list.sort((a, b) => (order[b.rarity] ?? 0) - (order[a.rarity] ?? 0))
      break
    }
    default: break
  }
  return list
})

// ─── Helpers ──────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  fire: '#ff6b35', water: '#4fc3f7', grass: '#56c96d', electric: '#ffd700',
  psychic: '#ff6b9d', ice: '#96d9e8', dragon: '#6c5ce7', dark: '#4a4a6a',
  fairy: '#ffb3d9', fighting: '#d4522a', poison: '#a855c8', ground: '#c8a85e',
  rock: '#8b7355', bug: '#91b800', ghost: '#6c5ce7', steel: '#8fa8c8',
  normal: '#a8a878', flying: '#89aadc',
}

const RARITY_COLORS: Record<string, string> = {
  common: '#a8b5c2', rare: '#4fc3f7', epic: '#c678dd', legendary: '#ffd700', mythic: '#ff6b9d',
}

const CATEGORY_LABELS: Record<string, string> = {
  physical: 'Physique', special: 'Spécial', status: 'Statut',
}

function spriteUrl(p: TeamPokemon): string {
  if (p.is_shiny && p.species.sprite_shiny_url) return p.species.sprite_shiny_url
  return p.species.sprite_url ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.species_id}.png`
}

function onSpriteError(e: Event, p: TeamPokemon) {
  const img = e.target as HTMLImageElement
  const name = p.name_fr.toLowerCase().replace(/[^a-z0-9-]/g, '')
  img.src = `https://play.pokemonshowdown.com/sprites/gen5/${name}.png`
}

function rarityLabel(r: string): string {
  return { common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', mythic: 'Mythique' }[r] ?? r
}

function stars(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n) }

// ─── Actions équipe ───────────────────────────────────────────────────────
async function removeFromTeam(p: TeamPokemon) {
  await team.setSlot(p.id, null)
}

async function assignToSlot(pokemon_id: string, slot: number) {
  showSlotModal.value = false
  await team.setSlot(pokemon_id, slot)
}

function openSlotModal(slot: number) {
  targetSlot.value = slot
  showSlotModal.value = true
}

// ─── Modal détail ─────────────────────────────────────────────────────────
function openDetail(p: TeamPokemon) {
  // Préférer la version complète depuis pokemons (qui contient les moves chargés via fetchTeam)
  const fullPokemon = team.pokemons.find(pk => pk.id === p.id) ?? p
  selectedPokemon.value = fullPokemon
  showDetailModal.value = true
  showMoveModal.value = false
  pendingMoveSlots.value = fullPokemon.moves.map((m) => ({ slot: m.slot, move_id: m.move_id }))
}

function closeDetail() {
  showDetailModal.value = false
  selectedPokemon.value = null
}

// ─── Modal moves ──────────────────────────────────────────────────────────
async function openMoveSelector() {
  if (!selectedPokemon.value) return
  moveLoading.value = true
  moveError.value = null
  showMoveModal.value = true
  try {
    availableMoves.value = await team.getAvailableMoves(selectedPokemon.value.id)
    // Pré-remplir avec les moves actuels
    pendingMoveSlots.value = selectedPokemon.value.moves.map((m) => ({
      slot: m.slot,
      move_id: m.move_id,
    }))
  } catch {
    moveError.value = 'Impossible de charger les moves.'
  } finally {
    moveLoading.value = false
  }
}

function assignMoveToSlot(slotNum: number, move_id: number) {
  const existing = pendingMoveSlots.value.findIndex((s) => s.slot === slotNum)
  if (existing >= 0) {
    pendingMoveSlots.value[existing].move_id = move_id
  } else {
    pendingMoveSlots.value.push({ slot: slotNum, move_id })
  }
}

function getSlotMove(slotNum: number): AvailableMove | undefined {
  const entry = pendingMoveSlots.value.find((s) => s.slot === slotNum)
  if (!entry) return undefined
  // Chercher d'abord dans les moves disponibles du learnset
  const fromLearnset = availableMoves.value.find((m) => m.move_id === entry.move_id)
  if (fromLearnset) return fromLearnset
  // Fallback : chercher dans les moves actuels du Pokémon (assignés avant qu'ils soient dans le learnset accessible)
  const currentMove = selectedPokemon.value?.moves.find((m) => m.move_id === entry.move_id)
  if (!currentMove) return undefined
  return {
    move_id: currentMove.move_id,
    level_learned_at: 0,
    name_fr: currentMove.name_fr,
    type: currentMove.type,
    category: currentMove.category,
    power: currentMove.power,
    accuracy: null as any,
    pp: currentMove.pp_max,
    priority: 0,
  }
}

function clearSlot(slotNum: number) {
  pendingMoveSlots.value = pendingMoveSlots.value.filter((s) => s.slot !== slotNum)
}

async function saveMoves() {
  if (!selectedPokemon.value || pendingMoveSlots.value.length === 0) return
  savingMoves.value = true
  moveError.value = null
  try {
    await team.updateMoves(selectedPokemon.value.id, pendingMoveSlots.value)
    showMoveModal.value = false
    // Rafraichir le pokémon sélectionné
    const updated = team.pokemons.find((p) => p.id === selectedPokemon.value!.id)
    if (updated) selectedPokemon.value = updated
  } catch (e: any) {
    moveError.value = e?.response?.data?.message ?? 'Erreur lors de la sauvegarde.'
  } finally {
    savingMoves.value = false
  }
}

onMounted(() => { team.fetchTeam() })
</script>

<template>
  <div class="equipe-page">
    <h1 class="page-title">Équipe & Collection</h1>

    <!-- ── Section équipe (6 slots) ─────────────────────────────────────── -->
    <section class="team-section">
      <h2 class="section-title">Mon équipe</h2>
      <div class="team-slots">
        <div
          v-for="s in team.teamSlots"
          :key="s.slot"
          class="team-slot"
          :class="{ occupied: !!s.pokemon }"
        >
          <template v-if="s.pokemon">
            <div class="slot-badge">{{ s.slot }}</div>
            <div class="slot-shiny-badge" v-if="s.pokemon.is_shiny">✨</div>
            <img
              class="slot-sprite"
              :src="spriteUrl(s.pokemon)"
              :alt="s.pokemon.name_fr"
              @error="(e) => onSpriteError(e, s.pokemon!)"
            />
            <div class="slot-name">{{ s.pokemon.nickname ?? s.pokemon.name_fr }}</div>
            <div class="slot-level">Niv. {{ s.pokemon.level }}</div>
            <div class="slot-types">
              <span
                class="type-badge"
                :style="{ backgroundColor: TYPE_COLORS[s.pokemon.species.type1] }"
              >{{ s.pokemon.species.type1 }}</span>
              <span
                v-if="s.pokemon.species.type2"
                class="type-badge"
                :style="{ backgroundColor: TYPE_COLORS[s.pokemon.species.type2] }"
              >{{ s.pokemon.species.type2 }}</span>
            </div>
            <div class="slot-actions">
              <button class="btn-detail" @click="openDetail(s.pokemon!)">Détail</button>
              <button class="btn-remove" @click="removeFromTeam(s.pokemon!)">Retirer</button>
            </div>
          </template>
          <template v-else>
            <button class="slot-empty" @click="openSlotModal(s.slot)">
              <span class="slot-num">{{ s.slot }}</span>
              <span class="slot-plus">+</span>
              <span class="slot-hint">Ajouter</span>
            </button>
          </template>
        </div>
      </div>
    </section>

    <!-- ── Collection ────────────────────────────────────────────────────── -->
    <section class="collection-section">
      <div class="collection-header">
        <h2 class="section-title">Collection ({{ team.pokemons.length }})</h2>
        <div class="filters">
          <div class="filter-group">
            <button
              v-for="f in [['all','Tous'],['team','Équipe'],['bench','Hors équipe']]"
              :key="f[0]"
              class="filter-btn"
              :class="{ active: filterMode === f[0] }"
              @click="filterMode = f[0] as any"
            >{{ f[1] }}</button>
          </div>
          <select v-model="sortMode" class="sort-select">
            <option value="level">Tri : Niveau</option>
            <option value="name">Tri : Nom</option>
            <option value="rarity">Tri : Rareté</option>
            <option value="recent">Tri : Récents</option>
          </select>
        </div>
      </div>

      <div v-if="team.loading" class="loading-msg">Chargement…</div>
      <div v-else-if="team.error" class="error-msg">{{ team.error }}</div>
      <div v-else-if="filteredPokemons.length === 0" class="empty-msg">Aucun Pokémon trouvé.</div>

      <div v-else class="pokemon-grid">
        <div
          v-for="p in filteredPokemons"
          :key="p.id"
          class="pokemon-card"
          :class="[p.rarity, { 'in-team': p.slot_team !== null, shiny: p.is_shiny }]"
          @click="openDetail(p)"
        >
          <div v-if="p.slot_team !== null" class="in-team-badge">Slot {{ p.slot_team }}</div>
          <div v-if="p.is_shiny" class="shiny-badge">✨</div>
          <img
            class="card-sprite"
            :src="spriteUrl(p)"
            :alt="p.name_fr"
            @error="(e) => onSpriteError(e, p)"
          />
          <div class="card-name">{{ p.nickname ?? p.name_fr }}</div>
          <div class="card-level">Niv. {{ p.level }}</div>
          <div class="card-types">
            <span class="type-badge" :style="{ backgroundColor: TYPE_COLORS[p.species.type1] }">{{ p.species.type1 }}</span>
            <span v-if="p.species.type2" class="type-badge" :style="{ backgroundColor: TYPE_COLORS[p.species.type2] }">{{ p.species.type2 }}</span>
          </div>
          <div class="card-rarity" :style="{ color: RARITY_COLORS[p.rarity] }">{{ rarityLabel(p.rarity) }}</div>
          <div class="card-stars">{{ stars(p.stars) }}</div>
        </div>
      </div>
    </section>

    <!-- ── Modal détail Pokémon ───────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showDetailModal && selectedPokemon" class="modal-backdrop" @click.self="closeDetail">
        <div class="modal detail-modal">
          <button class="modal-close" @click="closeDetail">✕</button>
          <div class="detail-header">
            <div class="detail-sprite-wrap" :class="{ shiny: selectedPokemon.is_shiny }">
              <img
                class="detail-sprite"
                :src="spriteUrl(selectedPokemon)"
                :alt="selectedPokemon.name_fr"
                @error="(e) => onSpriteError(e, selectedPokemon!)"
              />
            </div>
            <div class="detail-info">
              <div class="detail-name">
                {{ selectedPokemon.nickname ?? selectedPokemon.name_fr }}
                <span v-if="selectedPokemon.nickname" class="detail-species">({{ selectedPokemon.name_fr }})</span>
                <span v-if="selectedPokemon.is_shiny" class="shiny-tag">✨ Shiny</span>
              </div>
              <div class="detail-level">Niv. {{ selectedPokemon.level }} · {{ selectedPokemon.nature }}</div>
              <div class="detail-stars">{{ stars(selectedPokemon.stars) }}</div>
              <div class="detail-types">
                <span class="type-badge" :style="{ backgroundColor: TYPE_COLORS[selectedPokemon.species.type1] }">{{ selectedPokemon.species.type1 }}</span>
                <span v-if="selectedPokemon.species.type2" class="type-badge" :style="{ backgroundColor: TYPE_COLORS[selectedPokemon.species.type2] }">{{ selectedPokemon.species.type2 }}</span>
              </div>
              <div class="detail-rarity" :style="{ color: RARITY_COLORS[selectedPokemon.rarity] }">{{ rarityLabel(selectedPokemon.rarity) }}</div>
            </div>
          </div>

          <!-- IVs -->
          <div class="detail-ivs">
            <div v-for="[stat, val] in Object.entries(selectedPokemon.ivs)" :key="stat" class="iv-row">
              <span class="iv-label">{{ stat.toUpperCase() }}</span>
              <div class="iv-bar-wrap">
                <div class="iv-bar" :style="{ width: `${(val / 31) * 100}%` }"></div>
              </div>
              <span class="iv-val">{{ val }}/31</span>
            </div>
          </div>

          <!-- Moves actuels -->
          <div class="detail-moves">
            <div class="moves-header">
              <span class="moves-title">Moves</span>
              <button class="btn-edit-moves" @click="openMoveSelector">Modifier</button>
            </div>
            <div v-if="selectedPokemon.moves.length === 0" class="no-moves">Aucun move assigné.</div>
            <div v-else class="move-list">
              <div v-for="m in selectedPokemon.moves.sort((a,b)=>a.slot-b.slot)" :key="m.slot" class="move-item">
                <span class="move-slot">{{ m.slot }}</span>
                <span class="move-type-badge" :style="{ backgroundColor: TYPE_COLORS[m.type] }">{{ m.type }}</span>
                <span class="move-name">{{ m.name_fr }}</span>
                <span class="move-cat">{{ CATEGORY_LABELS[m.category] }}</span>
                <span class="move-power">{{ m.power ?? '—' }}</span>
                <span class="move-pp">{{ m.pp_current }}/{{ m.pp_max }} PP</span>
              </div>
            </div>
          </div>

          <!-- Actions équipe -->
          <div class="detail-actions">
            <template v-if="selectedPokemon.slot_team !== null">
              <button class="btn-secondary" @click="removeFromTeam(selectedPokemon!); closeDetail()">
                Retirer de l'équipe
              </button>
            </template>
            <template v-else>
              <button
                v-for="s in team.teamSlots.filter(s => !s.pokemon)"
                :key="s.slot"
                class="btn-primary"
                @click="assignToSlot(selectedPokemon!.id, s.slot); closeDetail()"
              >
                Slot {{ s.slot }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal sélecteur de moves ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showMoveModal" class="modal-backdrop" @click.self="showMoveModal = false">
        <div class="modal move-modal">
          <button class="modal-close" @click="showMoveModal = false">✕</button>
          <h3 class="modal-title">Choisir les moves — {{ selectedPokemon?.name_fr }}</h3>

          <!-- Slots sélectionnés -->
          <div class="pending-slots">
            <div v-for="slotNum in [1,2,3,4]" :key="slotNum" class="pending-slot">
              <span class="slot-label">Slot {{ slotNum }}</span>
              <template v-if="getSlotMove(slotNum)">
                <span class="move-type-badge" :style="{ backgroundColor: TYPE_COLORS[getSlotMove(slotNum)!.type] }">{{ getSlotMove(slotNum)!.type }}</span>
                <span class="slot-move-name">{{ getSlotMove(slotNum)!.name_fr }}</span>
                <button class="btn-clear" @click="clearSlot(slotNum)">✕</button>
              </template>
              <span v-else class="slot-empty-label">— Vide —</span>
            </div>
          </div>

          <div v-if="moveError" class="error-msg">{{ moveError }}</div>
          <div v-if="moveLoading" class="loading-msg">Chargement des moves…</div>

          <!-- Liste des moves disponibles -->
          <div v-else-if="availableMoves.length === 0" class="no-moves">
            Aucun move disponible pour ce Pokémon à son niveau actuel.
          </div>
          <div v-else class="available-moves">
            <div
              v-for="m in availableMoves"
              :key="m.move_id"
              class="available-move"
              :class="{ selected: pendingMoveSlots.some(s => s.move_id === m.move_id) }"
            >
              <span class="move-type-badge" :style="{ backgroundColor: TYPE_COLORS[m.type] }">{{ m.type }}</span>
              <span class="move-name">{{ m.name_fr }}</span>
              <span class="move-cat">{{ CATEGORY_LABELS[m.category] }}</span>
              <span class="move-power">{{ m.power ?? '—' }}</span>
              <span class="move-pp">{{ m.pp }} PP</span>
              <div class="move-assign-btns">
                <button
                  v-for="slotNum in [1,2,3,4]"
                  :key="slotNum"
                  class="btn-assign"
                  :class="{ active: pendingMoveSlots.some(s => s.slot === slotNum && s.move_id === m.move_id) }"
                  @click="assignMoveToSlot(slotNum, m.move_id)"
                >{{ slotNum }}</button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="showMoveModal = false">Annuler</button>
            <button class="btn-primary" :disabled="savingMoves || pendingMoveSlots.length === 0" @click="saveMoves">
              {{ savingMoves ? 'Sauvegarde…' : 'Sauvegarder' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal choix slot ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showSlotModal" class="modal-backdrop" @click.self="showSlotModal = false">
        <div class="modal slot-modal">
          <button class="modal-close" @click="showSlotModal = false">✕</button>
          <h3 class="modal-title">Choisir un Pokémon — Slot {{ targetSlot }}</h3>
          <div v-if="team.benchPokemons.length === 0" class="empty-msg">Aucun Pokémon disponible.</div>
          <div v-else class="bench-list">
            <div
              v-for="p in team.benchPokemons"
              :key="p.id"
              class="bench-item"
              @click="assignToSlot(p.id, targetSlot!)"
            >
              <img class="bench-sprite" :src="spriteUrl(p)" :alt="p.name_fr" @error="(e) => onSpriteError(e, p)" />
              <span class="bench-name">{{ p.name_fr }}</span>
              <span class="bench-level">Niv. {{ p.level }}</span>
              <span class="bench-rarity" :style="{ color: RARITY_COLORS[p.rarity] }">{{ rarityLabel(p.rarity) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.equipe-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  color: var(--color-text-primary, #f0f0f0);
}

.page-title {
  font-family: var(--font-display, 'Bangers', cursive);
  font-size: 2rem;
  color: var(--color-accent-yellow, #ffd700);
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-accent, #ffd700);
  margin-bottom: 1rem;
}

/* ── Slots équipe ─────────────────────────────────────────────────────── */
.team-section { margin-bottom: 2rem; }

.team-slots {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.75rem;
}

@media (max-width: 768px) { .team-slots { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .team-slots { grid-template-columns: repeat(2, 1fr); } }

.team-slot {
  background: var(--color-bg-secondary, #252742);
  border: 2px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 12px;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-height: 180px;
  position: relative;
  transition: border-color 0.2s ease;
}

.team-slot.occupied { border-color: var(--color-accent-blue, #4fc3f7); }
.team-slot:hover { border-color: var(--color-accent-yellow, #ffd700); }

.slot-badge {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--color-accent-blue, #4fc3f7);
  color: #000;
  border-radius: 999px;
  padding: 1px 6px;
}

.slot-shiny-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 0.8rem;
}

.slot-sprite { width: 80px; height: 80px; object-fit: contain; image-rendering: pixelated; }

.slot-name {
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
  color: var(--color-text-primary, #f0f0f0);
}

.slot-level { font-size: 0.75rem; color: var(--color-text-secondary, #a0aec0); }

.slot-types { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }

.slot-actions { display: flex; gap: 4px; margin-top: auto; }

.btn-detail, .btn-remove {
  font-size: 0.7rem;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-detail { background: var(--color-accent-blue, #4fc3f7); color: #000; }
.btn-remove { background: var(--color-accent-red, #e63946); color: #fff; }
.btn-detail:hover, .btn-remove:hover { opacity: 0.8; }

.slot-empty {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  color: var(--color-text-muted, #6b7a99);
  transition: color 0.2s;
}

.slot-empty:hover { color: var(--color-accent-yellow, #ffd700); }

.slot-num { font-size: 0.75rem; }
.slot-plus { font-size: 2rem; line-height: 1; }
.slot-hint { font-size: 0.7rem; }

/* ── Collection ─────────────────────────────────────────────────────────── */
.collection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filters { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

.filter-group { display: flex; gap: 4px; }

.filter-btn {
  font-size: 0.8rem;
  padding: 4px 10px;
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 8px;
  background: var(--color-bg-secondary, #252742);
  color: var(--color-text-secondary, #a0aec0);
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn.active {
  background: var(--color-accent-blue, #4fc3f7);
  color: #000;
  border-color: var(--color-accent-blue, #4fc3f7);
}

.sort-select {
  font-size: 0.8rem;
  padding: 4px 8px;
  background: var(--color-bg-secondary, #252742);
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 8px;
  color: var(--color-text-primary, #f0f0f0);
  cursor: pointer;
}

.pokemon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.75rem;
}

.pokemon-card {
  background: var(--color-bg-secondary, #252742);
  border: 2px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 12px;
  padding: 0.75rem 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.pokemon-card:hover { transform: scale(1.03); }

.pokemon-card.in-team { border-color: var(--color-accent-blue, #4fc3f7); }
.pokemon-card.shiny { border-color: #ffe066; box-shadow: 0 0 8px 2px rgba(255,224,102,0.3); }
.pokemon-card.legendary { border-color: var(--color-rarity-legendary, #ffd700); }
.pokemon-card.epic { border-color: var(--color-rarity-epic, #c678dd); }
.pokemon-card.mythic { border-color: var(--color-rarity-mythic, #ff6b9d); }

.in-team-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.55rem;
  background: var(--color-accent-blue, #4fc3f7);
  color: #000;
  border-radius: 999px;
  padding: 1px 5px;
  font-weight: 700;
}

.shiny-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 0.75rem;
}

.card-sprite { width: 80px; height: 80px; object-fit: contain; image-rendering: pixelated; }
.card-name { font-size: 0.75rem; font-weight: 700; text-align: center; }
.card-level { font-size: 0.65rem; color: var(--color-text-secondary, #a0aec0); }
.card-types { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
.card-rarity { font-size: 0.65rem; font-weight: 700; }
.card-stars { font-size: 0.6rem; color: var(--color-accent-yellow, #ffd700); letter-spacing: 1px; }

/* ── Type badge ─────────────────────────────────────────────────────────── */
.type-badge {
  font-size: 0.6rem;
  padding: 1px 6px;
  border-radius: 999px;
  color: #fff;
  font-weight: 600;
  text-transform: capitalize;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
}

/* ── Modals ─────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--color-bg-secondary, #252742);
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.detail-modal { max-width: 540px; }
.move-modal { max-width: 700px; }
.slot-modal { max-width: 480px; }

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #6b7a99);
  font-size: 1rem;
  cursor: pointer;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-accent-yellow, #ffd700);
  margin-bottom: 1rem;
}

/* ── Détail modal ───────────────────────────────────────────────────────── */
.detail-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.detail-sprite-wrap {
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 12px;
  padding: 0.5rem;
  flex-shrink: 0;
}

.detail-sprite-wrap.shiny {
  border: 2px solid #ffe066;
  box-shadow: 0 0 12px rgba(255,224,102,0.4);
}

.detail-sprite { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }

.detail-name { font-size: 1.2rem; font-weight: 700; }
.detail-species { font-size: 0.8rem; color: var(--color-text-muted, #6b7a99); }
.shiny-tag { font-size: 0.75rem; color: #ffe066; margin-left: 4px; }
.detail-level { font-size: 0.85rem; color: var(--color-text-secondary, #a0aec0); margin-top: 2px; }
.detail-stars { font-size: 0.85rem; color: var(--color-accent-yellow, #ffd700); }
.detail-types { display: flex; gap: 4px; margin-top: 4px; }
.detail-rarity { font-size: 0.8rem; font-weight: 700; margin-top: 4px; }

.detail-ivs { margin-bottom: 1rem; }

.iv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.iv-label { font-size: 0.7rem; font-weight: 700; width: 40px; color: var(--color-text-secondary, #a0aec0); }

.iv-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 3px;
  overflow: hidden;
}

.iv-bar {
  height: 100%;
  background: var(--color-accent-blue, #4fc3f7);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.iv-val { font-size: 0.7rem; width: 36px; text-align: right; color: var(--color-text-secondary, #a0aec0); }

/* ── Moves ──────────────────────────────────────────────────────────────── */
.detail-moves { margin-bottom: 1rem; }

.moves-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.moves-title { font-weight: 700; font-size: 0.9rem; }

.btn-edit-moves {
  font-size: 0.75rem;
  padding: 4px 10px;
  border: 1px solid var(--color-accent-blue, #4fc3f7);
  background: transparent;
  color: var(--color-accent-blue, #4fc3f7);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-edit-moves:hover { background: var(--color-accent-blue, #4fc3f7); color: #000; }

.move-list { display: flex; flex-direction: column; gap: 4px; }

.move-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.8rem;
}

.move-slot { font-weight: 700; color: var(--color-text-muted, #6b7a99); min-width: 12px; }
.move-type-badge { font-size: 0.6rem; padding: 1px 6px; border-radius: 999px; color: #fff; font-weight: 600; text-transform: capitalize; flex-shrink: 0; }
.move-name { flex: 1; font-weight: 600; }
.move-cat { font-size: 0.65rem; color: var(--color-text-muted, #6b7a99); }
.move-power { font-size: 0.75rem; min-width: 24px; text-align: right; }
.move-pp { font-size: 0.65rem; color: var(--color-text-muted, #6b7a99); min-width: 52px; text-align: right; }

/* ── Actions détail ─────────────────────────────────────────────────────── */
.detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.btn-primary, .btn-secondary {
  font-size: 0.8rem;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn-primary { background: var(--color-accent-blue, #4fc3f7); color: #000; }
.btn-secondary { background: var(--color-bg-tertiary, #2f3259); color: var(--color-text-primary, #f0f0f0); }
.btn-primary:hover, .btn-secondary:hover { opacity: 0.8; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Move modal ─────────────────────────────────────────────────────────── */
.pending-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: 1rem;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 10px;
  padding: 0.75rem;
}

@media (max-width: 480px) { .pending-slots { grid-template-columns: 1fr; } }

.pending-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--color-bg-secondary, #252742);
}

.slot-label { font-weight: 700; color: var(--color-text-muted, #6b7a99); min-width: 44px; }
.slot-move-name { flex: 1; }
.slot-empty-label { color: var(--color-text-muted, #6b7a99); font-style: italic; }

.btn-clear {
  font-size: 0.65rem;
  padding: 1px 5px;
  background: var(--color-accent-red, #e63946);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.available-moves { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }

.available-move {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.78rem;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.available-move.selected { border-color: var(--color-accent-blue, #4fc3f7); }

.move-assign-btns { display: flex; gap: 3px; margin-left: auto; }

.btn-assign {
  width: 22px;
  height: 22px;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--color-bg-tertiary, #2f3259);
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 4px;
  color: var(--color-text-secondary, #a0aec0);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-assign.active { background: var(--color-accent-blue, #4fc3f7); color: #000; border-color: var(--color-accent-blue, #4fc3f7); }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-bg-tertiary, #2f3259);
}

/* ── Bench list ─────────────────────────────────────────────────────────── */
.bench-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }

.bench-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.bench-item:hover { background: var(--color-bg-tertiary, #2f3259); }
.bench-sprite { width: 40px; height: 40px; object-fit: contain; image-rendering: pixelated; }
.bench-name { flex: 1; font-weight: 600; font-size: 0.85rem; }
.bench-level { font-size: 0.75rem; color: var(--color-text-secondary, #a0aec0); }
.bench-rarity { font-size: 0.75rem; font-weight: 700; }

/* ── Messages ─────────────────────────────────────────────────────────── */
.loading-msg, .empty-msg { color: var(--color-text-muted, #6b7a99); padding: 2rem; text-align: center; }
.error-msg { color: var(--color-accent-red, #e63946); padding: 0.75rem; font-size: 0.85rem; }
.no-moves { color: var(--color-text-muted, #6b7a99); font-size: 0.8rem; padding: 0.5rem 0; }
</style>
