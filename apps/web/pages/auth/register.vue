<script setup lang="ts">
import { ref, computed } from 'vue'
import { navigateTo } from '#app'
import axios from 'axios'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const auth = useAuthStore()

if (import.meta.client && auth.isAuthenticated) {
  navigateTo('/jeu')
}

// ── Formulaire ────────────────────────────────────────────────────────────
const username = ref('')
const email = ref('')
const password = ref('')
const selectedStarterId = ref<number | null>(null)
const error = ref('')
const loading = ref(false)

// ── Starters ──────────────────────────────────────────────────────────────
interface StarterData {
  id: number
  name_fr: string
  type1: string
  type2: string | null
  sprite_url: string | null
  base_hp: number | null
  base_speed: number | null
}

type StartersByRegion = Record<string, StarterData[]>

const startersByRegion = ref<StartersByRegion>({})
const starters_loading = ref(true)

async function loadStarters() {
  try {
    const { data } = await axios.get('/api/starters')
    startersByRegion.value = data
  } catch {
    // silently fail — les starters peuvent être chargés plus tard
  } finally {
    starters_loading.value = false
  }
}

if (import.meta.client) {
  loadStarters()
}

const REGION_LABELS: Record<string, string> = {
  kanto: 'Kanto',
  johto: 'Johto',
  hoenn: 'Hoenn',
  sinnoh: 'Sinnoh',
  unova: 'Unova',
  kalos: 'Kalos',
  alola: 'Alola',
  galar: 'Galar',
  paldea: 'Paldéa',
}

const TYPE_COLORS: Record<string, string> = {
  fire: 'bg-orange-500',
  water: 'bg-blue-500',
  grass: 'bg-green-500',
  electric: 'bg-yellow-400',
  psychic: 'bg-pink-500',
  normal: 'bg-gray-400',
  fighting: 'bg-red-700',
  poison: 'bg-purple-500',
  ground: 'bg-yellow-700',
  rock: 'bg-yellow-800',
  bug: 'bg-lime-500',
  ghost: 'bg-purple-800',
  steel: 'bg-gray-500',
  fire2: 'bg-orange-600',
  ice: 'bg-cyan-400',
  dragon: 'bg-indigo-600',
  dark: 'bg-gray-800',
  fairy: 'bg-pink-300',
  flying: 'bg-sky-400',
}

function typeColor(type: string | null): string {
  if (!type) return 'bg-gray-600'
  return TYPE_COLORS[type] || 'bg-gray-600'
}

function fallbackSprite(name_fr: string): string {
  return `https://play.pokemonshowdown.com/sprites/gen5/${name_fr.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`
}

// ── Validation ────────────────────────────────────────────────────────────
const usernameError = computed(() => {
  if (!username.value) return ''
  if (username.value.length < 3) return 'Minimum 3 caractères'
  if (username.value.length > 32) return 'Maximum 32 caractères'
  if (!/^[a-zA-Z0-9-_]+$/.test(username.value)) return 'Lettres, chiffres, tirets uniquement'
  return ''
})

const emailError = computed(() => {
  if (!email.value) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'Email invalide'
  return ''
})

const passwordError = computed(() => {
  if (!password.value) return ''
  if (password.value.length < 8) return 'Minimum 8 caractères'
  return ''
})

const canSubmit = computed(() =>
  username.value.length >= 3 &&
  !usernameError.value &&
  !emailError.value &&
  !passwordError.value &&
  email.value &&
  password.value.length >= 8 &&
  selectedStarterId.value !== null
)

async function handleRegister() {
  if (!canSubmit.value || !selectedStarterId.value) return

  error.value = ''
  loading.value = true

  try {
    await auth.register(username.value, email.value, password.value, selectedStarterId.value)
    await navigateTo('/jeu')
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || "Erreur lors de l'inscription"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-yellow-400">PokeGrind</h1>
        <p class="text-gray-400 mt-2">Créez votre compte et choisissez votre starter</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Formulaire -->
        <div class="bg-gray-800 rounded-xl p-6 shadow-xl">
          <h2 class="text-xl font-bold text-yellow-400 mb-4">Vos informations</h2>

          <form @submit.prevent="handleRegister" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-300 mb-1">Pseudo</label>
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                maxlength="32"
                class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none"
                placeholder="MonPseudo"
              />
              <p v-if="usernameError" class="text-red-400 text-xs mt-1">{{ usernameError }}</p>
            </div>

            <div>
              <label class="block text-sm text-gray-300 mb-1">Email</label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none"
                placeholder="votre@email.com"
              />
              <p v-if="emailError" class="text-red-400 text-xs mt-1">{{ emailError }}</p>
            </div>

            <div>
              <label class="block text-sm text-gray-300 mb-1">Mot de passe</label>
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none"
                placeholder="••••••••"
              />
              <p v-if="passwordError" class="text-red-400 text-xs mt-1">{{ passwordError }}</p>
            </div>

            <div class="pt-2 border-t border-gray-600">
              <p class="text-sm text-gray-400">
                Starter sélectionné :
                <span v-if="selectedStarterId" class="text-yellow-400 font-bold">
                  #{{ selectedStarterId }}
                </span>
                <span v-else class="text-red-400">Aucun (requis)</span>
              </p>
            </div>

            <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

            <button
              type="submit"
              :disabled="!canSubmit || loading"
              class="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Création...' : 'Créer mon compte' }}
            </button>
          </form>

          <p class="text-center text-gray-400 text-sm mt-4">
            Déjà un compte ?
            <NuxtLink to="/auth/login" class="text-yellow-400 hover:underline">Se connecter</NuxtLink>
          </p>
        </div>

        <!-- Sélection du starter -->
        <div class="bg-gray-800 rounded-xl p-6 shadow-xl">
          <h2 class="text-xl font-bold text-yellow-400 mb-4">Choisissez votre starter</h2>

          <div v-if="starters_loading" class="text-center text-gray-400 py-8">
            Chargement des starters...
          </div>

          <div v-else class="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            <div v-for="(starters, region) in startersByRegion" :key="region">
              <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {{ REGION_LABELS[region] || region }}
              </h3>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="starter in starters"
                  :key="starter.id"
                  type="button"
                  @click="selectedStarterId = starter.id"
                  :class="[
                    'p-2 rounded-lg border-2 transition text-center cursor-pointer',
                    selectedStarterId === starter.id
                      ? 'border-yellow-400 bg-gray-700'
                      : 'border-gray-600 hover:border-gray-400 bg-gray-700/50'
                  ]"
                >
                  <img
                    :src="starter.sprite_url || fallbackSprite(starter.name_fr)"
                    :alt="starter.name_fr"
                    class="w-12 h-12 mx-auto object-contain pixelated"
                    loading="lazy"
                  />
                  <p class="text-xs font-medium mt-1 truncate">{{ starter.name_fr }}</p>
                  <div class="flex justify-center gap-1 mt-1 flex-wrap">
                    <span
                      :class="['text-xs px-1 rounded text-white', typeColor(starter.type1)]"
                    >
                      {{ starter.type1 }}
                    </span>
                    <span
                      v-if="starter.type2"
                      :class="['text-xs px-1 rounded text-white', typeColor(starter.type2)]"
                    >
                      {{ starter.type2 }}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
