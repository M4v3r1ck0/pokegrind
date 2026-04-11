<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo, useRoute, useRouter } from '#app'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// FIX F5 : si token présent, tenter de restaurer la session avant d'afficher le formulaire
onMounted(async () => {
  if (auth.accessToken) {
    try {
      await auth.fetchMe()
      if (auth.isAuthenticated) {
        router.push((route.query.redirect as string) || '/jeu')
        return
      }
    } catch {
      // Session vraiment expirée → afficher le formulaire normalement
      auth.clearSession?.()
    }
  } else if (auth.isAuthenticated) {
    navigateTo('/jeu')
  }
})

const email    = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)

async function handleLogin() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs'
    return
  }
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/jeu'
    await navigateTo(redirect)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Email ou mot de passe incorrect'
  } finally {
    loading.value = false
  }
}

function loginWithDiscord() {
  auth.loginWithDiscord()
}
</script>

<template>
  <div class="login-page">

    <!-- ── Colonne gauche — visuel ─────────────────────────────────────── -->
    <div class="visual-col">
      <div class="visual-inner">
        <h2 class="visual-title font-display">Bon retour,<br>Dresseur !</h2>
        <div class="visual-sprite-wrap">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/6.gif"
            alt="Dracaufeu"
            class="visual-sprite"
            loading="eager"
          />
          <div class="sprite-glow" />
        </div>
        <p class="visual-quote">
          "La puissance d'un Dresseur se mesure<br>
          à la confiance qu'il accorde à ses Pokémon."
        </p>
        <div class="visual-badges">
          <span class="v-badge">🎮 100% Idle</span>
          <span class="v-badge">💎 0€ Pay-to-win</span>
          <span class="v-badge">🥚 Élevage</span>
        </div>
      </div>
    </div>

    <!-- ── Colonne droite — formulaire ────────────────────────────────── -->
    <div class="form-col">
      <div class="form-card">

        <!-- Logo -->
        <div class="card-logo font-display">⚡ PokeGrind</div>
        <h1 class="card-title">Connexion</h1>
        <p class="card-sub">Retrouvez votre aventure où vous l'avez laissée</p>

        <!-- Erreur globale -->
        <div v-if="error" class="form-error">
          <span>⚠️</span> {{ error }}
        </div>

        <!-- Formulaire -->
        <form @submit.prevent="handleLogin" class="form-body">
          <div class="field">
            <label class="field-label">Email</label>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              class="field-input"
              placeholder="votre@email.com"
              :disabled="loading"
            />
          </div>

          <div class="field">
            <label class="field-label">Mot de passe</label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="field-input"
              placeholder="••••••••"
              :disabled="loading"
            />
          </div>

          <button type="submit" class="btn-submit" :disabled="loading">
            <span v-if="loading" class="spinner" />
            {{ loading ? 'Connexion…' : 'Se connecter' }}
          </button>
        </form>

        <!-- Séparateur -->
        <div class="separator">
          <span class="sep-line" />
          <span class="sep-text">ou</span>
          <span class="sep-line" />
        </div>

        <!-- Discord -->
        <button class="btn-discord" @click="loginWithDiscord" :disabled="loading">
          <svg class="discord-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Connexion avec Discord
        </button>

        <!-- Lien register -->
        <p class="card-footer-link">
          Pas encore de compte ?
          <NuxtLink to="/auth/register" class="link-accent">S'inscrire →</NuxtLink>
        </p>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.login-page {
  display: flex;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(156,106,222,0.1), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(230,57,70,0.07), transparent 50%),
    #0d0e1a;
  color: var(--color-text-primary);
}

/* ── Visual column ────────────────────────────────────────────────────────── */
.visual-col {
  flex: 0 0 58%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: rgba(13,14,26,0.6);
  border-right: 1px solid rgba(255,255,255,0.06);
  position: relative;
  overflow: hidden;
}

.visual-col::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 40%, rgba(156,106,222,0.08), transparent 65%);
  pointer-events: none;
}

.visual-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  text-align: center;
  max-width: 460px;
}

.visual-title {
  font-size: clamp(2.5rem, 5vw, 3.8rem);
  letter-spacing: 0.05em;
  line-height: 1.1;
  background: linear-gradient(135deg, #ffd700, #9c6ade);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.visual-sprite-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visual-sprite {
  width: 140px;
  height: 140px;
  object-fit: contain;
  image-rendering: pixelated;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 20px rgba(230,57,70,0.4));
  animation: float-updown 3.5s ease-in-out infinite;
}

.sprite-glow {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(230,57,70,0.2), transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

@keyframes float-updown {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}

.visual-quote {
  font-style: italic;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.65;
  max-width: 360px;
  margin: 0;
}

.visual-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.v-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--color-text-secondary);
}

/* ── Form column ─────────────────────────────────────────────────────────── */
.form-col {
  flex: 0 0 42%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
}

.form-card {
  width: 100%;
  max-width: 400px;
  background: rgba(26,28,46,0.9);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 40px 36px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-logo {
  font-size: 1.3rem;
  letter-spacing: 0.08em;
  color: var(--color-accent-yellow);
  text-align: center;
}

.card-title {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.04em;
  color: var(--color-text-primary);
  margin: 0;
  text-align: center;
}

.card-sub {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}

/* Error */
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

/* Fields */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

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

.field-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* Submit button */
.btn-submit {
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
  box-shadow: 0 4px 16px rgba(230,57,70,0.25);
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(156,106,222,0.35);
}

.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

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

/* Separator */
.separator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sep-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.1);
}

.sep-text { font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; }

/* Discord */
.btn-discord {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: 1px solid rgba(88,101,242,0.4);
  cursor: pointer;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.95rem;
  background: rgba(88,101,242,0.12);
  color: #8b9cf4;
  transition: all 0.2s ease;
}

.btn-discord:hover:not(:disabled) {
  background: rgba(88,101,242,0.22);
  border-color: rgba(88,101,242,0.6);
  color: #fff;
}

.btn-discord:disabled { opacity: 0.5; cursor: not-allowed; }

.discord-icon { width: 18px; height: 18px; flex-shrink: 0; }

/* Footer link */
.card-footer-link {
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

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .login-page { flex-direction: column; }
  .visual-col { display: none; }
  .form-col   { flex: 1; padding: 24px 16px; }
  .form-card  { padding: 32px 24px; }
}
</style>
