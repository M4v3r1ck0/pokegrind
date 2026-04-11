<script setup lang="ts">
export interface CombatLogEntry {
  id?: string | number
  turn?: number
  attacker?: string
  move?: string
  target?: string
  damage?: number
  effectiveness?: 'super' | 'weak' | 'immune' | 'normal'
  critical?: boolean
  status?: string
  miss?: boolean
  message: string
  type?: 'damage' | 'status' | 'heal' | 'info' | 'faint' | 'boss'
}

const props = withDefaults(defineProps<{
  entries: CombatLogEntry[]
  max?: number
  autoScroll?: boolean
}>(), { max: 100, autoScroll: true })

const logEl = ref<HTMLElement | null>(null)
const visible = computed(() => props.entries.slice(-props.max))

watchEffect(() => {
  const _ = visible.value // référencer pour la réactivité
  if (!props.autoScroll) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (logEl.value) {
        logEl.value.scrollTop = logEl.value.scrollHeight
      }
    })
  })
})

onMounted(async () => {
  await nextTick()
  setTimeout(() => {
    if (logEl.value && props.autoScroll) logEl.value.scrollTop = logEl.value.scrollHeight
  }, 80)
})

function entryClass(e: CombatLogEntry) {
  const classes: string[] = ['log-entry']
  if (e.type) classes.push(`log-${e.type}`)
  if (e.effectiveness === 'super')  classes.push('log-super')
  if (e.effectiveness === 'weak')   classes.push('log-weak')
  if (e.effectiveness === 'immune') classes.push('log-immune')
  if (e.critical) classes.push('log-critical')
  if (e.miss)     classes.push('log-miss')
  return classes.join(' ')
}

function effectivenessTag(e: CombatLogEntry): string | null {
  if (e.effectiveness === 'super')  return 'Super efficace !'
  if (e.effectiveness === 'weak')   return 'Peu efficace…'
  if (e.effectiveness === 'immune') return 'Immunisé !'
  if (e.critical)                   return 'Coup critique !'
  if (e.miss)                       return 'Raté !'
  return null
}
</script>

<template>
  <div ref="logEl" class="combat-log" role="log" aria-live="polite" aria-label="Journal de combat">
    <div v-if="visible.length === 0" class="log-empty">
      En attente du combat…
    </div>
    <TransitionGroup name="log-slide" tag="div" class="log-list">
      <div
        v-for="(entry, idx) in visible"
        :key="entry.id ?? idx"
        :class="entryClass(entry)"
      >
        <span v-if="entry.turn" class="log-turn">T{{ entry.turn }}</span>
        <span class="log-message">{{ entry.message }}</span>
        <span v-if="effectivenessTag(entry)" class="log-tag">{{ effectivenessTag(entry) }}</span>
        <span v-if="entry.damage" class="log-damage">-{{ entry.damage }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.combat-log {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  height: 220px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(156,106,222,0.4) transparent;
  font-family: var(--font-primary);
  font-size: 0.8rem;
}

.combat-log::-webkit-scrollbar { width: 4px; }
.combat-log::-webkit-scrollbar-thumb { background: rgba(156,106,222,0.4); border-radius: 2px; }

.log-empty { color: var(--color-text-muted); text-align: center; padding: var(--space-4); }

.log-list { display: flex; flex-direction: column; gap: 2px; }

.log-entry {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  line-height: 1.4;
  animation: slide-right 0.2s ease;
}

/* Entry types */
.log-damage  { color: var(--color-text-secondary); }
.log-status  { color: #c678dd; }
.log-heal    { color: var(--type-grass); }
.log-faint   { color: var(--color-accent-red); font-weight: 700; background: rgba(230,57,70,0.1); }
.log-boss    { color: var(--color-accent-yellow); font-weight: 700; background: rgba(255,215,0,0.08); }
.log-info    { color: var(--color-text-muted); font-style: italic; }

/* Effectiveness */
.log-super    { color: #56c96d; font-weight: 600; }
.log-weak     { color: var(--color-text-muted); }
.log-immune   { color: var(--color-text-muted); font-style: italic; }
.log-critical { color: var(--color-accent-yellow); font-weight: 700; }
.log-miss     { color: var(--color-text-muted); text-decoration: line-through; opacity: 0.6; }

.log-turn {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  min-width: 28px;
  flex-shrink: 0;
}

.log-message { flex: 1; }

.log-tag {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.log-super    .log-tag { background: rgba(86,201,109,0.2); color: #56c96d; }
.log-weak     .log-tag { background: rgba(107,122,153,0.2); color: var(--color-text-muted); }
.log-immune   .log-tag { background: rgba(107,122,153,0.15); color: var(--color-text-muted); }
.log-critical .log-tag { background: rgba(255,215,0,0.2); color: var(--color-accent-yellow); }
.log-miss     .log-tag { background: rgba(230,57,70,0.15); color: var(--color-accent-red); }

.log-damage {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-accent-red);
  flex-shrink: 0;
}

/* Transitions */
.log-slide-enter-active { transition: all 0.2s ease; }
.log-slide-enter-from   { opacity: 0; transform: translateX(-8px); }
</style>
