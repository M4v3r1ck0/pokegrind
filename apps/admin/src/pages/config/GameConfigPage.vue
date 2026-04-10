<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const config = ref<any[]>([])
const is_loading = ref(false)
const edit_key = ref<string | null>(null)
const edit_value = ref<string>('')
const action_loading = ref<string | null>(null)
const message = ref<string | null>(null)

async function fetchConfig() {
  is_loading.value = true
  try {
    const res = await api.getConfig()
    config.value = res.data?.data ?? []
  } finally {
    is_loading.value = false
  }
}

function startEdit(item: any) {
  edit_key.value = item.key
  edit_value.value = JSON.stringify(item.value)
}

function cancelEdit() {
  edit_key.value = null
  edit_value.value = ''
}

async function saveEdit(key: string) {
  action_loading.value = key
  try {
    let parsed: unknown
    try {
      parsed = JSON.parse(edit_value.value)
    } catch {
      message.value = 'Valeur JSON invalide'
      return
    }
    await api.setConfig(key, parsed)
    message.value = `Clé "${key}" mise à jour`
    edit_key.value = null
    await fetchConfig()
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    action_loading.value = null
    setTimeout(() => { message.value = null }, 4000)
  }
}

async function resetKey(key: string) {
  if (!confirm(`Réinitialiser "${key}" à sa valeur par défaut ?`)) return
  action_loading.value = key
  try {
    await api.resetConfig(key)
    message.value = `Clé "${key}" réinitialisée`
    await fetchConfig()
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    action_loading.value = null
    setTimeout(() => { message.value = null }, 4000)
  }
}

// Grouper par préfixe (combat, gacha, daycare, ...)
const grouped = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const item of config.value) {
    const prefix = item.key.split('.')[0]
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(item)
  }
  return groups
})

const GROUP_LABELS: Record<string, string> = {
  combat: 'Combat',
  gacha: 'Gacha',
  daycare: 'Pension',
  raid: 'Raids',
  pvp: 'PvP',
  economy: 'Économie',
  system: 'Système',
}

onMounted(fetchConfig)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Configuration du jeu</h1>
      <button @click="fetchConfig" :disabled="is_loading" class="btn btn-sm">
        {{ is_loading ? 'Chargement…' : 'Actualiser' }}
      </button>
    </div>

    <div v-if="message" class="alert" :class="message.startsWith('Erreur') ? 'alert-error' : 'alert-success'">
      {{ message }}
    </div>

    <div class="alert alert-warning text-sm">
      Les modifications sont appliquées immédiatement après confirmation. Le cache Redis est invalidé automatiquement.
    </div>

    <div v-if="is_loading && config.length === 0" class="text-center py-12 opacity-60">Chargement…</div>

    <div v-for="(items, prefix) in grouped" :key="prefix" class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">{{ GROUP_LABELS[prefix] ?? prefix }}</h2>
        <table class="table table-sm w-full mt-2">
          <thead>
            <tr>
              <th class="w-56">Clé</th>
              <th>Description</th>
              <th class="w-40">Valeur</th>
              <th class="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.key">
              <td class="font-mono text-xs">{{ item.key }}</td>
              <td class="text-sm opacity-80">{{ item.description_fr }}</td>
              <td>
                <!-- Mode édition -->
                <template v-if="edit_key === item.key">
                  <input
                    v-model="edit_value"
                    class="input input-xs input-bordered w-full font-mono"
                    @keyup.enter="saveEdit(item.key)"
                    @keyup.escape="cancelEdit"
                    autofocus
                  />
                </template>
                <!-- Mode affichage -->
                <template v-else>
                  <span class="font-mono text-sm">
                    {{ typeof item.value === 'boolean'
                        ? (item.value ? 'true' : 'false')
                        : item.value
                    }}
                  </span>
                </template>
              </td>
              <td>
                <template v-if="edit_key === item.key">
                  <div class="flex gap-1">
                    <button
                      class="btn btn-xs btn-success"
                      :disabled="action_loading === item.key"
                      @click="saveEdit(item.key)"
                    >Sauvegarder</button>
                    <button class="btn btn-xs btn-ghost" @click="cancelEdit">Annuler</button>
                  </div>
                </template>
                <template v-else>
                  <div class="flex gap-1">
                    <button class="btn btn-xs btn-info" @click="startEdit(item)">Modifier</button>
                    <button
                      class="btn btn-xs btn-ghost"
                      :disabled="action_loading === item.key"
                      @click="resetKey(item.key)"
                    >Reset</button>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
