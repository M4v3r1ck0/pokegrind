<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

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

// Starfield canvas
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId: number

interface Star {
  x: number; y: number; size: number; speed: number; opacity: number; twinkle: number
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!

  const resize = () => {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const stars: Star[] = Array.from({ length: 160 }, () => ({
    x:       Math.random() * canvas.width,
    y:       Math.random() * canvas.height,
    size:    Math.random() * 1.8 + 0.2,
    speed:   Math.random() * 0.3 + 0.05,
    opacity: Math.random() * 0.7 + 0.3,
    twinkle: Math.random() * Math.PI * 2,
  }))

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    stars.forEach(s => {
      s.twinkle += 0.02
      const o = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle))
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${o})`
      ctx.fill()
      s.y += s.speed
      if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width }
    })
    animId = requestAnimationFrame(draw)
  }
  draw()

  onUnmounted(() => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
  })
})

// Floating starter Pokémon
const starters = [
  { id: 1,   name: 'Bulbizarre',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',   delay: '0s',   x: '10%',  y: '40%' },
  { id: 4,   name: 'Salamèche',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',   delay: '0.8s', x: '25%',  y: '60%' },
  { id: 7,   name: 'Carapuce',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png',   delay: '1.6s', x: '72%',  y: '45%' },
  { id: 152,  name: 'Germignon',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/152.png', delay: '0.4s', x: '85%',  y: '62%' },
  { id: 155,  name: 'Héricendre',  sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/155.png', delay: '2.1s', x: '15%',  y: '72%' },
  { id: 158,  name: 'Kaiminus',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/158.png', delay: '1.2s', x: '78%',  y: '28%' },
]

const features = [
  { icon: '⚔️',  title: 'Combat Idle',     desc: 'Votre équipe combat automatiquement 24h/24. Montez les étages, battez les boss.' },
  { icon: '🥚',  title: 'Pension & Élevage', desc: 'Faites éclore des Pokémon rares, débloquez des Talents Cachés, pêchez les Shinies.' },
  { icon: '🎰',  title: 'Gacha Stratégique', desc: 'Système pity équitable. Épiques à 50 pulls, Légendaires à 200. Jamais d\'arnaques.' },
  { icon: '💎',  title: '100% Farm-Only',   desc: 'Aucun achat réel. Les Gems se gagnent en jouant. Égalité totale entre joueurs.' },
  { icon: '🏆',  title: 'Battle Frontier',  desc: 'Tour, Usine, Arène — modes compétitifs rotatifs avec classements hebdomadaires.' },
  { icon: '✦',   title: 'Prestige × 50',    desc: '50 niveaux de prestige, chaque reset amplifie vos gains. La progression infinie.' },
]
</script>

<template>
  <div class="landing">
    <!-- Starfield background -->
    <canvas ref="canvasRef" class="starfield" aria-hidden="true" />

    <!-- Floating starters -->
    <div class="starters-bg" aria-hidden="true">
      <img
        v-for="s in starters"
        :key="s.id"
        :src="s.sprite"
        :alt="s.name"
        class="starter-float"
        :style="{ left: s.x, top: s.y, animationDelay: s.delay, animationDuration: `${3 + Math.random() * 2}s` }"
      />
    </div>

    <!-- Hero section -->
    <section class="hero">
      <div class="hero-inner">
        <!-- Badge -->
        <div class="hero-badge">
          <span class="badge-dot" />
          Jeu Idle Pokémon Navigateur
        </div>

        <!-- Title -->
        <h1 class="hero-title font-display">
          <span class="title-main">PokeGrind</span>
          <span class="title-sub">Gagnez pendant votre sommeil.</span>
        </h1>

        <!-- Description -->
        <p class="hero-desc">
          Un RPG idle complet — combats automatiques, élevage de Pokémon, gacha stratégique
          et prestige infini. Zéro pay-to-win, équité totale.
        </p>

        <!-- CTA buttons -->
        <div class="hero-cta">
          <NuxtLink to="/auth/register" class="btn-cta-primary">
            Commencer à jouer
            <span class="btn-arrow">→</span>
          </NuxtLink>
          <NuxtLink to="/auth/login" class="btn-cta-ghost">
            Se connecter
          </NuxtLink>
        </div>

        <!-- Stats bar -->
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-num">1 025</span>
            <span class="stat-label">Pokémon</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">100+</span>
            <span class="stat-label">Étages</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">50</span>
            <span class="stat-label">Niveaux Prestige</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">0€</span>
            <span class="stat-label">Pay-to-win</span>
          </div>
        </div>
      </div>

      <!-- Hero scroll hint -->
      <div class="scroll-hint" aria-hidden="true">
        <span>↓</span>
      </div>
    </section>

    <!-- Features grid -->
    <section class="features">
      <div class="features-inner">
        <h2 class="section-title font-display">Ce qui vous attend</h2>
        <div class="features-grid">
          <div v-for="f in features" :key="f.title" class="feature-card">
            <span class="feature-icon">{{ f.icon }}</span>
            <h3 class="feature-title">{{ f.title }}</h3>
            <p class="feature-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="final-cta">
      <div class="final-inner">
        <h2 class="font-display final-title">Prêt à construire votre équipe ?</h2>
        <p class="final-sub">Inscription gratuite. Aucune carte bancaire requise.</p>
        <NuxtLink to="/auth/register" class="btn-cta-primary btn-lg">
          Créer mon compte gratuitement
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <span class="font-display footer-logo">PokeGrind</span>
      <span class="footer-sep">—</span>
      <span class="footer-text">Fan game non-officiel. Pokémon © Nintendo / Game Freak.</span>
    </footer>
  </div>
</template>

<style scoped>
/* ─── Base ──────────────────────────────────────────────────────────── */
.landing {
  position: relative;
  min-height: 100dvh;
  overflow-x: hidden;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.starfield {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* ─── Floating starters ─────────────────────────────────────────────── */
.starters-bg {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.starter-float {
  position: absolute;
  width: 80px;
  height: 80px;
  object-fit: contain;
  image-rendering: pixelated;
  opacity: 0.18;
  animation: float var(--dur, 4s) ease-in-out infinite;
  filter: blur(0.5px);
}

/* ─── Hero ──────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100dvh;
  padding: 80px var(--space-6) var(--space-12);
}

.hero-inner {
  max-width: 700px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  text-align: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(156,106,222,0.4);
  background: rgba(156,106,222,0.1);
  font-size: 0.8rem;
  font-weight: 700;
  color: #b894f5;
  animation: scale-in 0.5s ease;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9c6ade;
  animation: pulse-gold 2s ease-in-out infinite;
}

.hero-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  animation: scale-in 0.6s ease 0.1s both;
}

.title-main {
  font-size: clamp(3.5rem, 10vw, 6rem);
  letter-spacing: 0.06em;
  background: linear-gradient(135deg, #ffd700 0%, #ffb300 40%, #ff8c00 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 30px rgba(255,215,0,0.4));
  line-height: 1.0;
}

.title-sub {
  font-size: clamp(1.2rem, 3.5vw, 1.8rem);
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  -webkit-text-fill-color: initial;
  font-family: var(--font-display);
}

.hero-desc {
  font-size: clamp(0.95rem, 2vw, 1.1rem);
  color: var(--color-text-secondary);
  line-height: 1.7;
  max-width: 540px;
  animation: slide-down 0.6s ease 0.3s both;
}

/* CTA buttons */
.hero-cta {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
  animation: slide-down 0.6s ease 0.4s both;
}

.btn-cta-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 14px 32px;
  border-radius: var(--radius-full);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 1rem;
  text-decoration: none;
  background: linear-gradient(135deg, #6c2ed4, #9c6ade);
  color: #fff;
  box-shadow: var(--shadow-glow-purple), 0 4px 16px rgba(0,0,0,0.4);
  transition: var(--transition-base);
}
.btn-cta-primary:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 0 24px rgba(156,106,222,0.7), 0 8px 24px rgba(0,0,0,0.4);
}
.btn-cta-primary.btn-lg { padding: 16px 40px; font-size: 1.1rem; }

.btn-arrow { transition: transform 0.2s ease; }
.btn-cta-primary:hover .btn-arrow { transform: translateX(4px); }

.btn-cta-ghost {
  display: inline-flex;
  align-items: center;
  padding: 14px 28px;
  border-radius: var(--radius-full);
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--color-text-secondary);
  transition: var(--transition-base);
}
.btn-cta-ghost:hover {
  border-color: rgba(255,255,255,0.4);
  color: var(--color-text-primary);
  background: rgba(255,255,255,0.05);
}

/* Stats */
.hero-stats {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-xl);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  animation: slide-down 0.6s ease 0.5s both;
}

.stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat-num { font-family: var(--font-display); font-size: 1.6rem; color: var(--color-accent-yellow); letter-spacing: 0.04em; }
.stat-label { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.1); }

/* Scroll hint */
.scroll-hint {
  position: absolute;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-text-muted);
  font-size: 1.2rem;
  animation: float 2s ease-in-out infinite;
}

/* ─── Features ──────────────────────────────────────────────────────── */
.features {
  position: relative;
  z-index: 2;
  padding: var(--space-16) var(--space-6);
  background: rgba(37,39,66,0.6);
  backdrop-filter: blur(4px);
  border-top: 1px solid rgba(255,255,255,0.07);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.features-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
  margin-bottom: var(--space-10);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.feature-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  transition: var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(156,106,222,0.4);
  box-shadow: var(--shadow-glow-purple);
}

.feature-icon { font-size: 2rem; line-height: 1; }
.feature-title { font-family: var(--font-primary); font-weight: 800; font-size: 1.05rem; color: var(--color-text-primary); }
.feature-desc  { font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; }

/* ─── Final CTA ─────────────────────────────────────────────────────── */
.final-cta {
  position: relative;
  z-index: 2;
  padding: var(--space-16) var(--space-6);
  text-align: center;
}

.final-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.final-title {
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #ffd700, #9c6ade);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.final-sub { color: var(--color-text-secondary); font-size: 1rem; }

/* ─── Footer ─────────────────────────────────────────────────────────── */
.landing-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid rgba(255,255,255,0.07);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.footer-logo { font-size: 1.1rem; color: var(--color-accent-yellow); letter-spacing: 0.06em; }

/* ─── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .features-grid { grid-template-columns: repeat(2, 1fr); }
  .hero-stats { gap: var(--space-3); }
  .stat-divider { display: none; }
}

@media (max-width: 480px) {
  .features-grid { grid-template-columns: 1fr; }
  .starters-bg { display: none; }
  .btn-cta-primary, .btn-cta-ghost { padding: 12px 24px; font-size: 0.9rem; }
}
</style>
