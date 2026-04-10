<script setup lang="ts">
import { ref, onMounted, computed, useNuxtApp } from '#imports'
import { useShopStore, type ShopUpgrade } from '~/stores/shop'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const shop = useShopStore()
const auth = useAuthStore()
const nuxtApp = useNuxtApp()

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pension', label: 'Pension' },
  { key: 'combat', label: 'Combat' },
  { key: 'gacha', label: 'Gacha' },
  { key: 'cosmetic', label: 'Cosmétique' },
]
const active_tab = ref('pension')

const visible_upgrades = computed(() => shop.byCategory[active_tab.value] ?? [])

// ─── Modal confirmation ───────────────────────────────────────────────────────

const confirm_upgrade = ref<ShopUpgrade | null>(null)
const purchase_error = ref<string | null>(null)
const is_purchasing = ref(false)

function openConfirm(upgrade: ShopUpgrade) {
  if (upgrade.is_purchased || !upgrade.is_available) return
  confirm_upgrade.value = upgrade
  purchase_error.value = null
}

function closeConfirm() {
  confirm_upgrade.value = null
  purchase_error.value = null
}

async function confirmPurchase() {
  if (!confirm_upgrade.value) return
  is_purchasing.value = true
  purchase_error.value = null
  const result = await shop.purchaseUpgrade(confirm_upgrade.value.id)
  is_purchasing.value = false
  if (result.success) {
    confirm_upgrade.value = null
  } else {
    purchase_error.value = result.error ?? 'Erreur inconnue'
  }
}

// ─── Socket.io — gems:earned ─────────────────────────────────────────────────

onMounted(async () => {
  await shop.fetchShopState()

  const socket = (nuxtApp as any).$socket
  if (socket) {
    socket.on('gems:earned', (event: { amount: number }) => {
      shop.handleGemsEarned(event.amount)
    })
  }
})

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  pension: 'text-green-400',
  combat: 'text-red-400',
  gacha: 'text-purple-400',
  cosmetic: 'text-blue-400',
}

function upgradeCardClass(upgrade: ShopUpgrade): string {
  if (upgrade.is_purchased) return 'border-green-600 bg-gray-800 opacity-80'
  if (!upgrade.is_available) return 'border-gray-700 bg-gray-900 opacity-60 cursor-not-allowed'
  return 'border-yellow-600 bg-gray-800 hover:border-yellow-400 cursor-pointer'
}
</script>

<template>
  <div class="boutique-page">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="boutique-header">
      <div>
        <h1 class="font-display boutique-title">Boutique Gems</h1>
        <p class="boutique-note">100% Farm-only — Jamais de pay-to-win.</p>
      </div>
      <UiGemCounter :amount="shop.player_gems ?? auth.player?.gems ?? 0" size="lg" :animate="true" />
    </div>

    <!-- ── Category tabs ────────────────────────────────────────── -->
    <div class="tab-bar">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab-btn"
        :class="{ 'tab-active': active_tab === tab.key }"
        @click="active_tab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <!-- ── Loading ──────────────────────────────────────────────── -->
    <div v-if="shop.is_loading" class="loading-state">
      <div class="spinner" />Chargement…
    </div>

    <!-- ── Upgrades grid ────────────────────────────────────────── -->
    <div v-else class="upgrades-grid">
      <button
        v-for="upgrade in visible_upgrades"
        :key="upgrade.id"
        class="upgrade-card"
        :class="{
          'upgrade-purchased':   upgrade.is_purchased,
          'upgrade-locked':      !upgrade.is_available && !upgrade.is_purchased,
          'upgrade-available':   upgrade.is_available && !upgrade.is_purchased,
        }"
        :disabled="upgrade.is_purchased || !upgrade.is_available"
        @click="openConfirm(upgrade)"
      >
        <div class="upgrade-main">
          <div class="upgrade-info">
            <p class="upgrade-name">{{ upgrade.name_fr }}</p>
            <p class="upgrade-desc">{{ upgrade.description_fr }}</p>
            <p v-if="upgrade.requires_name_fr && !upgrade.is_available && !upgrade.is_purchased" class="upgrade-req">
              🔒 Nécessite : {{ upgrade.requires_name_fr }}
            </p>
          </div>
          <div class="upgrade-status">
            <span v-if="upgrade.is_purchased" class="status-check">✅</span>
            <span v-else-if="!upgrade.is_available" class="status-lock">🔒</span>
            <span v-else class="upgrade-price">{{ upgrade.cost_gems }} 💎</span>
          </div>
        </div>
      </button>

      <div v-if="visible_upgrades.length === 0" class="empty-category">
        Aucune amélioration dans cette catégorie.
      </div>
    </div>

    <!-- ── Purchase confirm modal ───────────────────────────────── -->
    <UiModal
      :open="!!confirm_upgrade"
      title="Confirmer l'achat"
      size="sm"
      @close="closeConfirm"
    >
      <div v-if="confirm_upgrade" class="confirm-body">
        <p class="confirm-name">{{ confirm_upgrade.name_fr }}</p>
        <p class="confirm-desc">{{ confirm_upgrade.description_fr }}</p>

        <div class="confirm-row">
          <span class="confirm-row-label">Coût</span>
          <span class="confirm-row-val" style="color: var(--color-accent-yellow)">
            {{ confirm_upgrade.cost_gems }} 💎
          </span>
        </div>
        <div class="confirm-row">
          <span class="confirm-row-label">Solde après achat</span>
          <span
            class="confirm-row-val"
            :style="{ color: (shop.player_gems - confirm_upgrade.cost_gems) >= 0 ? 'var(--type-grass)' : 'var(--color-accent-red)' }"
          >
            {{ (shop.player_gems - confirm_upgrade.cost_gems).toLocaleString('fr') }} 💎
          </span>
        </div>

        <p v-if="purchase_error" class="purchase-error">{{ purchase_error }}</p>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="closeConfirm">Annuler</button>
        <button
          class="btn-buy"
          :disabled="is_purchasing"
          @click="confirmPurchase"
        >{{ is_purchasing ? 'Achat…' : 'Acheter' }}</button>
      </template>
    </UiModal>

  </div>
</template>

<style scoped>
.boutique-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

/* ── Header ──────────────────────────────────────────────────────── */
.boutique-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.boutique-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
}

.boutique-note {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin-top: 2px;
}

/* ── Tabs ────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: var(--space-2);
}

.tab-btn {
  padding: 8px 18px;
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

/* ── Loading ─────────────────────────────────────────────────────── */
.loading-state { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* ── Upgrades ────────────────────────────────────────────────────── */
.upgrades-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.upgrade-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  text-align: left;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: var(--transition-base);
}

.upgrade-available:hover {
  border-color: rgba(255,215,0,0.4);
  box-shadow: 0 0 12px rgba(255,215,0,0.15);
  transform: translateY(-2px);
}

.upgrade-purchased {
  border-color: rgba(86,201,109,0.3);
  background: rgba(86,201,109,0.06);
  cursor: default;
  opacity: 0.85;
}

.upgrade-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.upgrade-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.upgrade-info { flex: 1; min-width: 0; }

.upgrade-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upgrade-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.5;
}

.upgrade-req {
  font-size: 0.72rem;
  color: #ffa94d;
  margin-top: 6px;
}

.upgrade-status { flex-shrink: 0; text-align: right; }

.status-check { font-size: 1.1rem; }
.status-lock  { font-size: 1rem; opacity: 0.4; }

.upgrade-price {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-accent-yellow);
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.empty-category {
  grid-column: 1 / -1;
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-style: italic;
}

/* ── Confirm modal ────────────────────────────────────────────────── */
.confirm-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

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
.confirm-row-label { font-size: 0.85rem; color: var(--color-text-secondary); }
.confirm-row-val   { font-size: 1rem; font-weight: 700; }

.purchase-error { font-size: 0.8rem; color: var(--color-accent-red); }

/* Buttons */
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
.btn-cancel:hover { background: rgba(255,255,255,0.12); color: var(--color-text-primary); }

.btn-buy {
  flex: 1;
  background: linear-gradient(135deg, #c49a00, #ffd700);
  color: #1a1c2e;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: var(--space-2) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-buy:hover:not(:disabled) { filter: brightness(1.1); }
.btn-buy:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .upgrades-grid { grid-template-columns: 1fr; }
  .boutique-header { flex-direction: column; align-items: flex-start; }
}
</style>
