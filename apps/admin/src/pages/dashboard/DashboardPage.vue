<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { useAdminApi } from '@/composables/useAdminApi'

const store = useDashboardStore()
const d = computed(() => store.data)
const router = useRouter()
const api = useAdminApi()

// Anticheat alerts summary
const alert_stats = ref<any>(null)

// Active events
const active_events = ref<any[]>([])

// Maintenance
const maintenance = ref<any>(null)
const maint_modal = ref(false)
const maint_message = ref('Maintenance en cours, veuillez patienter.')
const maint_duration = ref(60)

// Broadcast
const broadcast_modal = ref(false)
const broadcast_title = ref('')
const broadcast_body = ref('')
const broadcast_type = ref('info')

// V3 — Système + Raids + Config rapide
const system_health = ref<any>(null)
const active_raid = ref<any>(null)
const quick_config = ref<any[]>([])

let interval: ReturnType<typeof setInterval> | null = null

async function fetchExtras() {
  try {
    const [alerts, evts, status] = await Promise.all([
      api.getAnticheatStats(),
      api.getEvents(),
      api.getMaintenance(),
    ])
    alert_stats.value = alerts.data
    active_events.value = (evts.data ?? []).filter((e: any) => e.is_active && new Date(e.end_at) > new Date())
    maintenance.value = status.data?.maintenance ?? null
  } catch { /* ignore */ }
}

async function fetchV3() {
  try {
    const [health_res, raids_res, cfg_res] = await Promise.allSettled([
      api.getSystemHealth(),
      api.getRaids(),
      api.getConfig(),
    ])
    if (health_res.status === 'fulfilled') system_health.value = health_res.value.data?.data
    if (raids_res.status === 'fulfilled') {
      active_raid.value = (raids_res.value.data?.data ?? []).find((r: any) => r.status === 'active') ?? null
    }
    if (cfg_res.status === 'fulfilled') {
      const all_cfg: any[] = cfg_res.value.data?.data ?? []
      quick_config.value = all_cfg.filter((c) =>
        ['gacha.shiny_rate', 'combat.boss_timer_seconds', 'system.maintenance_mode'].includes(c.key)
      )
    }
  } catch { /* ignore */ }
}

onMounted(async () => {
  await store.fetch()
  await Promise.all([fetchExtras(), fetchV3()])
  interval = setInterval(() => { store.fetch(); fetchExtras(); fetchV3() }, 30_000)
})

onUnmounted(() => { if (interval) clearInterval(interval) })

async function enableMaintenance() {
  await api.enableMaintenance({ message_fr: maint_message.value, duration_minutes: maint_duration.value })
  maint_modal.value = false
  await fetchExtras()
}

async function disableMaintenance() {
  await api.disableMaintenance()
  await fetchExtras()
}

async function sendBroadcast() {
  await api.sendBroadcast({
    title_fr: broadcast_title.value,
    body_fr: broadcast_body.value,
    type: broadcast_type.value,
  })
  broadcast_modal.value = false
  broadcast_title.value = ''
  broadcast_body.value = ''
}

function typeLabel(t: string) {
  const MAP: Record<string, string> = {
    gem_boost: '💎 Gems boost',
    xp_boost: '⬆️ XP boost',
    shiny_boost: '✨ Shiny boost',
    banner: '🎪 Bannière',
    custom: '🎲 Custom',
  }
  return MAP[t] ?? t
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
  <div class="pa-4">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <span v-if="store.last_updated" class="text-sm text-secondary">
        Mis à jour : {{ store.last_updated.toLocaleTimeString('fr-FR') }}
      </span>
    </div>

    <!-- Actions rapides -->
    <div class="flex flex-wrap gap-2 mb-6">
      <VaButton
        v-if="!maintenance?.active"
        color="warning"
        icon="build"
        size="small"
        @click="maint_modal = true"
      >
        Activer maintenance
      </VaButton>
      <VaButton
        v-else
        color="success"
        icon="check_circle"
        size="small"
        @click="disableMaintenance"
      >
        Désactiver maintenance
      </VaButton>
      <VaButton icon="campaign" size="small" @click="broadcast_modal = true">Broadcast</VaButton>
      <VaButton preset="secondary" icon="security" size="small" @click="router.push('/anticheat')">
        Anti-triche
        <VaBadge
          v-if="alert_stats?.total_unresolved > 0"
          :text="String(alert_stats.total_unresolved)"
          color="danger"
          class="ml-1"
        />
      </VaButton>
      <VaButton preset="secondary" icon="bar_chart" size="small" @click="router.push('/economy-v3')">
        Économie V3
      </VaButton>
      <VaButton preset="secondary" icon="settings" size="small" @click="router.push('/system')">
        Santé système
      </VaButton>
      <VaButton preset="secondary" icon="tune" size="small" @click="router.push('/config')">
        Configuration
      </VaButton>
      <VaButton preset="secondary" icon="castle" size="small" @click="router.push('/dungeons')">
        Donjons
      </VaButton>
      <VaButton preset="secondary" icon="architecture" size="small" @click="router.push('/tower')">
        Tour Infinie
      </VaButton>
    </div>

    <!-- Maintenance banner -->
    <VaCard v-if="maintenance?.active" class="mb-4 border border-warning pa-3">
      <div class="flex items-center gap-2">
        <span class="text-warning">⚠️</span>
        <span class="font-bold text-warning">Maintenance active</span>
        <span class="text-secondary text-sm ml-2">{{ maintenance.message_fr }}</span>
      </div>
    </VaCard>

    <div v-if="store.is_loading && !d" class="text-center py-12 text-secondary">
      Chargement...
    </div>

    <template v-else-if="d">
      <!-- ── Joueurs ── -->
      <h2 class="text-lg font-semibold mb-2 mt-4">Joueurs</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-primary">{{ d.players.total.toLocaleString('fr-FR') }}</p>
          <p class="text-sm text-secondary">Total</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-success">{{ d.players.active_last_24h.toLocaleString('fr-FR') }}</p>
          <p class="text-sm text-secondary">Actifs 24h</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-info">{{ d.players.active_last_7d.toLocaleString('fr-FR') }}</p>
          <p class="text-sm text-secondary">Actifs 7j</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-warning">{{ d.players.new_today }}</p>
          <p class="text-sm text-secondary">Nouveaux aujourd'hui</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold">{{ d.players.new_this_week }}</p>
          <p class="text-sm text-secondary">Nouveaux 7j</p>
        </VaCard>
      </div>

      <!-- ── Économie ── -->
      <h2 class="text-lg font-semibold mb-2">Économie</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-primary">{{ d.economy.total_gems_in_circulation.toLocaleString('fr-FR') }}</p>
          <p class="text-sm text-secondary">💎 Gems circulation</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-success">+{{ d.economy.gems_awarded_today }}</p>
          <p class="text-sm text-secondary">💎 Gems gagnés auj.</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-danger">-{{ d.economy.gems_spent_today }}</p>
          <p class="text-sm text-secondary">💎 Gems dépensés auj.</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-warning">{{ formatGold(d.economy.total_gold_in_circulation) }}</p>
          <p class="text-sm text-secondary">💰 Or circulation</p>
        </VaCard>
      </div>

      <!-- ── Combat ── -->
      <h2 class="text-lg font-semibold mb-2">Combat</h2>
      <div class="grid grid-cols-3 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold">{{ d.combat.avg_floor_all_players }}</p>
          <p class="text-sm text-secondary">Étage moyen</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-primary">{{ d.combat.max_floor_reached }}</p>
          <p class="text-sm text-secondary">Étage max atteint</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold">{{ d.combat.total_kills_all_time.toLocaleString('fr-FR') }}</p>
          <p class="text-sm text-secondary">Kills totaux</p>
        </VaCard>
      </div>

      <!-- ── Pension + Serveur ── -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold">{{ d.daycare.active_slots }}</p>
          <p class="text-sm text-secondary">🥚 Slots pension actifs</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-success">{{ d.daycare.hatches_today }}</p>
          <p class="text-sm text-secondary">🐣 Éclosions auj.</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-info">{{ d.server.active_combat_sessions }}</p>
          <p class="text-sm text-secondary">⚔️ Sessions actives</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold">{{ formatUptime(d.server.uptime_seconds) }}</p>
          <p class="text-sm text-secondary">⏱️ Uptime</p>
          <p class="text-xs text-secondary mt-1">Redis {{ d.server.redis_memory_mb }}MB · {{ d.server.node_version }}</p>
        </VaCard>
      </div>
      <!-- ── V3 : Raids + Système + Config rapide ── -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- Raid actif -->
        <VaCard class="pa-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Raid mondial</h2>
            <VaButton size="small" preset="secondary" @click="router.push('/raids')">Gérer</VaButton>
          </div>
          <template v-if="active_raid">
            <p class="font-bold text-lg">{{ active_raid.boss_name }}</p>
            <p class="text-sm text-secondary mb-2">{{ active_raid.participants_count ?? '?' }} participants</p>
            <div class="w-full bg-base-300 rounded h-2 mb-1">
              <div
                class="h-2 rounded bg-red-500 transition-all"
                :style="{ width: `${Math.round((active_raid.hp_current / active_raid.hp_max) * 100)}%` }"
              />
            </div>
            <p class="text-xs text-secondary">{{ Math.round((active_raid.hp_current / active_raid.hp_max) * 100) }}% HP restant</p>
          </template>
          <p v-else class="text-secondary text-sm">Aucun raid actif</p>
        </VaCard>

        <!-- Système -->
        <VaCard v-if="system_health" class="pa-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Système</h2>
            <VaButton size="small" preset="secondary" @click="router.push('/system')">Détails</VaButton>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-secondary">RAM : </span>
              <span :class="system_health.api.memory_used_mb / system_health.api.memory_total_mb > 0.8 ? 'text-warning' : ''">
                {{ system_health.api.memory_used_mb }} / {{ system_health.api.memory_total_mb }} Mo
              </span>
            </div>
            <div>
              <span class="text-secondary">CPU : </span>{{ system_health.api.cpu_usage_percent }}%
            </div>
            <div>
              <span class="text-secondary">Redis : </span>
              <span :class="system_health.redis.status !== 'healthy' ? 'text-warning' : 'text-success'">
                {{ system_health.redis.memory_used_mb }} Mo
              </span>
            </div>
            <div>
              <span class="text-secondary">En ligne : </span>
              <span class="text-success font-bold">{{ system_health.game.players_online_now }}</span>
            </div>
          </div>
        </VaCard>
        <VaCard v-else class="pa-4">
          <h2 class="font-semibold mb-2">Système</h2>
          <p class="text-secondary text-sm">Chargement…</p>
        </VaCard>

        <!-- Config rapide -->
        <VaCard class="pa-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Config rapide</h2>
            <VaButton size="small" preset="secondary" @click="router.push('/config')">Tout modifier</VaButton>
          </div>
          <div class="flex flex-col gap-2 text-sm">
            <div v-for="c in quick_config" :key="c.key" class="flex justify-between">
              <span class="text-secondary text-xs font-mono">{{ c.key.split('.')[1] }}</span>
              <span class="font-mono">{{ typeof c.value === 'boolean' ? (c.value ? 'true' : 'false') : c.value }}</span>
            </div>
            <p v-if="quick_config.length === 0" class="text-secondary">Chargement…</p>
          </div>
        </VaCard>
      </div>

      <!-- ── Anti-triche ── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <VaCard class="pa-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Anti-triche</h2>
            <VaButton size="small" preset="secondary" @click="router.push('/anticheat')">Voir tout</VaButton>
          </div>
          <template v-if="alert_stats">
            <div class="flex gap-4">
              <div class="text-center">
                <p class="text-2xl font-bold text-danger">{{ alert_stats.total_unresolved }}</p>
                <p class="text-xs text-secondary">Alertes ouvertes</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ alert_stats.by_severity?.critical ?? 0 }}</p>
                <p class="text-xs text-secondary">Critiques</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold text-warning">{{ alert_stats.by_severity?.medium ?? 0 }}</p>
                <p class="text-xs text-secondary">Moyennes</p>
              </div>
            </div>
          </template>
          <p v-else class="text-secondary text-sm">Aucune donnée</p>
        </VaCard>

        <!-- ── Événements actifs ── -->
        <VaCard class="pa-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Événements actifs</h2>
            <VaButton size="small" preset="secondary" @click="router.push('/events')">Gérer</VaButton>
          </div>
          <div v-if="active_events.length > 0" class="flex flex-col gap-2">
            <div
              v-for="ev in active_events"
              :key="ev.id"
              class="flex items-center justify-between"
            >
              <span class="font-medium">{{ ev.name_fr }}</span>
              <VaBadge :text="typeLabel(ev.event_type)" color="success" />
            </div>
          </div>
          <p v-else class="text-secondary text-sm">Aucun événement actif</p>
        </VaCard>
      </div>
    </template>
  </div>

  <!-- Modal maintenance -->
  <VaModal
    v-model="maint_modal"
    title="Activer la maintenance"
    ok-text="Activer"
    ok-color="warning"
    @ok="enableMaintenance"
  >
    <p class="text-sm text-secondary mb-3">
      Les joueurs (non-admin) recevront une erreur 503 pendant la maintenance.
    </p>
    <VaInput v-model="maint_message" label="Message affiché aux joueurs" class="mb-3" />
    <VaInput v-model.number="maint_duration" label="Durée (minutes)" type="number" min="1" />
  </VaModal>

  <!-- Modal broadcast -->
  <VaModal
    v-model="broadcast_modal"
    title="Envoyer un broadcast"
    ok-text="Envoyer"
    @ok="sendBroadcast"
  >
    <p class="text-sm text-secondary mb-3">
      Le message sera affiché sur tous les clients connectés.
    </p>
    <VaSelect
      v-model="broadcast_type"
      label="Type"
      :options="['info', 'warning', 'success', 'danger']"
      class="mb-3"
    />
    <VaInput v-model="broadcast_title" label="Titre" class="mb-3" required />
    <VaInput v-model="broadcast_body" label="Message" />
  </VaModal>
</template>
