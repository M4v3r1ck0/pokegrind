<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const auth = useAuthStore()
const router = useRouter()

// Redirect authenticated players directly to the game
onMounted(async () => {
  if (auth.isAuthenticated && auth.player) {
    router.push('/jeu')
    return
  }
  try {
    await auth.fetchMe()
    if (auth.isAuthenticated) router.push('/jeu')
  } catch {
    // Not logged in — show landing
  }
})

// 6 Pokémon flottants (Gen 5 GIFs) positionnés en arc
const floatingPokemon = [
  { id: 6,   name: 'Dracaufeu',  delay: '0s',    x: '5%',   y: '30%', size: '112px' },
  { id: 9,   name: 'Tortank',    delay: '0.7s',  x: '18%',  y: '62%', size: '96px'  },
  { id: 25,  name: 'Pikachu',    delay: '1.4s',  x: '30%',  y: '42%', size: '96px'  },
  { id: 149, name: 'Dracolosse', delay: '0.3s',  x: '68%',  y: '35%', size: '120px' },
  { id: 245, name: 'Suicune',    delay: '1.1s',  x: '80%',  y: '60%', size: '108px' },
  { id: 384, name: 'Rayquaza',   delay: '1.8s',  x: '90%',  y: '28%', size: '128px' },
]

function animGif(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`
}

function staticSprite(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

function onSpriteError(e: Event, id: number) {
  const img = e.target as HTMLImageElement
  img.src = staticSprite(id)
}

const features = [
  { icon: '⚔️', title: 'Combat Automatique',   desc: 'Votre équipe combat 24h/24. Montez les étages, battez les boss de région.' },
  { icon: '🎰', title: 'Invocations & Pity',    desc: 'Système gacha équitable. Épiques garantis à 50 pulls, Légendaires à 200.' },
  { icon: '🥚', title: 'Pension & Élevage',     desc: 'Faites éclore des Pokémon rares, découvrez les Talents Cachés, pêchez les Shinies.' },
]
</script>

<template>
  <div class="landing">

    <!-- ── Floating Pokémon (Gen 5 GIFs) ──────────────────────────────── -->
    <div class="sprites-layer" aria-hidden="true">
      <img
        v-for="p in floatingPokemon"
        :key="p.id"
        :src="animGif(p.id)"
        :alt="p.name"
        class="sprite-float"
        :style="{
          left: p.x,
          top: p.y,
          width: p.size,
          height: p.size,
          animationDelay: p.delay,
        }"
        @error="(e) => onSpriteError(e, p.id)"
      />
    </div>

    <!-- ── Hero ────────────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-inner">

        <!-- Logo -->
        <div class="hero-eyebrow">
          <span class="eyebrow-dot" />
          Jeu Idle Pokémon — Navigateur
        </div>

        <h1 class="hero-logo font-display">⚡ POKEGRIND</h1>
        <p class="hero-tagline">Le premier idle Pokémon français</p>

        <p class="hero-desc">
          Combats automatiques, élevage, gacha stratégique et prestige infini.
          Zéro pay-to-win — les gems se gagnent uniquement en jouant.
        </p>

        <!-- CTA -->
        <div class="hero-actions">
          <NuxtLink to="/auth/register" class="btn-primary">
            Jouer maintenant
            <span class="btn-arrow">→</span>
          </NuxtLink>
          <NuxtLink to="/auth/login" class="btn-ghost">
            Se connecter
          </NuxtLink>
        </div>

        <!-- 3 stats bottom of hero -->
        <div class="hero-pillars">
          <div class="pillar">
            <span class="pillar-icon">🎮</span>
            <span class="pillar-label">Idle combat</span>
          </div>
          <span class="pillar-sep">|</span>
          <div class="pillar">
            <span class="pillar-icon">✨</span>
            <span class="pillar-label">Gacha</span>
          </div>
          <span class="pillar-sep">|</span>
          <div class="pillar">
            <span class="pillar-icon">🥚</span>
            <span class="pillar-label">Pension</span>
          </div>
        </div>

      </div>

      <div class="scroll-arrow" aria-hidden="true">↓</div>
    </section>

    <!-- ── Features (3 colonnes) ───────────────────────────────────────── -->
    <section class="features">
      <div class="features-inner">
        <h2 class="section-title font-display">Ce qui vous attend</h2>
        <div class="features-grid">
          <div v-for="f in features" :key="f.title" class="feature-card">
            <span class="feat-icon">{{ f.icon }}</span>
            <h3 class="feat-title">{{ f.title }}</h3>
            <p class="feat-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA Final ───────────────────────────────────────────────────── -->
    <section class="cta-final">
      <div class="cta-inner">
        <h2 class="cta-title font-display">Commencer l'aventure</h2>
        <p class="cta-sub">Inscription gratuite. Aucune carte bancaire requise.</p>
        <NuxtLink to="/auth/register" class="btn-primary btn-lg">
          Créer mon compte gratuitement
        </NuxtLink>
      </div>
    </section>

    <!-- ── Footer ──────────────────────────────────────────────────────── -->
    <footer class="landing-footer">
      <span class="footer-logo font-display">PokeGrind</span>
      <span class="footer-sep">—</span>
      <span class="footer-legal">Fan game non-officiel. Pokémon © Nintendo / Game Freak.</span>
    </footer>

  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────────────── */
.landing {
  position: relative;
  min-height: 100dvh;
  overflow-x: hidden;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(156,106,222,0.12), transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(230,57,70,0.08), transparent 50%),
    #0d0e1a;
  color: var(--color-text-primary);
}

/* ── Floating sprites ─────────────────────────────────────────────────────── */
.sprites-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.sprite-float {
  position: absolute;
  object-fit: contain;
  image-rendering: pixelated;
  opacity: 0.22;
  animation: float-updown 4s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}

@keyframes float-updown {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-12px); }
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100dvh;
  padding: 100px 24px 60px;
}

.hero-inner {
  max-width: 680px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  text-align: center;
}

/* Eyebrow badge */
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 16px;
  border-radius: 999px;
  border: 1px solid rgba(156,106,222,0.35);
  background: rgba(156,106,222,0.08);
  font-size: 0.78rem;
  font-weight: 700;
  color: #b894f5;
  letter-spacing: 0.04em;
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9c6ade;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.7); }
}

/* Logo */
.hero-logo {
  font-size: clamp(3.5rem, 10vw, 5.5rem);
  letter-spacing: 0.06em;
  line-height: 1;
  background: linear-gradient(135deg, #ffd700 0%, #9c6ade 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  filter: drop-shadow(0 0 40px rgba(255,215,0,0.3));
  margin: 0;
}

.hero-tagline {
  font-size: clamp(1.1rem, 3vw, 1.4rem);
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  letter-spacing: 0.05em;
  margin: 0;
}

.hero-desc {
  font-size: clamp(0.9rem, 2vw, 1.05rem);
  color: var(--color-text-secondary);
  line-height: 1.7;
  max-width: 520px;
  margin: 0;
}

/* Buttons */
.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 40px;
  border-radius: 999px;
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 1rem;
  text-decoration: none;
  background: linear-gradient(135deg, #e63946, #9c6ade);
  color: #fff;
  box-shadow: 0 0 20px rgba(230,57,70,0.3), 0 4px 16px rgba(0,0,0,0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 32px rgba(156,106,222,0.5), 0 8px 24px rgba(0,0,0,0.4);
}

.btn-primary.btn-lg { padding: 18px 48px; font-size: 1.1rem; }

.btn-arrow { transition: transform 0.2s ease; }
.btn-primary:hover .btn-arrow { transform: translateX(4px); }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 16px 32px;
  border-radius: 999px;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.18);
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  border-color: rgba(255,255,255,0.4);
  color: var(--color-text-primary);
  background: rgba(255,255,255,0.05);
}

/* Pillars */
.hero-pillars {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 32px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
}

.pillar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pillar-icon { font-size: 1.2rem; }
.pillar-label { font-size: 0.9rem; font-weight: 700; color: var(--color-text-secondary); letter-spacing: 0.02em; }
.pillar-sep { color: rgba(255,255,255,0.15); font-size: 1rem; }

/* Scroll arrow */
.scroll-arrow {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-text-muted);
  font-size: 1.4rem;
  animation: float-updown 2s ease-in-out infinite;
}

/* ── Features ─────────────────────────────────────────────────────────────── */
.features {
  position: relative;
  z-index: 2;
  padding: 80px 24px;
  background: rgba(26,28,46,0.85);
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(4px);
}

.features-inner {
  max-width: 1000px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: clamp(2rem, 4vw, 2.8rem);
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
  margin: 0 0 48px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.feature-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(156,106,222,0.4);
  box-shadow: 0 0 20px rgba(156,106,222,0.15);
}

.feat-icon  { font-size: 2.4rem; line-height: 1; }
.feat-title { font-weight: 800; font-size: 1.05rem; color: var(--color-text-primary); }
.feat-desc  { font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.65; }

/* ── CTA Final ────────────────────────────────────────────────────────────── */
.cta-final {
  position: relative;
  z-index: 2;
  padding: 80px 24px;
  background: linear-gradient(135deg, rgba(255,215,0,0.04), rgba(156,106,222,0.06));
  text-align: center;
}

.cta-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cta-title {
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #ffd700, #9c6ade);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.cta-sub { color: var(--color-text-secondary); font-size: 1rem; margin: 0; }

/* ── Footer ───────────────────────────────────────────────────────────────── */
.landing-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.footer-logo  { font-size: 1rem; color: var(--color-accent-yellow); letter-spacing: 0.06em; }
.footer-sep   { opacity: 0.4; }
.footer-legal { opacity: 0.7; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .features-grid { grid-template-columns: 1fr; }
  .hero-pillars  { gap: 16px; padding: 12px 20px; }
  .pillar-label  { font-size: 0.82rem; }
}

@media (max-width: 480px) {
  .sprites-layer { display: none; }
  .btn-primary, .btn-ghost { padding: 14px 24px; font-size: 0.9rem; }
  .hero-pillars { flex-wrap: wrap; justify-content: center; }
  .pillar-sep { display: none; }
}
</style>
