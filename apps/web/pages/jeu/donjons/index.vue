<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDungeonStore } from '~/stores/dungeon'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const dungeon = useDungeonStore()

onMounted(async () => {
  await dungeon.fetchDungeons()
  await dungeon.fetchPendingRewards()
})

const dungeons = computed(() => dungeon.dungeons)
const next_reset = computed(() => dungeon.next_reset_in)
const pending_count = computed(() => dungeon.pending_rewards.length)

function difficulty_label(d: string): string {
  if (d === 'legendary') return 'LÉGENDAIRE'
  if (d === 'hard') return 'DIFFICILE'
  return 'NORMAL'
}

function difficulty_color(d: string): string {
  if (d === 'legendary') return 'var(--color-accent-yellow)'
  if (d === 'hard') return '#ff9a3c'
  return 'var(--type-grass)'
}

function status_icon(run: any): string {
  if (!run) return '○'
  if (run.status === 'completed') return '✅'
  if (run.status === 'active') return '🔄'
  return '❌'
}

function status_label(run: any): string {
  if (!run) return 'Non tenté'
  if (run.status === 'completed') return 'Complété'
  if (run.status === 'active') return 'En cours'
  return 'Échec'
}

async function enterDungeon(id: number) {
  await router.push(`/jeu/donjons/${id}/run`)
}

function format_reset(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}
</script>

<template>
  <div class="donjons-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="donjons-header">
      <div>
        <h1 class="font-display donjons-title">Donjons Ancestraux</h1>
        <p class="donjons-sub">Des épreuves roguelite aux récompenses exceptionnelles.</p>
      </div>
      <div class="header-chips">
        <div v-if="next_reset" class="chip-timer">
          ⏱️ Reset dans {{ format_reset(next_reset) }}
        </div>
        <div v-if="pending_count > 0" class="chip-pending">
          🎁 {{ pending_count }} récompense{{ pending_count > 1 ? 's' : '' }} en attente
        </div>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="dungeon.is_loading" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <!-- ── Dungeons grid ──────────────────────────────────────── -->
    <div v-else class="dungeons-grid">
      <div
        v-for="dg in dungeons"
        :key="dg.id"
        class="dungeon-card"
        :class="{
          'dungeon-completed': dg.latest_run?.status === 'completed',
          'dungeon-active':    dg.latest_run?.status === 'active',
          'dungeon-failed':    dg.latest_run?.status === 'failed',
        }"
        @click="enterDungeon(dg.id)"
      >
        <!-- Boss sprite -->
        <div class="dungeon-sprite-wrap">
          <img
            v-if="dg.boss_species?.sprite_url"
            :src="dg.boss_species.sprite_url"
            :alt="dg.name_fr"
            class="dungeon-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = dg.boss_species.sprite_fallback_url"
          />
          <span v-else class="dungeon-sprite-fallback">🏰</span>
          <span class="dungeon-status-icon">{{ status_icon(dg.latest_run) }}</span>
        </div>

        <!-- Info -->
        <div class="dungeon-info">
          <p class="dungeon-name">{{ dg.name_fr }}</p>
          <p class="dungeon-desc">{{ dg.description_fr }}</p>

          <div class="dungeon-meta">
            <span
              class="difficulty-chip"
              :style="{ color: difficulty_color(dg.difficulty), borderColor: difficulty_color(dg.difficulty) }"
            >{{ difficulty_label(dg.difficulty) }}</span>
            <span class="rooms-chip">{{ dg.room_count }} salles</span>
          </div>

          <p class="dungeon-status-label" :class="{
            'color-done':   dg.latest_run?.status === 'completed',
            'color-active': dg.latest_run?.status === 'active',
            'color-fail':   dg.latest_run?.status === 'failed',
          }">{{ status_label(dg.latest_run) }}</p>
        </div>

        <!-- CTA -->
        <div class="dungeon-cta">
          <span v-if="dg.latest_run?.status === 'active'" class="cta-resume">Reprendre →</span>
          <span v-else-if="dg.latest_run?.status === 'completed'" class="cta-done">Complété ✓</span>
          <span v-else class="cta-enter">Entrer →</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.donjons-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.donjons-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.donjons-title { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.donjons-sub   { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

.header-chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip-timer {
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.25);
  border-radius: var(--radius-full);
  color: var(--color-accent-blue);
  padding: 4px 12px;
}
.chip-pending {
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: var(--radius-full);
  color: var(--color-accent-yellow);
  padding: 4px 12px;
}

/* Grid */
.dungeons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.dungeon-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  cursor: pointer;
  transition: var(--transition-base);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-3);
}
.dungeon-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: rgba(156,106,222,0.35);
}
.dungeon-completed { border-color: rgba(86,201,109,0.3); background: rgba(86,201,109,0.04); }
.dungeon-active    { border-color: rgba(255,215,0,0.3); animation: pulse-border 2s ease infinite; }
.dungeon-failed    { opacity: 0.7; }

@keyframes pulse-border {
  0%, 100% { box-shadow: none; }
  50%       { box-shadow: 0 0 12px rgba(255,215,0,0.2); }
}

.dungeon-sprite-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
}
.dungeon-sprite { width: 96px; height: 96px; image-rendering: pixelated; }
.dungeon-sprite-fallback { font-size: 3.5rem; }
.dungeon-status-icon {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 1.2rem;
}

.dungeon-info { display: flex; flex-direction: column; gap: var(--space-1); }
.dungeon-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}
.dungeon-desc {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.dungeon-meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}
.difficulty-chip {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 2px 10px;
}
.rooms-chip {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-full);
  padding: 2px 10px;
}
.dungeon-status-label {
  font-size: 0.75rem;
  font-weight: 700;
  margin-top: var(--space-1);
}
.color-done   { color: var(--type-grass); }
.color-active { color: var(--color-accent-yellow); }
.color-fail   { color: var(--color-accent-red); }

.dungeon-cta {
  text-align: right;
  font-size: 0.82rem;
  font-weight: 700;
}
.cta-enter  { color: var(--color-accent-blue); }
.cta-resume { color: var(--color-accent-yellow); }
.cta-done   { color: var(--type-grass); }

/* States */
.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Responsive */
@media (max-width: 600px) {
  .dungeons-grid { grid-template-columns: 1fr; }
  .donjons-header { flex-direction: column; align-items: flex-start; }
}
</style>
