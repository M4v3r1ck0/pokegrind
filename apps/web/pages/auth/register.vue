<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { navigateTo } from '#app'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const auth = useAuthStore()

if (import.meta.client && auth.isAuthenticated) {
  navigateTo('/jeu')
}

// ── Formulaire ──────────────────────────────────────────────────────────────
const username          = ref('')
const email             = ref('')
const password          = ref('')
const selectedStarterId = ref<number | null>(null)
const error             = ref('')
const loading           = ref(false)

// ── Starters ────────────────────────────────────────────────────────────────
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

const { public: { apiBase } } = useRuntimeConfig()

async function loadStarters() {
  try {
    startersByRegion.value = await $fetch<StartersByRegion>(`${apiBase}/starters`)
  } catch (e) {
    console.error('[register] Impossible de charger les starters:', e)
  } finally {
    starters_loading.value = false
  }
}

onMounted(loadStarters)

const REGION_LABELS: Record<string, string> = {
  kanto: 'Kanto', johto: 'Johto', hoenn: 'Hoenn', sinnoh: 'Sinnoh',
  unova: 'Unova', kalos: 'Kalos', alola: 'Alola', galar: 'Galar', paldea: 'Paldéa',
}

// Couleurs CSS de type (variables design system)
const TYPE_CSS: Record<string, string> = {
  fire: '#ff6b35', water: '#4fc3f7', grass: '#56c96d', electric: '#ffd700',
  psychic: '#ff6b9d', ice: '#96d9e8', dragon: '#6c5ce7', dark: '#4a4a6a',
  fairy: '#ffb3d9', fighting: '#d4522a', poison: '#a855c8', ground: '#c8a85e',
  rock: '#8b7355', bug: '#91b800', ghost: '#6c5ce7', steel: '#8fa8c8',
  normal: '#a8a878', flying: '#89aadc',
}

function typeColor(type: string | null): string {
  if (!type) return '#555'
  return TYPE_CSS[type] || '#555'
}

function animatedSprite(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`
}

function staticSprite(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

function onSpriteError(e: Event, id: number) {
  const img = e.target as HTMLImageElement
  img.src = staticSprite(id)
}

// ── Validation ───────────────────────────────────────────────────────────────
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

// ── Étapes UI ────────────────────────────────────────────────────────────────
const step = ref<1 | 2>(1)

function goToStarter() {
  if (usernameError.value || emailError.value || passwordError.value) return
  if (!username.value || !email.value || !password.value) return
  step.value = 2
}

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
    step.value = 1
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">

    <!-- ── Card centrale ──────────────────────────────────────────────── -->
    <div class="register-card">

      <!-- Logo -->
      <div class="card-logo font-display">⚡ PokeGrind</div>
      <h1 class="card-title">Créer un compte</h1>

      <!-- Indicateur d'étapes -->
      <div class="steps-indicator">
        <div class="step-item" :class="{ active: step >= 1, done: step > 1 }">
          <span class="step-num">{{ step > 1 ? '✓' : '1' }}</span>
          <span class="step-label">Mon compte</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }" />
        <div class="step-item" :class="{ active: step >= 2 }">
          <span class="step-num">2</span>
          <span class="step-label">Mon starter</span>
        </div>
      </div>

      <!-- Erreur globale -->
      <div v-if="error" class="form-error">
        <span>⚠️</span> {{ error }}
      </div>

      <!-- ── Étape 1 : Compte ─────────────────────────────────────────── -->
      <template v-if="step === 1">
        <form @submit.prevent="goToStarter" class="form-body">
          <div class="field">
            <label class="field-label">Pseudo de Dresseur</label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              maxlength="32"
              class="field-input"
              :class="{ 'field-error': usernameError }"
              placeholder="MonPseudo"
            />
            <p v-if="usernameError" class="field-hint error">{{ usernameError }}</p>
          </div>

          <div class="field">
            <label class="field-label">Email</label>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              class="field-input"
              :class="{ 'field-error': emailError }"
              placeholder="votre@email.com"
            />
            <p v-if="emailError" class="field-hint error">{{ emailError }}</p>
          </div>

          <div class="field">
            <label class="field-label">Mot de passe</label>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              class="field-input"
              :class="{ 'field-error': passwordError }"
              placeholder="••••••••"
            />
            <p v-if="passwordError" class="field-hint error">{{ passwordError }}</p>
            <p v-else-if="password.length >= 8" class="field-hint ok">✓ Mot de passe valide</p>
          </div>

          <button
            type="submit"
            class="btn-primary"
            :disabled="!username || !email || !password || !!usernameError || !!emailError || !!passwordError"
          >
            Suivant : Choisir mon starter →
          </button>
        </form>

        <p class="footer-link">
          Déjà un compte ?
          <NuxtLink to="/auth/login" class="link-accent">Se connecter</NuxtLink>
        </p>
      </template>

      <!-- ── Étape 2 : Starter ─────────────────────────────────────────── -->
      <template v-if="step === 2">
        <p class="starter-intro">
          Choisissez votre Pokémon de départ — il rejoindra votre équipe dès le début.
        </p>

        <div v-if="starters_loading" class="loading-msg">
          <div class="loading-spinner" />
          Chargement des starters…
        </div>

        <div v-else class="regions-list">
          <div v-for="(starters, region) in startersByRegion" :key="region" class="region-block">
            <h3 class="region-label">{{ REGION_LABELS[String(region)] || region }}</h3>
            <div class="starters-row">
              <button
                v-for="s in starters"
                :key="s.id"
                type="button"
                class="starter-card"
                :class="{ selected: selectedStarterId === s.id }"
                :style="selectedStarterId === s.id ? { boxShadow: `0 0 16px ${typeColor(s.type1)}55, 0 0 0 2px ${typeColor(s.type1)}` } : {}"
                @click="selectedStarterId = s.id"
              >
                <img
                  :src="animatedSprite(s.id)"
                  :alt="s.name_fr"
                  class="starter-sprite"
                  loading="lazy"
                  @error="(e) => onSpriteError(e, s.id)"
                />
                <p class="starter-name">{{ s.name_fr }}</p>
                <div class="starter-types">
                  <span
                    class="type-chip"
                    :style="{ background: typeColor(s.type1) }"
                  >{{ s.type1 }}</span>
                  <span
                    v-if="s.type2"
                    class="type-chip"
                    :style="{ background: typeColor(s.type2) }"
                  >{{ s.type2 }}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div class="step2-actions">
          <button type="button" class="btn-ghost" @click="step = 1" :disabled="loading">
            ← Retour
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!selectedStarterId || loading"
            @click="handleRegister"
          >
            <span v-if="loading" class="spinner" />
            {{ loading ? 'Création…' : 'Créer mon compte' }}
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.register-page {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 100dvh;
  padding: 40px 16px;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(156,106,222,0.1), transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(230,57,70,0.07), transparent 50%),
    #0d0e1a;
  color: var(--color-text-primary);
}

.register-card {
  width: 100%;
  max-width: 560px;
  background: rgba(26,28,46,0.92);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 40px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.card-logo {
  font-size: 1.2rem;
  letter-spacing: 0.08em;
  color: var(--color-accent-yellow);
  text-align: center;
}

.card-title {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.04em;
  text-align: center;
  margin: 0;
  color: var(--color-text-primary);
}

/* ── Steps indicator ─────────────────────────────────────────────────────── */
.steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  background: rgba(255,255,255,0.07);
  border: 2px solid rgba(255,255,255,0.12);
  color: var(--color-text-muted);
  transition: all 0.25s ease;
}

.step-item.active .step-num {
  background: linear-gradient(135deg, #e63946, #9c6ade);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 12px rgba(156,106,222,0.4);
}

.step-item.done .step-num {
  background: rgba(56,201,96,0.2);
  border-color: rgba(56,201,96,0.5);
  color: #38c960;
}

.step-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.step-item.active .step-label { color: var(--color-text-secondary); }

.step-line {
  flex: 1;
  height: 2px;
  background: rgba(255,255,255,0.1);
  margin: 0 12px;
  margin-bottom: 20px;
  width: 80px;
  transition: background 0.25s ease;
}

.step-line.done { background: linear-gradient(90deg, #38c960, rgba(56,201,96,0.3)); }

/* ── Error ───────────────────────────────────────────────────────────────── */
.form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(230,57,70,0.1);
  border: 1px solid rgba(230,57,70,0.3);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: #ff8a93;
}

/* ── Form fields ─────────────────────────────────────────────────────────── */
.form-body { display: flex; flex-direction: column; gap: 14px; }

.field { display: flex; flex-direction: column; gap: 6px; }

.field-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.04em;
}

.field-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  font-family: var(--font-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}

.field-input::placeholder { color: var(--color-text-muted); }

.field-input:focus {
  border-color: rgba(156,106,222,0.5);
  box-shadow: 0 0 0 3px rgba(156,106,222,0.1);
}

.field-input.field-error { border-color: rgba(230,57,70,0.5); }
.field-input.field-error:focus { box-shadow: 0 0 0 3px rgba(230,57,70,0.1); }

.field-hint {
  font-size: 0.75rem;
  margin: 0;
}

.field-hint.error { color: #ff8a93; }
.field-hint.ok    { color: #38c960; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 1rem;
  background: linear-gradient(135deg, #e63946, #9c6ade);
  color: #fff;
  transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 16px rgba(230,57,70,0.2);
  text-decoration: none;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(156,106,222,0.3);
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13px 24px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.95rem;
  background: transparent;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.btn-ghost:hover:not(:disabled) {
  border-color: rgba(255,255,255,0.3);
  color: var(--color-text-primary);
  background: rgba(255,255,255,0.05);
}

.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Footer link ─────────────────────────────────────────────────────────── */
.footer-link {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.link-accent {
  color: var(--color-accent-yellow);
  text-decoration: none;
  font-weight: 700;
}

.link-accent:hover { text-decoration: underline; }

/* ── Step 2 : Starter selection ──────────────────────────────────────────── */
.starter-intro {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.6;
}

.loading-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #9c6ade;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.regions-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.regions-list::-webkit-scrollbar { width: 4px; }
.regions-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 2px; }
.regions-list::-webkit-scrollbar-thumb { background: rgba(156,106,222,0.4); border-radius: 2px; }

.region-block { display: flex; flex-direction: column; gap: 10px; }

.region-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  padding: 0 4px;
  margin: 0;
}

.starters-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.starter-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.starter-card:hover {
  border-color: rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
}

.starter-card.selected {
  border-color: #ffd700;
  background: rgba(255,215,0,0.06);
}

.starter-sprite {
  width: 56px;
  height: 56px;
  object-fit: contain;
  image-rendering: pixelated;
}

.starter-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.starter-types {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.type-chip {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  letter-spacing: 0.02em;
}

/* ── Step 2 actions ──────────────────────────────────────────────────────── */
.step2-actions {
  display: flex;
  gap: 12px;
}

.step2-actions .btn-ghost  { flex: 0 0 auto; }
.step2-actions .btn-primary { flex: 1; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .register-card { padding: 28px 20px; }
  .starters-row  { grid-template-columns: repeat(3, 1fr); }
}
</style>
