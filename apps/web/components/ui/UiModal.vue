<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
}>(), { size: 'md', closable: true })

const emit = defineEmits<{ close: [] }>()

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

function onBackdrop() {
  if (props.closable) emit('close')
}

onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open && props.closable) emit('close')
  }
  document.addEventListener('keydown', handler)
  onUnmounted(() => document.removeEventListener('keydown', handler))
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="onBackdrop">
        <div class="modal-box" :class="SIZE_CLASSES[size]" role="dialog" :aria-label="title">
          <div v-if="title" class="modal-header">
            <h2 class="modal-title">{{ title }}</h2>
            <button v-if="closable" class="modal-close" @click="emit('close')">✕</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 20, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.modal-box {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(156,106,222,0.3);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg), var(--shadow-glow-purple);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  color: var(--color-text-primary);
}

.modal-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}
.modal-close:hover { color: var(--color-text-primary); background: rgba(255,255,255,0.1); }

.modal-body { padding: var(--space-6); }
.modal-footer { padding: var(--space-4) var(--space-6); border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: var(--space-3); justify-content: flex-end; }

/* Transition */
.modal-enter-active { transition: all 0.25s ease; }
.modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from .modal-box { opacity: 0; transform: scale(0.9) translateY(-12px); }
.modal-leave-to .modal-box { opacity: 0; transform: scale(0.95) translateY(8px); }
.modal-enter-from, .modal-leave-to { background: transparent; }

@media (max-width: 640px) {
  .modal-overlay { align-items: flex-end; padding: 0; }
  .modal-box { border-radius: var(--radius-xl) var(--radius-xl) 0 0; max-height: 92vh; max-width: 100% !important; width: 100%; }
}
</style>
