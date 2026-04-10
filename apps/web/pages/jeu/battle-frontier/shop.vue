<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref, computed } from 'vue'
import { useBattleFrontierStore } from '@/stores/battleFrontier'
import { useInventoryStore } from '@/stores/inventory'

const store = useBattleFrontierStore()
const inventory = useInventoryStore()

const active_tab = ref<'ct_exclusive' | 'iv_capsule' | 'nature_mint'>('ct_exclusive')
const confirm_item = ref<any>(null)
const confirm_qty = ref(1)
const buying = ref(false)
const use_modal = ref(false)
const use_item = ref<any>(null)
const use_pokemon_id = ref('')
const using = ref(false)
const msg = ref('')
const msg_type = ref<'success' | 'error'>('success')

onMounted(async () => {
  await store.fetchShop()
  await inventory.fetchTeam()
})

const tabs = [
  { key: 'ct_exclusive' as const, label: '⚡ CTs Exclusives' },
  { key: 'iv_capsule'   as const, label: '📊 Capsules IV'   },
  { key: 'nature_mint'  as const, label: '🌿 Menthes'       },
]

const filtered_items = computed(() =>
  store.shop_items.filter((i: any) => i.item_type === active_tab.value)
)

const my_usables = computed(() =>
  store.my_purchases.filter((p: any) => p.item_type === active_tab.value)
)

function openConfirm(item: any) {
  confirm_item.value = item
  confirm_qty.value = 1
}

async function doPurchase() {
  if (!confirm_item.value) return
  buying.value = true
  try {
    await store.purchaseItem(confirm_item.value.id, confirm_qty.value)
    showMsg(`${confirm_item.value.name_fr} acheté !`, 'success')
    confirm_item.value = null
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  } finally {
    buying.value = false
  }
}

function openUse(purchase: any) {
  use_item.value = purchase
  use_pokemon_id.value = ''
  use_modal.value = true
}

async function doUse() {
  if (!use_item.value || !use_pokemon_id.value) return
  using.value = true
  try {
    if (use_item.value.item_type === 'iv_capsule') {
      const stat = use_item.value.item_data?.stat
      await store.useIvCapsule(use_pokemon_id.value, stat)
      showMsg(`IV ${stat?.toUpperCase()} monté à 31 !`, 'success')
    } else if (use_item.value.item_type === 'nature_mint') {
      const nature = use_item.value.item_data?.nature
      await store.useNatureMint(use_pokemon_id.value, nature)
      showMsg(`Nature override appliquée : ${nature} !`, 'success')
    }
    use_modal.value = false
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  } finally {
    using.value = false
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value = text
  msg_type.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}

function canAfford(item: any): boolean {
  return store.my_pf >= item.cost_pf
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/jeu/battle-frontier" class="text-gray-400 hover:text-white">← Retour</NuxtLink>
      <h1 class="text-2xl font-bold text-white">💠 Shop Battle Frontier</h1>
      <span class="ml-auto text-yellow-400 font-bold">{{ store.my_pf.toLocaleString('fr-FR') }} PF</span>
    </div>

    <!-- Message -->
    <div v-if="msg" class="rounded-lg px-4 py-2 mb-4 text-sm font-medium"
      :class="msg_type === 'success' ? 'bg-green-900/40 border border-green-600 text-green-300' : 'bg-red-900/40 border border-red-600 text-red-300'">
      {{ msg }}
    </div>

    <!-- Onglets -->
    <div class="flex gap-2 mb-5">
      <button
        v-for="tab in tabs" :key="tab.key"
        @click="active_tab = tab.key"
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="active_tab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
      >{{ tab.label }}</button>
    </div>

    <!-- Items à acheter -->
    <div class="space-y-3 mb-6">
      <div
        v-for="item in filtered_items"
        :key="item.id"
        class="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
      >
        <div class="flex-1 mr-3">
          <p class="font-bold text-white">{{ item.name_fr }}</p>
          <p v-if="item.description_fr" class="text-xs text-gray-400 mt-0.5">{{ item.description_fr }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-yellow-400 font-bold">{{ item.cost_pf }} PF</span>
          <button
            @click="openConfirm(item)"
            :disabled="!canAfford(item)"
            class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
            :class="canAfford(item) ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
          >Acheter</button>
        </div>
      </div>
      <div v-if="filtered_items.length === 0" class="text-center text-gray-400 py-6">
        Aucun item disponible.
      </div>
    </div>

    <!-- Items disponibles à utiliser -->
    <template v-if="my_usables.length > 0">
      <h3 class="text-base font-bold text-gray-200 mb-3">À utiliser ({{ my_usables.length }})</h3>
      <div class="space-y-2">
        <div
          v-for="(purchase, i) in my_usables"
          :key="i"
          class="bg-gray-800 border border-green-800 rounded-xl p-3 flex items-center justify-between"
        >
          <div>
            <p class="font-medium text-white">{{ purchase.name_fr }}</p>
            <p class="text-xs text-gray-400">× {{ purchase.qty }} disponible(s)</p>
          </div>
          <button @click="openUse(purchase)"
            class="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-bold">
            Utiliser
          </button>
        </div>
      </div>
    </template>

    <!-- Modal confirmation achat -->
    <div v-if="confirm_item" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
        <h3 class="text-xl font-bold text-white mb-2">{{ confirm_item.name_fr }}</h3>
        <p class="text-gray-400 text-sm mb-4">{{ confirm_item.description_fr }}</p>

        <div class="flex items-center gap-3 mb-4">
          <label class="text-gray-300 text-sm">Quantité :</label>
          <input v-model.number="confirm_qty" type="number" min="1" max="99"
            class="w-16 bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-center" />
          <span class="text-yellow-400 font-bold">= {{ confirm_item.cost_pf * confirm_qty }} PF</span>
        </div>

        <div class="flex gap-3">
          <button @click="doPurchase" :disabled="buying"
            class="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold">
            {{ buying ? '…' : 'Confirmer' }}
          </button>
          <button @click="confirm_item = null"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Modal utilisation item -->
    <div v-if="use_modal && use_item" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
        <h3 class="text-xl font-bold text-white mb-2">Utiliser {{ use_item.name_fr }}</h3>
        <p class="text-gray-400 text-sm mb-4">Choisir un Pokémon de ton équipe :</p>

        <div class="space-y-2 mb-4">
          <div v-if="inventory.team.length === 0" class="text-gray-400 text-sm">Équipe vide.</div>
          <button
            v-for="p in inventory.team"
            :key="p.id"
            @click="use_pokemon_id = p.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors"
            :class="use_pokemon_id === p.id ? 'bg-blue-900 border-blue-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'"
          >
            <img v-if="p.sprite_url" :src="p.sprite_url" :alt="p.name_fr" class="w-8 h-8 object-contain" />
            <span class="font-medium text-white">{{ p.name_fr }}</span>
            <span class="text-gray-400 text-xs ml-auto">Niv. {{ p.level }}</span>
          </button>
        </div>

        <div class="flex gap-3">
          <button @click="doUse" :disabled="using || !use_pokemon_id"
            class="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold disabled:opacity-50">
            {{ using ? '…' : 'Appliquer' }}
          </button>
          <button @click="use_modal = false"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
            Annuler
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
