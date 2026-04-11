<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { useAdminApi } from '@/composables/useAdminApi'

const store = useDashboardStore()
const d = computed(() => store.data)
const router = useRouter()
const api = useAdminApi()

const alert_stats = ref<any>(null)
const active_events = ref<any[]>([])
const maintenance = ref<any>(null)
const system_health = ref<any>(null)
const active_raid = ref<any>(null)

// Modales
const maint_modal = ref(false)
const maint_message = ref('Maintenance en cours, veuillez patienter.')
const maint_duration = ref(60)

const broadcast_modal = ref(false)
const broadcast_title = ref('')
const broadcast_body = ref('')
const broadcast_type = ref('info')

let interval: ReturnType<typeof setInterval> | null = null

async function fetchAll() {
  try {
    const [alerts, evts, status, health, raids] = await Promise.allSettled([
      api.getAnticheatStats(),
      api.getEvents(),
      api.getMaintenance(),
      api.getSystemHealth(),
      api.getRaids(),
    ])
    if (alerts.status === 'fulfilled') alert_stats.value = alerts.value.data
    if (evts.status === 'fulfilled') {
      active_events.value = (evts.value.data ?? []).filter((e: any) => e.is_active && new Date(e.end_at) > new Date())
    }
    if (status.status === 'fulfilled') maintenance.value = status.value.data?.maintenance ?? null
    if (health.status === 'fulfilled') system_health.value = health.value.data?.data
    if (raids.status === 'fulfilled') {
      active_raid.value = (raids.value.data?.data ?? []).find((r: any) => r.status === 'active') ?? null
    }
  } catch { /* ignore */ }
}

onMounted(async () => {
  await store.fetch()
  await fetchAll()
  interval = setInterval(() => { store.fetch(); fetchAll() }, 30_000)
})

onUnmounted(() => { if (interval) clearInterval(interval) })

async function enableMaintenance() {
  await api.enableMaintenance({ message_fr: maint_message.value, duration_minutes: maint_duration.value })
  maint_modal.value = false
  await fetchAll()
}

async function disableMaintenance() {
  await api.disableMaintenance()
  await fetchAll()
}

async function sendBroadcast() {
  await api.sendBroadcast({ title_fr: broadcast_title.value, body_fr: broadcast_body.value, type: broadcast_type.value })
  broadcast_modal.value = false
  broadcast_title.value = ''
  broadcast_body.value = ''
}

function formatGold(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'G'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}min`
}
</script>

<template>
  <div style="background: #0f1117; min-height: 100vh; padding: 16px;">
    <!-- En-tête -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <h1 style="font-size: 1.5rem; font-weight: 700; color: #f0f0f0; margin: 0;">Dashboard</h1>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span v-if="store.last_updated" style="color: #6b7a99; font-size: 0.75rem;">
          Mis à jour : {{ store.last_updated.toLocaleTimeString('fr-FR') }}
        </span>
        <div
          v-if="maintenance?.active"
          style="display: flex; align-items: center; gap: 6px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); padding: 4px 12px; border-radius: 6px;"
        >
          <span style="color: #f59e0b; font-size: 0.75rem; font-weight: 700;">⚠️ MAINTENANCE</span>
        </div>
      </div>
    </div>

    <!-- Actions rapides -->
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
      <VaButton
        v-if="!maintenance?.active"
        color="warning"
        icon="build"
        size="small"
        @click="maint_modal = true"
      >
        Activer maintenance
      </VaButton>
      <VaButton v-else color="success" icon="check_circle" size="small" @click="disableMaintenance">
        Désactiver maintenance
      </VaButton>
      <VaButton icon="campaign" size="small" @click="broadcast_modal = true">Broadcast</VaButton>
      <VaButton preset="secondary" icon="people" size="small" @click="router.push('/players')">
        Joueurs
      </VaButton>
      <VaButton preset="secondary" icon="security" size="small" @click="router.push('/anticheat')">
        Anti-triche
        <span
          v-if="alert_stats?.total_unresolved > 0"
          style="background: #ef4444; color: white; font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 10px; margin-left: 6px;"
        >
          {{ alert_stats.total_unresolved }}
        </span>
      </VaButton>
      <VaButton preset="secondary" icon="bar_chart" size="small" @click="router.push('/economy-v3')">Économie</VaButton>
      <VaButton preset="secondary" icon="settings" size="small" @click="router.push('/system')">Système</VaButton>
      <VaButton preset="secondary" icon="tune" size="small" @click="router.push('/config')">Config</VaButton>
    </div>

    <div v-if="store.is_loading && !d" style="text-align: center; padding: 48px; color: #6b7a99;">
      Chargement...
    </div>

    <template v-else-if="d">
      <!-- ── Métriques prioritaires pour les tests ── -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <!-- Joueurs inscrits -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="font-size: 2rem; font-weight: 700; color: #4fc3f7; margin: 0;">
            {{ d.players.total.toLocaleString('fr-FR') }}
          </p>
          <p style="color: #6b7a99; font-size: 0.75rem; margin-top: 4px;">Joueurs inscrits</p>
        </div>

        <!-- Connectés maintenant -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px; text-align: center; position: relative; overflow: hidden;">
          <div
            v-if="system_health?.game?.players_online_now > 0"
            style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #56c96d, #4fc3f7);"
          />
          <p style="font-size: 2rem; font-weight: 700; color: #56c96d; margin: 0;">
            {{ system_health?.game?.players_online_now ?? d.players.active_last_24h }}
          </p>
          <p style="color: #6b7a99; font-size: 0.75rem; margin-top: 4px;">En ligne maintenant</p>
        </div>

        <!-- Sessions combat actives -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="font-size: 2rem; font-weight: 700; color: #ffd700; margin: 0;">
            {{ d.server.active_combat_sessions }}
          </p>
          <p style="color: #6b7a99; font-size: 0.75rem; margin-top: 4px;">⚔️ Combats actifs</p>
        </div>

        <!-- Alertes anticheat -->
        <div
          style="background: #1a1d2e; border-radius: 8px; padding: 16px; text-align: center; cursor: pointer;"
          :style="{ border: alert_stats?.total_unresolved > 0 ? '1px solid rgba(239,68,68,0.5)' : '1px solid #2d3158' }"
          @click="router.push('/anticheat')"
        >
          <p
            style="font-size: 2rem; font-weight: 700; margin: 0;"
            :style="{ color: alert_stats?.total_unresolved > 0 ? '#ef4444' : '#56c96d' }"
          >
            {{ alert_stats?.total_unresolved ?? 0 }}
          </p>
          <p style="color: #6b7a99; font-size: 0.75rem; margin-top: 4px;">🛡️ Alertes anticheat</p>
        </div>
      </div>

      <!-- ── Grille secondaire ── -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <!-- Joueurs 24h + 7j -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px;">
          <p style="color: #a0aec0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Activité joueurs</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="text-align: center;">
              <p style="font-size: 1.5rem; font-weight: 700; color: #56c96d; margin: 0;">{{ d.players.active_last_24h }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">Actifs 24h</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.5rem; font-weight: 700; color: #4fc3f7; margin: 0;">{{ d.players.active_last_7d }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">Actifs 7j</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.5rem; font-weight: 700; color: #f59e0b; margin: 0;">{{ d.players.new_today }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">Nouveaux auj.</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.5rem; font-weight: 700; color: #a0aec0; margin: 0;">{{ d.players.new_this_week }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">Nouveaux 7j</p>
            </div>
          </div>
        </div>

        <!-- Économie -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px;">
          <p style="color: #a0aec0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Économie</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="text-align: center;">
              <p style="font-size: 1.25rem; font-weight: 700; color: #ffd700; margin: 0;">{{ d.economy.total_gems_in_circulation.toLocaleString('fr-FR') }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">💎 Gems total</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.25rem; font-weight: 700; color: #f59e0b; margin: 0;">{{ formatGold(d.economy.total_gold_in_circulation) }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">💰 Or total</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.25rem; font-weight: 700; color: #56c96d; margin: 0;">+{{ d.economy.gems_awarded_today }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">💎 Gagnés auj.</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.25rem; font-weight: 700; color: #ef4444; margin: 0;">-{{ d.economy.gems_spent_today }}</p>
              <p style="color: #6b7a99; font-size: 0.7rem;">💎 Dépensés auj.</p>
            </div>
          </div>
        </div>

        <!-- Serveur -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px;">
          <p style="color: #a0aec0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Serveur</p>
          <div style="font-size: 0.875rem; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7a99;">Uptime</span>
              <span style="color: #f0f0f0; font-weight: 600;">{{ formatUptime(d.server.uptime_seconds) }}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7a99;">Node</span>
              <span style="color: #f0f0f0; font-family: monospace; font-size: 0.75rem;">{{ d.server.node_version }}</span>
            </div>
            <div v-if="system_health?.api" style="display: flex; justify-content: space-between;">
              <span style="color: #6b7a99;">RAM</span>
              <span
                :style="{ color: system_health.api.memory_used_mb / system_health.api.memory_total_mb > 0.8 ? '#f59e0b' : '#56c96d', fontWeight: '600' }"
              >
                {{ system_health.api.memory_used_mb }}/{{ system_health.api.memory_total_mb }}Mo
              </span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7a99;">Redis</span>
              <span style="color: #4fc3f7; font-weight: 600;">{{ d.server.redis_memory_mb }}Mo</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7a99;">Étage max</span>
              <span style="color: #f0f0f0; font-weight: 600;">{{ d.combat.max_floor_reached }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Pension + Raid ── -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        <!-- Pension -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px;">
          <p style="color: #a0aec0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Pension</p>
          <div style="display: flex; gap: 24px;">
            <div style="text-align: center;">
              <p style="font-size: 1.75rem; font-weight: 700; color: #f0f0f0; margin: 0;">{{ d.daycare.active_slots }}</p>
              <p style="color: #6b7a99; font-size: 0.75rem;">🥚 Slots actifs</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.75rem; font-weight: 700; color: #56c96d; margin: 0;">{{ d.daycare.hatches_today }}</p>
              <p style="color: #6b7a99; font-size: 0.75rem;">🐣 Éclosions auj.</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 1.75rem; font-weight: 700; color: #ffd700; margin: 0;">{{ d.combat.total_kills_all_time.toLocaleString('fr-FR') }}</p>
              <p style="color: #6b7a99; font-size: 0.75rem;">⚔️ Kills total</p>
            </div>
          </div>
        </div>

        <!-- Raid actif + Événements -->
        <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <p style="color: #a0aec0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Raid mondial</p>
            <VaButton size="small" preset="plain" @click="router.push('/raids')">Gérer</VaButton>
          </div>
          <template v-if="active_raid">
            <p style="font-weight: 700; color: #f0f0f0; margin-bottom: 4px;">{{ active_raid.boss_name }}</p>
            <p style="color: #6b7a99; font-size: 0.75rem; margin-bottom: 8px;">{{ active_raid.participants_count ?? '?' }} participants</p>
            <div style="width: 100%; background: #252742; border-radius: 4px; height: 6px; overflow: hidden;">
              <div
                style="height: 6px; border-radius: 4px; background: linear-gradient(90deg, #ef4444, #f59e0b); transition: width 0.3s;"
                :style="{ width: `${Math.round((active_raid.hp_current / active_raid.hp_max) * 100)}%` }"
              />
            </div>
            <p style="color: #6b7a99; font-size: 0.7rem; margin-top: 4px;">
              {{ Math.round((active_raid.hp_current / active_raid.hp_max) * 100) }}% HP restant
            </p>
          </template>
          <p v-else style="color: #6b7a99; font-size: 0.875rem;">Aucun raid actif</p>

          <!-- Événements actifs -->
          <div v-if="active_events.length > 0" style="margin-top: 12px; border-top: 1px solid #2d3158; padding-top: 12px;">
            <p style="color: #6b7a99; font-size: 0.7rem; margin-bottom: 6px;">Événements actifs</p>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              <span
                v-for="ev in active_events.slice(0, 3)"
                :key="ev.id"
                style="background: rgba(86,201,109,0.15); border: 1px solid rgba(86,201,109,0.3); color: #56c96d; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px;"
              >
                {{ ev.name_fr }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modales ─────────────────────────────────────────────────────────────── -->

    <VaModal v-model="maint_modal" title="Activer la maintenance" ok-text="Activer" ok-color="warning" @ok="enableMaintenance">
      <p style="color: #a0aec0; font-size: 0.875rem; margin-bottom: 12px;">
        Les joueurs (non-admin) recevront une erreur 503.
      </p>
      <VaInput v-model="maint_message" label="Message affiché aux joueurs" class="mb-3" />
      <VaInput v-model.number="maint_duration" label="Durée (minutes)" type="number" min="1" />
    </VaModal>

    <VaModal v-model="broadcast_modal" title="Envoyer un broadcast" ok-text="Envoyer" @ok="sendBroadcast">
      <p style="color: #a0aec0; font-size: 0.875rem; margin-bottom: 12px;">
        Le message sera affiché sur tous les clients connectés.
      </p>
      <VaSelect v-model="broadcast_type" label="Type" :options="['info', 'warning', 'success', 'danger']" class="mb-3" />
      <VaInput v-model="broadcast_title" label="Titre" class="mb-3" required />
      <VaInput v-model="broadcast_body" label="Message" />
    </VaModal>
  </div>
</template>
