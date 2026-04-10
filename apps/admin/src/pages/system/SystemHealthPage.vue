<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const health = ref<any>(null)
const sessions = ref<any>(null)
const is_loading = ref(false)
const flush_pattern = ref('game_config:*')
const flush_loading = ref(false)
const flush_message = ref<string | null>(null)

let interval: ReturnType<typeof setInterval> | null = null

async function fetchHealth() {
  is_loading.value = true
  try {
    const [h, s] = await Promise.all([api.getSystemHealth(), api.getActiveSessions()])
    health.value = h.data?.data ?? null
    sessions.value = s.data?.data ?? null
  } finally {
    is_loading.value = false
  }
}

async function flushCache() {
  flush_loading.value = true
  try {
    const res = await api.flushCache(flush_pattern.value)
    const count = res.data?.deleted_count
    flush_message.value = count === -1
      ? 'Cache Redis entier vidé.'
      : `${count} clé(s) Redis supprimée(s).`
  } catch (err: any) {
    flush_message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    flush_loading.value = false
    setTimeout(() => { flush_message.value = null }, 5000)
  }
}

function statusBadge(s: string) {
  if (s === 'healthy') return 'badge-success'
  if (s === 'degraded') return 'badge-warning'
  return 'badge-error'
}

function uptimeLabel(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}min`
}

onMounted(async () => {
  await fetchHealth()
  interval = setInterval(fetchHealth, 30_000)
})
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Santé du système</h1>
      <button @click="fetchHealth" :disabled="is_loading" class="btn btn-sm">
        {{ is_loading ? 'Actualisation…' : 'Actualiser' }}
      </button>
    </div>

    <div v-if="!health && is_loading" class="text-center py-12 opacity-60">Chargement…</div>

    <template v-if="health">
      <!-- API -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">API Node.js</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div class="stat-card">
              <div class="stat-label">Uptime</div>
              <div class="stat-value text-green-400">{{ uptimeLabel(health.api.uptime_seconds) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">RAM utilisée</div>
              <div class="stat-value">{{ health.api.memory_used_mb }} / {{ health.api.memory_total_mb }} Mo</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">CPU (load avg)</div>
              <div class="stat-value">{{ health.api.cpu_usage_percent }}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Node.js</div>
              <div class="stat-value text-sm font-mono">{{ health.api.node_version }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Base de données -->
      <div class="card bg-base-200">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <h2 class="card-title">Base de données PostgreSQL</h2>
            <span class="badge" :class="statusBadge(health.database.status)">{{ health.database.status }}</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            <div class="stat-card">
              <div class="stat-label">Temps moyen requête</div>
              <div class="stat-value" :class="health.database.avg_query_time_ms > 50 ? 'text-warning' : 'text-green-400'">
                {{ health.database.avg_query_time_ms }} ms
              </div>
            </div>
          </div>
          <!-- Tables les plus volumineuses -->
          <div v-if="health.database.largest_tables?.length" class="mt-4">
            <p class="text-sm font-semibold mb-2">Tables les plus volumineuses</p>
            <table class="table table-xs w-full">
              <thead><tr><th>Table</th><th>Lignes</th><th>Taille</th></tr></thead>
              <tbody>
                <tr v-for="t in health.database.largest_tables" :key="t.table_name">
                  <td class="font-mono text-xs">{{ t.table_name }}</td>
                  <td>{{ t.row_count.toLocaleString('fr') }}</td>
                  <td>{{ t.size_mb }} Mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Redis -->
      <div class="card bg-base-200">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <h2 class="card-title">Redis</h2>
            <span class="badge" :class="statusBadge(health.redis.status)">{{ health.redis.status }}</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div class="stat-card">
              <div class="stat-label">RAM utilisée</div>
              <div class="stat-value">{{ health.redis.memory_used_mb }} Mo</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Hit rate</div>
              <div class="stat-value" :class="health.redis.hit_rate_percent > 70 ? 'text-green-400' : 'text-warning'">
                {{ health.redis.hit_rate_percent }}%
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Clients connectés</div>
              <div class="stat-value">{{ health.redis.connected_clients }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Raids actifs (clés)</div>
              <div class="stat-value">{{ health.redis.active_raid_keys }}</div>
            </div>
          </div>

          <!-- Flush cache -->
          <div class="mt-4 flex gap-3 items-end flex-wrap">
            <div>
              <label class="text-xs opacity-70 block mb-1">Pattern Redis à vider</label>
              <select v-model="flush_pattern" class="select select-sm select-bordered">
                <option value="game_config:*">game_config:*</option>
                <option value="raid:*">raid:*</option>
                <option value="bf_leaderboard:*">bf_leaderboard:*</option>
                <option value="upgrade:*">upgrade:*</option>
              </select>
            </div>
            <button class="btn btn-sm btn-warning" :disabled="flush_loading" @click="flushCache">
              {{ flush_loading ? 'Vidage…' : 'Vider le cache' }}
            </button>
            <span v-if="flush_message" class="text-sm" :class="flush_message.startsWith('Erreur') ? 'text-error' : 'text-success'">
              {{ flush_message }}
            </span>
          </div>
        </div>
      </div>

      <!-- WebSocket + Jeu -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">WebSocket</h2>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <div class="stat-card">
                <div class="stat-label">Clients connectés</div>
                <div class="stat-value">{{ health.websocket.connected_clients }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Sessions combat</div>
                <div class="stat-value">{{ health.websocket.active_combat_sessions }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Sessions Tour</div>
                <div class="stat-value">{{ health.websocket.active_tower_sessions }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Rooms actives</div>
                <div class="stat-value">{{ health.websocket.active_rooms }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">État du jeu</h2>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <div class="stat-card">
                <div class="stat-label">Joueurs en ligne</div>
                <div class="stat-value text-green-400">{{ health.game.players_online_now }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Raids actifs</div>
                <div class="stat-value">{{ health.game.active_raids }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Donjons en cours</div>
                <div class="stat-value">{{ health.game.active_dungeon_runs }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Maintenance</div>
                <div class="stat-value" :class="health.game.maintenance_mode ? 'text-error' : 'text-green-400'">
                  {{ health.game.maintenance_mode ? 'Active' : 'Désactivée' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Jobs BullMQ -->
      <div v-if="health.jobs.bullmq_queues.length > 0" class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Files BullMQ</h2>
          <table class="table table-sm w-full mt-2">
            <thead>
              <tr><th>Queue</th><th>En attente</th><th>Actif</th><th>Complétés</th><th>Échoués</th></tr>
            </thead>
            <tbody>
              <tr v-for="q in health.jobs.bullmq_queues" :key="q.name">
                <td class="font-mono">{{ q.name }}</td>
                <td>{{ q.waiting }}</td>
                <td>{{ q.active }}</td>
                <td class="text-green-400">{{ q.completed }}</td>
                <td :class="q.failed > 0 ? 'text-error font-bold' : ''">{{ q.failed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sessions actives -->
      <div v-if="sessions" class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Sessions de jeu actives</h2>
          <div class="tabs tabs-bordered mt-2">
            <a class="tab tab-active">Combat idle ({{ sessions.combat_idle.length }})</a>
            <a class="tab">Donjons ({{ sessions.dungeon_runs.length }})</a>
          </div>
          <table class="table table-xs w-full mt-2">
            <thead>
              <tr><th>Joueur</th><th>Étage</th><th>Dernière activité</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions.combat_idle.slice(0, 20)" :key="s.player_id">
                <td>{{ s.username }}</td>
                <td>{{ s.floor }}</td>
                <td class="opacity-60 text-xs">{{ new Date(s.started_at).toLocaleString('fr') }}</td>
              </tr>
              <tr v-if="sessions.combat_idle.length === 0">
                <td colspan="3" class="text-center opacity-60">Aucune session active</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
