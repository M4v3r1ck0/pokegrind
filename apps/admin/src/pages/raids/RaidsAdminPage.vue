<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const raids = ref<any[]>([])
const is_loading = ref(false)
const selected_raid = ref<any>(null)
const raid_stats = ref<any>(null)
const stats_loading = ref(false)
const start_modal = ref(false)
const boss_id_input = ref<number>(1)
const action_loading = ref<string | null>(null)
const message = ref<string | null>(null)

const RAID_BOSSES = [
  { id: 1, name: 'Mewtwo (Difficile, 24h)' },
  { id: 2, name: 'Lugia (Difficile, 24h)' },
  { id: 3, name: 'Rayquaza (Extrême, 48h)' },
  { id: 4, name: 'Dialga (Extrême, 48h)' },
  { id: 5, name: 'Xerneas (Normal, 24h)' },
]

const active_raids = computed(() => raids.value.filter((r) => r.status === 'active'))
const past_raids = computed(() => raids.value.filter((r) => r.status !== 'active'))

async function fetchRaids() {
  is_loading.value = true
  try {
    const res = await api.getRaids()
    raids.value = res.data ?? []
  } finally {
    is_loading.value = false
  }
}

async function viewStats(raid: any) {
  selected_raid.value = raid
  stats_loading.value = true
  try {
    const res = await api.getRaidStats(raid.id)
    raid_stats.value = res.data
  } catch (err: any) {
    raid_stats.value = null
  } finally {
    stats_loading.value = false
  }
}

async function startRaid() {
  action_loading.value = 'start'
  try {
    await api.startRaid(boss_id_input.value)
    start_modal.value = false
    message.value = 'Raid démarré avec succès !'
    await fetchRaids()
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    action_loading.value = null
    setTimeout(() => { message.value = null }, 4000)
  }
}

async function endRaid(raid_id: string, reason: 'defeated' | 'expired') {
  if (!confirm(`Forcer la fin du Raid (${reason}) ?`)) return
  action_loading.value = raid_id
  try {
    await api.endRaid(raid_id, reason)
    message.value = `Raid terminé (${reason}).`
    await fetchRaids()
    if (selected_raid.value?.id === raid_id) {
      raid_stats.value = null
      selected_raid.value = null
    }
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    action_loading.value = null
    setTimeout(() => { message.value = null }, 4000)
  }
}

function formatNumber(n: number | string): string {
  return Number(n).toLocaleString('fr-FR')
}


function progressPercent(raid: any): number {
  const hp = Number(raid.hp_remaining ?? 0)
  const total = Number(raid.hp_total ?? 1)
  return Math.min(100, ((total - hp) / total) * 100)
}

onMounted(fetchRaids)
</script>

<template>
  <div class="raids-admin">
    <div class="page-header">
      <h1>🌍 Raids Mondiaux — Administration</h1>
      <button class="btn btn-primary" @click="start_modal = true">
        ➕ Démarrer un Raid
      </button>
    </div>

    <!-- Message flash -->
    <div v-if="message" class="flash-message">{{ message }}</div>

    <!-- Chargement -->
    <div v-if="is_loading" class="loading">Chargement...</div>

    <!-- Raids actifs -->
    <section v-if="active_raids.length">
      <h2 class="section-title">Raids actifs ({{ active_raids.length }})</h2>
      <div class="raids-grid">
        <div v-for="raid in active_raids" :key="raid.id" class="raid-card active">
          <div class="raid-card-header">
            <span class="boss-name">{{ raid.boss_name_fr }}</span>
            <span class="badge badge-active">En cours</span>
          </div>
          <div class="hp-bar-container">
            <div class="hp-bar-fill" :style="{ width: `${progressPercent(raid)}%` }" />
          </div>
          <div class="raid-meta">
            <span>👥 {{ raid.total_participants }} participants</span>
            <span>💥 {{ formatNumber(raid.total_damage_dealt) }} dégâts</span>
          </div>
          <div class="raid-meta">
            <span>⏱ Fin : {{ new Date(raid.ends_at).toLocaleString('fr-FR') }}</span>
          </div>
          <div class="raid-actions">
            <button class="btn btn-secondary btn-sm" @click="viewStats(raid)">
              📊 Stats
            </button>
            <button
              class="btn btn-warning btn-sm"
              :disabled="action_loading === raid.id"
              @click="endRaid(raid.id, 'defeated')"
            >
              ✅ Forcer victoire
            </button>
            <button
              class="btn btn-danger btn-sm"
              :disabled="action_loading === raid.id"
              @click="endRaid(raid.id, 'expired')"
            >
              ❌ Expirer
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Pas de raid actif -->
    <div v-else-if="!is_loading" class="no-active">
      Aucun Raid actif en ce moment.
    </div>

    <!-- Stats du raid sélectionné -->
    <section v-if="selected_raid" class="stats-panel">
      <div class="stats-header">
        <h2>Stats — {{ selected_raid.boss_name_fr }}</h2>
        <button class="btn btn-sm" @click="selected_raid = null; raid_stats = null">✕</button>
      </div>
      <div v-if="stats_loading">Chargement des stats...</div>
      <div v-else-if="raid_stats" class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Statut</span>
          <span class="stat-value">{{ raid_stats.status }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">HP restants</span>
          <span class="stat-value">{{ formatNumber(raid_stats.hp_remaining) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Progression</span>
          <span class="stat-value">{{ raid_stats.progress_percent?.toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Participants</span>
          <span class="stat-value">{{ raid_stats.total_participants }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Dégâts totaux</span>
          <span class="stat-value">{{ formatNumber(raid_stats.total_damage_dealt) }}</span>
        </div>
      </div>
      <div v-if="raid_stats?.top_contributors?.length">
        <h3 style="margin: 1rem 0 0.5rem; font-size: 0.9rem; color: #a0aec0;">Top contributeurs</h3>
        <table class="mini-table">
          <thead>
            <tr><th>Joueur</th><th>Dégâts</th><th>Attaques</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in raid_stats.top_contributors" :key="c.username">
              <td>{{ c.username }}</td>
              <td>{{ formatNumber(c.damage_dealt) }}</td>
              <td>{{ c.attacks_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Historique -->
    <section v-if="past_raids.length">
      <h2 class="section-title">Historique</h2>
      <table class="history-table">
        <thead>
          <tr>
            <th>Boss</th>
            <th>Statut</th>
            <th>Participants</th>
            <th>Dégâts</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="raid in past_raids" :key="raid.id">
            <td>{{ raid.boss_name_fr }}</td>
            <td>
              <span :class="`badge badge-${raid.status}`">{{ raid.status }}</span>
            </td>
            <td>{{ raid.total_participants }}</td>
            <td>{{ formatNumber(raid.total_damage_dealt) }}</td>
            <td>{{ new Date(raid.started_at).toLocaleDateString('fr-FR') }}</td>
            <td>{{ new Date(raid.ends_at).toLocaleDateString('fr-FR') }}</td>
            <td>
              <button class="btn btn-secondary btn-xs" @click="viewStats(raid)">Stats</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Modal démarrer un Raid -->
    <div v-if="start_modal" class="modal-overlay" @click.self="start_modal = false">
      <div class="modal-content">
        <h2>Démarrer un Raid Mondial</h2>
        <div class="form-group">
          <label>Boss</label>
          <select v-model="boss_id_input" class="form-select">
            <option v-for="b in RAID_BOSSES" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="start_modal = false">Annuler</button>
          <button
            class="btn btn-primary"
            :disabled="action_loading === 'start'"
            @click="startRaid"
          >
            <span v-if="action_loading === 'start'">Démarrage...</span>
            <span v-else>🚀 Démarrer</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.raids-admin { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }

.section-title { font-size: 1rem; font-weight: 600; color: #a0aec0; margin: 1.5rem 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.flash-message { background: #1e3a1e; color: #56c96d; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
.loading { color: #a0aec0; padding: 2rem; text-align: center; }
.no-active { color: #6b7a99; padding: 1.5rem; background: #252742; border-radius: 8px; text-align: center; }

.raids-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }

.raid-card {
  background: #252742;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  border: 1px solid #2f3259;
}
.raid-card.active { border-color: #4fc3f7; }
.raid-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.boss-name { font-weight: 700; }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-active   { background: #1e3a1e; color: #56c96d; }
.badge-defeated { background: #3a2e00; color: #ffd700; }
.badge-expired  { background: #3a1a1a; color: #e63946; }

.hp-bar-container { height: 8px; background: #1a1c2e; border-radius: 4px; overflow: hidden; margin-bottom: 0.75rem; }
.hp-bar-fill { height: 100%; background: linear-gradient(90deg, #e63946, #ff6b6b); transition: width 0.3s; }

.raid-meta { display: flex; gap: 1rem; font-size: 0.8rem; color: #a0aec0; margin-bottom: 0.4rem; }
.raid-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }

.btn { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.15s; }
.btn:hover:not(:disabled) { opacity: 0.85; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #4fc3f7; color: #1a1c2e; }
.btn-secondary { background: #2f3259; color: #f0f0f0; }
.btn-warning { background: #f39c12; color: #1a1c2e; }
.btn-danger { background: #e63946; color: white; }
.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; }
.btn-xs { padding: 0.2rem 0.5rem; font-size: 0.75rem; }

.stats-panel {
  background: #252742;
  border-radius: 10px;
  padding: 1.25rem;
  margin: 1rem 0;
  border: 1px solid #2f3259;
}
.stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.stats-header h2 { font-size: 1rem; font-weight: 600; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
.stat-item { background: #1a1c2e; padding: 0.6rem 0.8rem; border-radius: 6px; }
.stat-label { display: block; font-size: 0.75rem; color: #a0aec0; margin-bottom: 0.2rem; }
.stat-value { font-weight: 700; font-size: 1.1rem; }

.mini-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.mini-table th { padding: 0.4rem 0.6rem; background: #1a1c2e; color: #a0aec0; text-align: left; }
.mini-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #2f3259; }

.history-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.history-table th { padding: 0.5rem 0.75rem; background: #2f3259; color: #a0aec0; text-align: left; }
.history-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #2f3259; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(26, 28, 46, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal-content { background: #252742; border-radius: 12px; padding: 1.5rem; min-width: 360px; }
.modal-content h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; color: #a0aec0; margin-bottom: 0.4rem; }
.form-select { width: 100%; background: #1a1c2e; color: #f0f0f0; border: 1px solid #2f3259; border-radius: 6px; padding: 0.5rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem; }
</style>
