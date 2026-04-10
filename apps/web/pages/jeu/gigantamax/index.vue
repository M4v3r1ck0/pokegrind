<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, computed, onMounted } from 'vue'
import { useGigantamaxStore } from '~/stores/gigantamax'

const store = useGigantamaxStore()
const filter = ref<'all' | 'unlocked' | 'locked'>('all')
const loading = ref(false)

const unlocked_count = computed(() => store.available_gmax.filter((g) => g.unlocked).length)
const total_count = computed(() => store.available_gmax.length)
const progress_percent = computed(() =>
  total_count.value > 0 ? (unlocked_count.value / total_count.value) * 100 : 0
)

const filtered_forms = computed(() => {
  if (filter.value === 'unlocked') return store.available_gmax.filter((g) => g.unlocked)
  if (filter.value === 'locked') return store.available_gmax.filter((g) => !g.unlocked)
  return store.available_gmax
})

function getObtainLabel(method: string): string {
  const labels: Record<string, string> = {
    raid: 'Raid Mondial',
    shop: 'Boutique',
    event: 'Événement',
    default: 'Obtenir',
  }
  return labels[method] ?? method
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    store.fetchUnlockedGmax(),
    store.fetchAvailableGmax(),
  ])
  loading.value = false
})
</script>

<template>
  <div class="gmax-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="gmax-header">
      <div>
        <h1 class="font-display gmax-title">Gigantamax</h1>
        <p class="gmax-sub">Débloquez les formes Gigantamax et leurs capacités spéciales.</p>
      </div>
      <div class="gmax-progress-chip">
        <span class="progress-val">{{ unlocked_count }} / {{ total_count }}</span>
        <span class="progress-label">débloqués</span>
      </div>
    </div>

    <!-- ── Progress bar ───────────────────────────────────────── -->
    <UiProgressBar
      :current="unlocked_count"
      :max="total_count"
      color="var(--color-accent-purple)"
      :height="10"
    />

    <!-- ── Filters ────────────────────────────────────────────── -->
    <div class="filter-bar">
      <button
        v-for="(label, key) in { all: 'Tous', unlocked: 'Débloqués', locked: 'Non débloqués' }"
        :key="key"
        class="filter-btn"
        :class="{ 'filter-active': filter === key }"
        @click="filter = key as any"
      >{{ label }}</button>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="loading" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <!-- ── Forms grid ─────────────────────────────────────────── -->
    <div v-else class="gmax-grid">
      <div
        v-for="form in filtered_forms"
        :key="form.id"
        class="gmax-card"
        :class="{ 'gmax-unlocked': form.unlocked, 'gmax-locked': !form.unlocked }"
      >
        <!-- Sprite -->
        <div class="gmax-sprite-wrap">
          <img
            v-if="form.sprite_url"
            :src="form.sprite_url"
            :alt="form.name_fr"
            class="gmax-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = form.sprite_fallback_url"
          />
          <span v-else class="gmax-sprite-fallback">🔮</span>
          <span v-if="form.unlocked" class="gmax-check">✓</span>
        </div>

        <!-- Info -->
        <div class="gmax-info">
          <p class="gmax-name">{{ form.name_fr }}</p>
          <div class="gmax-types">
            <UiTypeBadge v-if="form.type1" :type="form.type1" size="xs" />
            <UiTypeBadge v-if="form.type2" :type="form.type2" size="xs" />
          </div>
          <p v-if="form.max_move_name_fr" class="gmax-move">
            Max : {{ form.max_move_name_fr }}
          </p>
        </div>

        <!-- Obtain hint for locked -->
        <div v-if="!form.unlocked" class="gmax-obtain">
          <span class="obtain-chip">{{ getObtainLabel(form.obtain_method) }}</span>
        </div>
      </div>

      <div v-if="filtered_forms.length === 0" class="state-empty">
        Aucune forme dans cette catégorie.
      </div>
    </div>

  </div>
</template>

<style scoped>
.gmax-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.gmax-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.gmax-title { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.gmax-sub   { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }
.gmax-progress-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.35);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  flex-shrink: 0;
}
.progress-val   { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-accent-purple); }
.progress-label { font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* Filters */
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.filter-btn {
  font-size: 0.82rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  padding: 6px 16px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.filter-btn:hover { background: rgba(255,255,255,0.1); }
.filter-active {
  background: rgba(156,106,222,0.15);
  border-color: rgba(156,106,222,0.4);
  color: #b894f5;
}

/* Grid */
.gmax-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
}

.gmax-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  text-align: center;
  transition: var(--transition-base);
}
.gmax-unlocked {
  border-color: rgba(156,106,222,0.35);
  box-shadow: 0 0 12px rgba(156,106,222,0.1);
}
.gmax-unlocked:hover { transform: translateY(-2px); box-shadow: var(--shadow-glow-purple); }
.gmax-locked { opacity: 0.5; }

/* Sprite */
.gmax-sprite-wrap { position: relative; }
.gmax-sprite { width: 96px; height: 96px; image-rendering: pixelated; }
.gmax-sprite-fallback { font-size: 3rem; }
.gmax-check {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 0.8rem;
  color: var(--type-grass);
  background: rgba(86,201,109,0.2);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* Info */
.gmax-name { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); }
.gmax-types { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.gmax-move { font-size: 0.72rem; color: var(--color-accent-purple); font-weight: 700; margin-top: 4px; }

/* Obtain */
.gmax-obtain { margin-top: auto; }
.obtain-chip {
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  color: var(--color-text-muted);
}

/* States */
.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.state-empty   { grid-column: 1/-1; text-align: center; padding: var(--space-8); color: var(--color-text-muted); font-style: italic; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Responsive */
@media (max-width: 600px) {
  .gmax-header { flex-direction: column; align-items: flex-start; }
  .gmax-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
}
</style>
