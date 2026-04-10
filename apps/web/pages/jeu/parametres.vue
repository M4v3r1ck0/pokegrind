<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useNuxtApp } from '#app'
import { usePushNotifications } from '~/composables/usePushNotifications'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const { $api } = useNuxtApp() as any
const { isSupported, isSubscribed, register, unregister, checkSubscriptionStatus } = usePushNotifications()

const saving = ref(false)
const toggling = ref(false)
const saved_msg = ref(false)

interface NotifPrefs {
  hatch_ready: boolean
  boss_milestone: boolean
  event_active: boolean
  bf_rotation: boolean
  pvp_result: boolean
  raid: boolean
}

const prefs = ref<NotifPrefs>({
  hatch_ready: true,
  boss_milestone: true,
  event_active: true,
  bf_rotation: true,
  pvp_result: false,
  raid: false,
})

const pref_labels: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: 'hatch_ready',    label: 'Éclosion prête', desc: 'Quand un Pokémon en pension est prêt à éclore' },
  { key: 'boss_milestone', label: 'Boss milestone',  desc: 'Quand vous atteignez un palier de boss' },
  { key: 'event_active',   label: 'Événement actif', desc: "Lors du démarrage d'un événement limité" },
  { key: 'bf_rotation',    label: 'Battle Frontier', desc: 'Nouvelle rotation hebdomadaire' },
  { key: 'pvp_result',     label: 'Résultat PvP',    desc: 'Quand votre défense est attaquée' },
  { key: 'raid',           label: 'Raid disponible', desc: 'Nouveau Raid Mondial actif' },
]

onMounted(async () => {
  await checkSubscriptionStatus()
  if (isSubscribed.value) {
    try {
      const { data } = await $api.get('/api/player/push/preferences')
      if (data?.notification_prefs) {
        prefs.value = { ...prefs.value, ...data.notification_prefs }
      }
    } catch { /* ignorer */ }
  }
})

async function toggleNotifications() {
  toggling.value = true
  try {
    if (isSubscribed.value) {
      await unregister()
    } else {
      await register()
    }
  } finally {
    toggling.value = false
  }
}

async function savePrefs() {
  saving.value = true
  try {
    await $api.put('/api/player/push/preferences', prefs.value)
    saved_msg.value = true
    setTimeout(() => { saved_msg.value = false }, 2500)
  } finally {
    saving.value = false
  }
}

async function disableAll() {
  const all_off: Partial<NotifPrefs> = {}
  for (const { key } of pref_labels) all_off[key] = false
  prefs.value = { ...prefs.value, ...all_off }
  await savePrefs()
}
</script>

<template>
  <div class="params-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="params-header">
      <h1 class="font-display params-title">Paramètres</h1>
      <p class="params-sub">Gérez vos notifications et préférences de compte.</p>
    </div>

    <!-- ── Notifications section ──────────────────────────────── -->
    <section class="params-section">
      <h2 class="font-display section-title">Notifications Push</h2>

      <div v-if="!isSupported" class="notif-unsupported">
        ⚠️ Les notifications push ne sont pas supportées par votre navigateur.
      </div>

      <template v-else>
        <!-- Toggle push -->
        <div class="notif-toggle-card">
          <div class="toggle-info">
            <p class="toggle-label">{{ isSubscribed ? '🔔 Notifications activées' : '🔕 Notifications désactivées' }}</p>
            <p class="toggle-sub">{{ isSubscribed ? 'Vous recevez des notifications.' : 'Activez pour recevoir des alertes.' }}</p>
          </div>
          <button
            class="btn-toggle"
            :class="isSubscribed ? 'btn-toggle-on' : 'btn-toggle-off'"
            :disabled="toggling"
            @click="toggleNotifications"
          >
            <span v-if="toggling" class="btn-spinner" />
            <span v-else>{{ isSubscribed ? 'Désactiver' : 'Activer' }}</span>
          </button>
        </div>

        <!-- Prefs list -->
        <div v-if="isSubscribed" class="prefs-card">
          <div class="prefs-header-row">
            <p class="prefs-title">Choisir les notifications :</p>
            <button class="btn-disable-all" @click="disableAll">Tout désactiver</button>
          </div>

          <div class="prefs-list">
            <label
              v-for="pref in pref_labels"
              :key="pref.key"
              class="pref-row"
            >
              <div class="pref-info">
                <p class="pref-label">{{ pref.label }}</p>
                <p class="pref-desc">{{ pref.desc }}</p>
              </div>
              <div class="pref-toggle" :class="{ 'toggle-enabled': prefs[pref.key] }" @click="prefs[pref.key] = !prefs[pref.key]">
                <div class="toggle-knob" />
              </div>
            </label>
          </div>

          <div class="prefs-actions">
            <Transition name="fade">
              <span v-if="saved_msg" class="saved-text">✅ Enregistré</span>
            </Transition>
            <button class="btn-save" :disabled="saving" @click="savePrefs">
              {{ saving ? 'Enregistrement…' : 'Enregistrer les préférences' }}
            </button>
          </div>
        </div>
      </template>
    </section>

  </div>
</template>

<style scoped>
.params-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}

.params-header { }
.params-title { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.params-sub   { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

/* Section */
.params-section { display: flex; flex-direction: column; gap: var(--space-4); }
.section-title  { font-size: 1.3rem; color: var(--color-text-primary); letter-spacing: 0.04em; }

/* Notif unsupported */
.notif-unsupported {
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.25);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  color: var(--color-accent-yellow);
  font-size: 0.85rem;
}

/* Toggle card */
.notif-toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
}
.toggle-label { font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
.toggle-sub   { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 4px; }

.btn-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.88rem;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.btn-toggle-on  { background: linear-gradient(135deg, #2d7a4d, #56c96d); color: #fff; }
.btn-toggle-off { background: linear-gradient(135deg, #7a4db8, #9c6ade); color: #fff; }
.btn-toggle:hover:not(:disabled) { filter: brightness(1.1); }
.btn-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Prefs card */
.prefs-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.prefs-header-row { display: flex; align-items: center; justify-content: space-between; }
.prefs-title { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); }
.btn-disable-all {
  font-size: 0.75rem;
  color: var(--color-accent-red);
  background: rgba(230,57,70,0.1);
  border: 1px solid rgba(230,57,70,0.25);
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  padding: 4px 10px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-disable-all:hover { background: rgba(230,57,70,0.2); }

/* Prefs list */
.prefs-list { display: flex; flex-direction: column; gap: var(--space-3); }
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
}
.pref-row:last-child { border-bottom: none; }
.pref-info { flex: 1; }
.pref-label { font-size: 0.88rem; font-weight: 700; color: var(--color-text-primary); }
.pref-desc  { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px; }

/* Toggle switch */
.pref-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255,255,255,0.1);
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.toggle-enabled { background: var(--color-accent-purple); }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle-enabled .toggle-knob { transform: translateX(20px); }

/* Actions */
.prefs-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}
.saved-text { font-size: 0.82rem; color: var(--type-grass); font-weight: 700; }
.btn-save {
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.88rem;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-save:hover:not(:disabled) { filter: brightness(1.1); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
