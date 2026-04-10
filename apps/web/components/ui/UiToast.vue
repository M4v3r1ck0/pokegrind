<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { toasts, remove } = useToast()

const TOAST_CONFIG = {
  success: { bg: 'rgba(86,201,109,0.12)',  border: '#56c96d', icon_color: '#56c96d' },
  error:   { bg: 'rgba(230,57,70,0.12)',   border: '#e63946', icon_color: '#e63946' },
  info:    { bg: 'rgba(79,195,247,0.12)',  border: '#4fc3f7', icon_color: '#4fc3f7' },
  warning: { bg: 'rgba(255,215,0,0.12)',   border: '#ffd700', icon_color: '#ffd700' },
  gem:     { bg: 'rgba(156,106,222,0.15)', border: '#9c6ade', icon_color: '#9c6ade' },
  shiny:   { bg: 'rgba(255,224,102,0.15)', border: '#ffe066', icon_color: '#ffe066' },
} as const
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast-${toast.type}`"
          :style="{
            background: TOAST_CONFIG[toast.type]?.bg,
            borderColor: TOAST_CONFIG[toast.type]?.border,
          }"
          role="alert"
          @click="remove(toast.id)"
        >
          <span
            class="toast-icon"
            :style="{ color: TOAST_CONFIG[toast.type]?.icon_color }"
          >{{ toast.icon }}</span>
          <div class="toast-body">
            <p class="toast-message">{{ toast.message }}</p>
            <p v-if="toast.detail" class="toast-detail">{{ toast.detail }}</p>
          </div>
          <button class="toast-close" @click.stop="remove(toast.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: calc(var(--z-modal) + 10);
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-2);
  max-width: 360px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  backdrop-filter: blur(12px);
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  pointer-events: all;
  min-width: 240px;
}

.toast-shiny {
  animation: shiny-glow 2s ease-in-out infinite;
}

@keyframes shiny-glow {
  0%, 100% { box-shadow: var(--shadow-lg), 0 0 12px rgba(255,224,102,0.4); }
  50%       { box-shadow: var(--shadow-lg), 0 0 24px rgba(255,224,102,0.8); }
}

.toast-icon {
  font-size: 1.1rem;
  line-height: 1.4;
  flex-shrink: 0;
  font-style: normal;
}

.toast-body { flex: 1; min-width: 0; }

.toast-message {
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.toast-detail {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
  line-height: 1.3;
}

.toast-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: var(--transition-fast);
}
.toast:hover .toast-close { opacity: 1; }
.toast-close:hover { color: var(--color-text-primary); }

/* Transitions */
.toast-enter-active { transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(32px) scale(0.9); }
.toast-leave-to     { opacity: 0; transform: translateX(32px); }
.toast-move         { transition: transform 0.3s ease; }

@media (max-width: 640px) {
  .toast-container {
    bottom: var(--space-4);
    right: var(--space-3);
    left: var(--space-3);
    max-width: 100%;
  }
}
</style>
