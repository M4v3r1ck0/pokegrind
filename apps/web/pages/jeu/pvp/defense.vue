<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref, computed } from 'vue'
import { usePvpStore } from '@/stores/pvp'
import { useInventoryStore } from '@/stores/inventory'
import { useAuthStore } from '@/stores/auth'

const store     = usePvpStore()
const inventory = useInventoryStore()
const auth      = useAuthStore()

const saving       = ref(false)
const selecting    = ref(false)
const selected_ids = ref<string[]>([])
const msg          = ref('')
const msg_type     = ref<'success' | 'error'>('success')

onMounted(async () => {
  await Promise.all([
    store.fetchDefenseTeam(),
    store.fetchNotifications(),
    inventory.fetchTeam(),
  ])
  await store.markNotificationsRead()
})

function toggleSelect(id: string) {
  const idx = selected_ids.value.indexOf(id)
  if (idx >= 0) {
    selected_ids.value.splice(idx, 1)
  } else if (selected_ids.value.length < 6) {
    selected_ids.value.push(id)
  }
}

async function saveDefenseTeam() {
  if (selected_ids.value.length === 0) return
  saving.value = true
  try {
    await store.setDefenseTeam(selected_ids.value)
    selecting.value = false
    showMsg('Équipe de défense enregistrée !', 'success')
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  } finally {
    saving.value = false
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value      = text
  msg_type.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}
</script>

<template>
  <div class="defense-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="def-header">
      <div>
        <h1 class="font-display def-title">Défense PvP</h1>
        <p class="def-sub">Configurez votre équipe de défense contre les attaques.</p>
      </div>
      <NuxtLink to="/jeu/pvp" class="btn-back">← PvP</NuxtLink>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="msg" class="toast-inline" :class="msg_type === 'success' ? 'toast-success' : 'toast-error'">
        {{ msg }}
      </div>
    </Transition>

    <!-- ── Notifications ─────────────────────────────────────── -->
    <div v-if="store.notifications?.length" class="notifs-section">
      <h2 class="font-display section-title">Attaques reçues</h2>
      <div class="notifs-list">
        <div
          v-for="notif in store.notifications.slice(0, 8)"
          :key="notif.id"
          class="notif-row"
          :class="notif.winner_id === auth.player?.id ? 'notif-def-win' : 'notif-def-loss'"
        >
          <span class="notif-icon">{{ notif.winner_id === auth.player?.id ? '🛡️' : '💀' }}</span>
          <span class="notif-msg">{{ notif.message }}</span>
          <span class="notif-elo" :style="{ color: notif.elo_change >= 0 ? 'var(--type-grass)' : 'var(--color-accent-red)' }">
            {{ notif.elo_change >= 0 ? '+' : '' }}{{ notif.elo_change }} ELO
          </span>
        </div>
      </div>
    </div>

    <!-- ── Current defense team ───────────────────────────────── -->
    <div class="team-section">
      <div class="section-head">
        <h2 class="font-display section-title">Équipe de défense</h2>
        <button
          v-if="!selecting"
          class="btn-edit"
          @click="selecting = true; selected_ids = store.defense_team?.map((p: any) => p.id) ?? []"
        >✏️ Modifier</button>
      </div>

      <div v-if="store.defense_team?.length" class="team-grid">
        <div
          v-for="pk in store.defense_team"
          :key="pk.id"
          class="team-card"
          :class="{ 'team-selected': selecting && selected_ids.includes(pk.id) }"
          @click="selecting && toggleSelect(pk.id)"
        >
          <img
            :src="pk.species.sprite_url"
            :alt="pk.species.name_fr"
            class="team-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = pk.species.sprite_fallback_url"
          />
          <p class="team-name">{{ pk.nickname ?? pk.species.name_fr }}</p>
          <p class="team-level">Niv. {{ pk.level }}</p>
          <span v-if="selecting && selected_ids.includes(pk.id)" class="check-badge">✓</span>
        </div>
      </div>
      <div v-else class="state-empty">
        Aucune équipe de défense configurée.
      </div>

      <!-- Selection from full team -->
      <div v-if="selecting" class="select-section">
        <p class="select-hint">Sélectionnez jusqu'à 6 Pokémon depuis votre équipe :</p>
        <div class="select-grid">
          <div
            v-for="pk in inventory.team"
            :key="pk.id"
            class="select-card"
            :class="{ 'is-selected': selected_ids.includes(pk.id) }"
            @click="toggleSelect(pk.id)"
          >
            <img
              :src="pk.species.sprite_url"
              :alt="pk.species.name_fr"
              class="select-sprite"
              loading="lazy"
              @error="($event.target as HTMLImageElement).src = pk.species.sprite_fallback_url"
            />
            <p class="select-name">{{ pk.nickname ?? pk.species.name_fr }}</p>
            <span class="select-check">{{ selected_ids.includes(pk.id) ? '✓' : '' }}</span>
          </div>
        </div>
        <div class="select-actions">
          <button class="btn-cancel" @click="selecting = false">Annuler</button>
          <button
            class="btn-save"
            :disabled="selected_ids.length === 0 || saving"
            @click="saveDefenseTeam"
          >{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.defense-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.def-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.def-title  { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.def-sub    { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }
.btn-back   { font-size: 0.82rem; color: var(--color-text-muted); text-decoration: none; transition: var(--transition-fast); }
.btn-back:hover { color: var(--color-text-primary); }

/* Notifications */
.notifs-list { display: flex; flex-direction: column; gap: var(--space-2); }
.notif-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.notif-def-win  { border-color: rgba(86,201,109,0.2); }
.notif-def-loss { border-color: rgba(230,57,70,0.15); }
.notif-icon { font-size: 1rem; flex-shrink: 0; }
.notif-msg  { flex: 1; font-size: 0.82rem; color: var(--color-text-secondary); }
.notif-elo  { font-size: 0.82rem; font-weight: 800; white-space: nowrap; }

/* Team section */
.team-section { display: flex; flex-direction: column; gap: var(--space-4); }
.section-head { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: 1.2rem; color: var(--color-text-primary); letter-spacing: 0.04em; }

.btn-edit {
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.3);
  border-radius: var(--radius-md);
  color: #b894f5;
  font-family: var(--font-primary);
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-edit:hover { background: rgba(156,106,222,0.22); }

.team-grid, .select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--space-3);
}

.team-card, .select-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  transition: var(--transition-fast);
  text-align: center;
}
.team-card:hover, .select-card:hover { border-color: rgba(156,106,222,0.3); }
.team-selected, .is-selected { border-color: rgba(86,201,109,0.5); background: rgba(86,201,109,0.06); }

.team-sprite, .select-sprite { width: 64px; height: 64px; image-rendering: pixelated; }
.team-name, .select-name { font-size: 0.72rem; font-weight: 700; color: var(--color-text-primary); line-height: 1.3; }
.team-level { font-size: 0.65rem; color: var(--color-text-muted); }
.check-badge, .select-check {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 0.75rem;
  color: var(--type-grass);
  font-weight: 700;
}

/* Selection */
.select-section { display: flex; flex-direction: column; gap: var(--space-4); }
.select-hint { font-size: 0.82rem; color: var(--color-text-secondary); }

.select-actions { display: flex; gap: var(--space-3); justify-content: flex-end; }
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
.btn-save {
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  padding: var(--space-2) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-save:hover:not(:disabled) { filter: brightness(1.1); }
.btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

/* States */
.state-empty { text-align: center; padding: var(--space-6); color: var(--color-text-muted); font-style: italic; }
.toast-inline { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; }
.toast-success { background: rgba(86,201,109,0.15); border: 1px solid rgba(86,201,109,0.35); color: #56c96d; }
.toast-error   { background: rgba(230,57,70,0.15); border: 1px solid rgba(230,57,70,0.35); color: var(--color-accent-red); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
