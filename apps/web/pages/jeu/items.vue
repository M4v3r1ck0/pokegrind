<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref, computed } from 'vue'
import { useItemsStore } from '@/stores/items'
import { useInventoryStore } from '@/stores/inventory'

const store    = useItemsStore()
const inv      = useInventoryStore()

const tab           = ref<'tous' | 'offensive' | 'defensive' | 'utility' | 'passive'>('tous')
const equip_modal   = ref(false)
const selected_item = ref<any>(null)
const msg           = ref('')
const msg_type      = ref<'success' | 'error'>('success')

onMounted(async () => {
  await Promise.all([store.fetchInventory(), inv.fetchTeam()])
})

const tabs = [
  { key: 'tous',      label: 'Tous' },
  { key: 'offensive', label: 'Offensif' },
  { key: 'defensive', label: 'Défensif' },
  { key: 'utility',   label: 'Utilitaire' },
  { key: 'passive',   label: 'Passif' },
]

const filtered_items = computed(() => {
  if (tab.value === 'tous') return store.inventory
  return store.inventory.filter(i => i.category === tab.value)
})

const RARITY_COLORS: Record<string, string> = {
  common:   'text-gray-400',
  uncommon: 'text-green-400',
  rare:     'text-blue-400',
  epic:     'text-purple-400',
  legendary:'text-yellow-400',
}

const RARITY_LABELS: Record<string, string> = {
  common:   'Commun',
  uncommon: 'Peu commun',
  rare:     'Rare',
  epic:     'Épique',
  legendary:'Légendaire',
}

function openEquipModal(item: any) {
  selected_item.value = item
  equip_modal.value = true
}

async function equipOn(pokemon_id: string) {
  if (!selected_item.value) return
  try {
    await store.equipItem(pokemon_id, selected_item.value.item_id)
    equip_modal.value = false
    showMsg(`${selected_item.value.name_fr} équipé !`, 'success')
    await inv.fetchTeam()
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  }
}

async function unequip(pokemon_id: string) {
  try {
    await store.unequipItem(pokemon_id)
    showMsg('Item retiré', 'success')
    await inv.fetchTeam()
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value      = text
  msg_type.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}
</script>

<template>
  <div class="items-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="items-header">
      <div>
        <h1 class="font-display items-title">Inventaire Items</h1>
        <p class="items-sub">{{ store.inventory.length }} items en votre possession</p>
      </div>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="msg" class="toast-inline" :class="msg_type === 'success' ? 'toast-success' : 'toast-error'">
        {{ msg }}
      </div>
    </Transition>

    <!-- ── Tabs ───────────────────────────────────────────────── -->
    <div class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab-btn"
        :class="{ 'tab-active': tab === t.key }"
        @click="tab = t.key as any"
      >{{ t.label }}</button>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="store.is_loading" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <!-- ── Items grid ─────────────────────────────────────────── -->
    <div v-else-if="filtered_items.length > 0" class="items-grid">
      <div
        v-for="item in filtered_items"
        :key="item.item_id"
        class="item-card"
        :class="`rarity-${item.rarity}`"
      >
        <div class="item-icon-wrap">
          <img
            v-if="item.sprite_url"
            :src="item.sprite_url"
            :alt="item.name_fr"
            class="item-sprite"
            loading="lazy"
          />
          <span v-else class="item-icon-fallback">🎒</span>
        </div>
        <div class="item-info">
          <p class="item-name">{{ item.name_fr }}</p>
          <UiRarityBadge :rarity="item.rarity" size="xs" />
          <p class="item-desc">{{ item.description_fr }}</p>
        </div>
        <div class="item-footer">
          <span class="item-qty">×{{ item.quantity }}</span>
          <button class="btn-equip" @click="openEquipModal(item)">Équiper</button>
        </div>
      </div>
    </div>

    <div v-else class="state-empty">
      Aucun item dans cette catégorie.
    </div>

    <!-- ── Equip modal ────────────────────────────────────────── -->
    <UiModal
      :open="equip_modal"
      :title="`Équiper — ${selected_item?.name_fr ?? ''}`"
      size="sm"
      @close="equip_modal = false"
    >
      <div v-if="selected_item" class="equip-body">
        <p class="equip-desc">{{ selected_item.description_fr }}</p>
        <p class="equip-label">Choisir un Pokémon :</p>
        <div class="team-list">
          <div
            v-for="pk in inv.team"
            :key="pk.id"
            class="team-row"
          >
            <img
              :src="pk.species.sprite_url"
              :alt="pk.species.name_fr"
              class="team-sprite"
              loading="lazy"
              @error="($event.target as HTMLImageElement).src = pk.species.sprite_fallback_url"
            />
            <div class="team-info">
              <p class="team-name">{{ pk.nickname ?? pk.species.name_fr }}</p>
              <p class="team-item">
                <span v-if="pk.equipped_item">{{ pk.equipped_item.name_fr }}</span>
                <span v-else class="no-item">Aucun item</span>
              </p>
            </div>
            <div class="team-actions">
              <button class="btn-assign" @click="equipOn(pk.id)">Équiper</button>
              <button v-if="pk.equipped_item" class="btn-unequip" @click="unequip(pk.id)">Retirer</button>
            </div>
          </div>
        </div>
      </div>
    </UiModal>

  </div>
</template>

<style scoped>
.items-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.items-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: var(--color-text-primary);
  letter-spacing: 0.05em;
}
.items-sub { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

/* Tabs */
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: var(--space-2);
  flex-wrap: wrap;
}
.tab-btn {
  padding: 8px 16px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: transparent;
  border: none;
  font-family: var(--font-primary);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}
.tab-btn:hover { color: var(--color-text-primary); background: rgba(255,255,255,0.05); }
.tab-active {
  background: rgba(156,106,222,0.12);
  color: #b894f5;
  box-shadow: inset 0 -2px 0 var(--color-accent-purple);
}

/* Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.item-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: var(--transition-base);
}
.item-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

.rarity-uncommon { border-color: rgba(86,201,109,0.25); }
.rarity-rare      { border-color: rgba(79,195,247,0.3); }
.rarity-epic      { border-color: rgba(198,120,221,0.35); box-shadow: 0 0 12px rgba(198,120,221,0.1); }
.rarity-legendary { border-color: rgba(255,215,0,0.4); box-shadow: 0 0 16px rgba(255,215,0,0.15); }

.item-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
}
.item-sprite { width: 48px; height: 48px; image-rendering: pixelated; }
.item-icon-fallback { font-size: 2rem; }

.item-info { flex: 1; min-width: 0; }
.item-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}
.item-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-top: var(--space-1);
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.item-qty {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--color-text-secondary);
}
.btn-equip {
  background: linear-gradient(135deg, rgba(156,106,222,0.3), rgba(156,106,222,0.15));
  border: 1px solid rgba(156,106,222,0.5);
  border-radius: var(--radius-md);
  color: #b894f5;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.8rem;
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-equip:hover { background: rgba(156,106,222,0.3); transform: scale(1.02); }

/* Equip modal */
.equip-body { display: flex; flex-direction: column; gap: var(--space-3); }
.equip-desc { font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5; }
.equip-label { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); }

.team-list { display: flex; flex-direction: column; gap: var(--space-2); }
.team-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}
.team-sprite { width: 40px; height: 40px; image-rendering: pixelated; flex-shrink: 0; }
.team-info { flex: 1; min-width: 0; }
.team-name { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); }
.team-item { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 2px; }
.no-item   { font-style: italic; }

.team-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
.btn-assign {
  background: rgba(255,215,0,0.12);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: var(--radius-md);
  color: var(--color-accent-yellow);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-primary);
  padding: 4px 10px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-assign:hover { background: rgba(255,215,0,0.2); }
.btn-unequip {
  background: rgba(230,57,70,0.12);
  border: 1px solid rgba(230,57,70,0.3);
  border-radius: var(--radius-md);
  color: var(--color-accent-red);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-primary);
  padding: 4px 10px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-unequip:hover { background: rgba(230,57,70,0.2); }

/* Toast inline */
.toast-inline {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 700;
}
.toast-success { background: rgba(86,201,109,0.15); border: 1px solid rgba(86,201,109,0.35); color: #56c96d; }
.toast-error   { background: rgba(230,57,70,0.15); border: 1px solid rgba(230,57,70,0.35); color: var(--color-accent-red); }

/* States */
.state-loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  padding: var(--space-6);
}
.state-empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-style: italic;
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(156,106,222,0.3);
  border-top-color: var(--color-accent-purple);
  border-radius: 50%;
  animation: spin-slow 0.8s linear infinite;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 600px) {
  .items-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 400px) {
  .items-grid { grid-template-columns: 1fr; }
}
</style>
