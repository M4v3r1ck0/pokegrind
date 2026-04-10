<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref, computed } from 'vue'
import { useItemsStore } from '@/stores/items'
import { useAuthStore } from '@/stores/auth'

const store = useItemsStore()
const auth  = useAuthStore()

const qty_map    = ref<Record<number, number>>({})
const msg        = ref('')
const msg_type   = ref<'success' | 'error'>('success')
const confirm_item = ref<any>(null)

onMounted(async () => {
  await store.fetchGoldShop()
})

function getQty(item_id: number): number {
  return qty_map.value[item_id] ?? 1
}

function setQty(item_id: number, val: number) {
  qty_map.value[item_id] = Math.max(1, Math.min(99, val))
}

function openConfirm(item: any) {
  confirm_item.value = item
}

async function purchase() {
  if (!confirm_item.value) return
  const qty = getQty(confirm_item.value.item_id)
  try {
    const result: any = await store.purchaseFromGoldShop(confirm_item.value.item_id, qty)
    confirm_item.value = null
    showMsg(`Achat réussi ! −${result.gold_spent.toLocaleString('fr-FR')} or`, 'success')
    await auth.fetchMe()
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? "Erreur lors de l'achat", 'error')
    confirm_item.value = null
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value      = text
  msg_type.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}

const rotation_countdown = computed(() => {
  if (!store.gold_shop) return ''
  const secs = store.gold_shop.rotation_resets_in_seconds
  const hours = Math.floor(secs / 3600)
  const mins  = Math.floor((secs % 3600) / 60)
  return `${hours}h ${mins}m`
})

const RARITY_COLORS: Record<string, string> = {
  common:   'text-gray-400',
  uncommon: 'text-green-400',
  rare:     'text-blue-400',
  epic:     'text-purple-400',
  legendary:'text-yellow-400',
}
</script>

<template>
  <div class="boutique-or-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="bor-header">
      <div>
        <h1 class="font-display bor-title">Boutique Or</h1>
        <p class="bor-sub">Dépensez votre or pour acquérir des items puissants.</p>
      </div>
      <div class="gold-chip">
        <span class="gold-icon">🪙</span>
        <span class="gold-amount">{{ (auth.player?.gold ?? 0).toLocaleString('fr-FR') }}</span>
      </div>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="msg" class="toast-inline" :class="msg_type === 'success' ? 'toast-success' : 'toast-error'">
        {{ msg }}
      </div>
    </Transition>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="store.is_loading" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <template v-else-if="store.gold_shop">

      <!-- ── Permanent shop ────────────────────────────────────── -->
      <section class="shop-section">
        <h2 class="font-display section-title">Permanent</h2>
        <div class="items-grid">
          <div
            v-for="item in store.gold_shop.permanent"
            :key="item.item_id"
            class="shop-card"
            :class="`rarity-${item.rarity}`"
          >
            <div class="shop-icon-wrap">
              <img
                v-if="item.sprite_url"
                :src="item.sprite_url"
                :alt="item.name_fr"
                class="shop-sprite"
                loading="lazy"
              />
              <span v-else class="shop-icon-fallback">🎒</span>
            </div>
            <div class="shop-info">
              <p class="shop-name">{{ item.name_fr }}</p>
              <UiRarityBadge :rarity="item.rarity" size="xs" />
              <p class="shop-desc">{{ item.description_fr }}</p>
            </div>
            <div class="shop-footer">
              <div class="qty-control">
                <button class="qty-btn" @click="setQty(item.item_id, getQty(item.item_id) - 1)">−</button>
                <span class="qty-val">{{ getQty(item.item_id) }}</span>
                <button class="qty-btn" @click="setQty(item.item_id, getQty(item.item_id) + 1)">+</button>
              </div>
              <button class="btn-buy-gold" @click="openConfirm(item)">
                {{ (item.price_gold * getQty(item.item_id)).toLocaleString('fr-FR') }} 🪙
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Weekly rotation ──────────────────────────────────── -->
      <section class="shop-section">
        <div class="rotation-head">
          <h2 class="font-display section-title">Rotation Hebdomadaire</h2>
          <div class="countdown-chip">
            <span class="countdown-icon">⏱️</span>
            <span class="countdown-text">Rotation dans {{ rotation_countdown }}</span>
          </div>
        </div>
        <div class="items-grid">
          <div
            v-for="item in store.gold_shop.weekly_rotation"
            :key="item.item_id"
            class="shop-card shop-card-rotation"
            :class="`rarity-${item.rarity}`"
          >
            <div class="shop-icon-wrap">
              <img
                v-if="item.sprite_url"
                :src="item.sprite_url"
                :alt="item.name_fr"
                class="shop-sprite"
                loading="lazy"
              />
              <span v-else class="shop-icon-fallback">🎒</span>
            </div>
            <div class="shop-info">
              <p class="shop-name">{{ item.name_fr }}</p>
              <UiRarityBadge :rarity="item.rarity" size="xs" />
              <p class="shop-desc">{{ item.description_fr }}</p>
            </div>
            <div class="shop-footer">
              <div class="qty-control">
                <button class="qty-btn" @click="setQty(item.item_id, getQty(item.item_id) - 1)">−</button>
                <span class="qty-val">{{ getQty(item.item_id) }}</span>
                <button class="qty-btn" @click="setQty(item.item_id, getQty(item.item_id) + 1)">+</button>
              </div>
              <button class="btn-buy-gold" @click="openConfirm(item)">
                {{ (item.price_gold * getQty(item.item_id)).toLocaleString('fr-FR') }} 🪙
              </button>
            </div>
          </div>
        </div>

        <div v-if="!store.gold_shop.weekly_rotation?.length" class="state-empty">
          Aucun item en rotation cette semaine.
        </div>
      </section>

    </template>

    <!-- ── Confirm modal ─────────────────────────────────────── -->
    <UiModal
      :open="!!confirm_item"
      title="Confirmer l'achat"
      size="sm"
      @close="confirm_item = null"
    >
      <div v-if="confirm_item" class="confirm-body">
        <p class="confirm-name">{{ confirm_item.name_fr }}</p>
        <p class="confirm-desc">{{ confirm_item.description_fr }}</p>
        <div class="confirm-row">
          <span class="confirm-label">Quantité</span>
          <span class="confirm-val">×{{ getQty(confirm_item.item_id) }}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Coût total</span>
          <span class="confirm-val gold-text">
            {{ (confirm_item.price_gold * getQty(confirm_item.item_id)).toLocaleString('fr-FR') }} 🪙
          </span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Solde après achat</span>
          <span
            class="confirm-val"
            :style="{
              color: (auth.player?.gold ?? 0) - confirm_item.price_gold * getQty(confirm_item.item_id) >= 0
                ? 'var(--type-grass)'
                : 'var(--color-accent-red)'
            }"
          >
            {{ ((auth.player?.gold ?? 0) - confirm_item.price_gold * getQty(confirm_item.item_id)).toLocaleString('fr-FR') }} 🪙
          </span>
        </div>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="confirm_item = null">Annuler</button>
        <button class="btn-confirm" @click="purchase">Acheter</button>
      </template>
    </UiModal>

  </div>
</template>

<style scoped>
.boutique-or-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.bor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.bor-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: var(--color-text-primary);
  letter-spacing: 0.05em;
}
.bor-sub { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

.gold-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-4);
}
.gold-icon { font-size: 1.1rem; }
.gold-amount {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--color-accent-yellow);
  letter-spacing: 0.02em;
}

/* Sections */
.shop-section { display: flex; flex-direction: column; gap: var(--space-4); }
.section-title {
  font-size: 1.3rem;
  color: var(--color-text-primary);
  letter-spacing: 0.04em;
}
.rotation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.countdown-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.25);
  border-radius: var(--radius-full);
  padding: 4px 12px;
}
.countdown-icon { font-size: 0.85rem; }
.countdown-text { font-size: 0.78rem; color: var(--color-accent-blue); font-weight: 700; }

/* Items grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.shop-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: var(--transition-base);
}
.shop-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.shop-card-rotation { border-style: dashed; }

.rarity-uncommon { border-color: rgba(86,201,109,0.25); }
.rarity-rare      { border-color: rgba(79,195,247,0.3); }
.rarity-epic      { border-color: rgba(198,120,221,0.35); box-shadow: 0 0 12px rgba(198,120,221,0.1); }
.rarity-legendary { border-color: rgba(255,215,0,0.4); box-shadow: 0 0 16px rgba(255,215,0,0.15); }

.shop-icon-wrap { display: flex; align-items: center; justify-content: center; height: 56px; }
.shop-sprite { width: 48px; height: 48px; image-rendering: pixelated; }
.shop-icon-fallback { font-size: 2rem; }

.shop-info { flex: 1; min-width: 0; }
.shop-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}
.shop-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-top: var(--space-1);
}

.shop-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-md);
  padding: 2px;
}
.qty-btn {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: var(--transition-fast);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qty-btn:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }
.qty-val { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); min-width: 20px; text-align: center; }

.btn-buy-gold {
  background: linear-gradient(135deg, #8a6a00, #c49a00);
  color: #fff8dc;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.8rem;
  padding: 6px 12px;
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.btn-buy-gold:hover { filter: brightness(1.15); transform: scale(1.02); }

/* Confirm modal */
.confirm-body { display: flex; flex-direction: column; gap: var(--space-3); }
.confirm-name { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); }
.confirm-desc { font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5; }
.confirm-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.confirm-label { font-size: 0.85rem; color: var(--color-text-secondary); }
.confirm-val   { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); }
.gold-text     { color: var(--color-accent-yellow); }

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
.btn-confirm {
  flex: 1;
  background: linear-gradient(135deg, #8a6a00, #c49a00);
  color: #fff8dc;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: var(--space-2) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-confirm:hover { filter: brightness(1.1); }

/* Toast */
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
  padding: var(--space-6);
  color: var(--color-text-muted);
  font-style: italic;
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,215,0,0.3);
  border-top-color: var(--color-accent-yellow);
  border-radius: 50%;
  animation: spin-slow 0.8s linear infinite;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 600px) {
  .bor-header { flex-direction: column; align-items: flex-start; }
  .items-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 400px) {
  .items-grid { grid-template-columns: 1fr; }
}
</style>
