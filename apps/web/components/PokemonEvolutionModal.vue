<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="dismiss">
      <div class="evolution-modal">
        <!-- Header -->
        <h2 class="modal-title">Évolution disponible !</h2>
        <p class="modal-subtitle">{{ props.pokemon_name_fr }} peut évoluer !</p>

        <!-- Sprites -->
        <div class="evolution-display">
          <div class="pokemon-preview current">
            <img
              v-if="props.current_sprite"
              :src="props.current_sprite"
              :alt="props.pokemon_name_fr"
              class="evo-sprite"
            />
            <div v-else class="evo-sprite-placeholder">?</div>
            <div class="pokemon-label">{{ props.pokemon_name_fr }}</div>
          </div>

          <div class="arrow-container">
            <span class="evo-arrow">→</span>
          </div>

          <div class="pokemon-preview evolved">
            <img
              v-if="props.evolved_sprite"
              :src="props.evolved_sprite"
              :alt="props.evolved_name_fr"
              class="evo-sprite evolved-sprite"
            />
            <div v-else class="evo-sprite-placeholder">?</div>
            <div class="pokemon-label evolved-label">{{ props.evolved_name_fr }}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button
            class="evolve-btn"
            @click="confirmEvolve"
            :disabled="loading"
          >
            <span v-if="loading">Évolution en cours...</span>
            <span v-else>Évoluer !</span>
          </button>
          <button class="dismiss-btn" @click="dismiss" :disabled="loading">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  visible: boolean
  pokemon_id: string
  pokemon_name_fr: string
  evolved_name_fr: string
  current_sprite?: string | null
  evolved_sprite?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'evolved', result: any): void
  (e: 'dismissed'): void
}>()

const loading = ref(false)

async function confirmEvolve() {
  loading.value = true
  try {
    const { useGigantamaxStore } = await import('~/stores/gigantamax')
    const store = useGigantamaxStore()
    const result = await store.evolvePokemon(props.pokemon_id)
    emit('evolved', result)
  } catch (err: any) {
    console.error('[PokemonEvolutionModal] Evolution failed:', err)
  } finally {
    loading.value = false
  }
}

function dismiss() {
  if (!loading.value) emit('dismissed')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay, rgba(26, 28, 46, 0.92));
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.evolution-modal {
  background: var(--color-bg-secondary, #252742);
  border-radius: 16px;
  padding: 2rem;
  max-width: 420px;
  width: 90%;
  border: 2px solid var(--color-accent-yellow, #ffd700);
  box-shadow: 0 0 32px rgba(255, 215, 0, 0.3);
  text-align: center;
  animation: modal-in 0.3s ease;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent-yellow, #ffd700);
  margin-bottom: 0.25rem;
}

.modal-subtitle {
  color: var(--color-text-secondary, #a0aec0);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.evolution-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.pokemon-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.evo-sprite {
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
}

.evo-sprite-placeholder {
  width: 96px;
  height: 96px;
  background: var(--color-bg-tertiary, #2f3259);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-text-muted, #6b7a99);
}

.evolved .evo-sprite {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3) drop-shadow(0 0 8px var(--color-accent-yellow, #ffd700)); }
}

.pokemon-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary, #a0aec0);
}

.evolved-label {
  color: var(--color-accent-yellow, #ffd700);
}

.arrow-container {
  display: flex;
  align-items: center;
}

.evo-arrow {
  font-size: 2rem;
  color: var(--color-accent-yellow, #ffd700);
  animation: arrow-bounce 1s ease-in-out infinite;
}

@keyframes arrow-bounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.evolve-btn {
  background: var(--color-accent-yellow, #ffd700);
  color: #1a1c2e;
  border: none;
  border-radius: 10px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.evolve-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

.evolve-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dismiss-btn {
  background: var(--color-bg-tertiary, #2f3259);
  color: var(--color-text-secondary, #a0aec0);
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dismiss-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #252742);
}

.dismiss-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
