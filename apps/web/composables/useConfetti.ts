/**
 * useConfetti — wraps canvas-confetti for shiny reveals and 5★ daycare hatches.
 * SSR-safe: only imports canvas-confetti on the client side.
 */

export function useConfetti() {
  async function getConfetti() {
    if (typeof window === 'undefined') return null
    const { default: confetti } = await import('canvas-confetti')
    return confetti
  }

  /**
   * Fire a shiny Pokémon confetti burst — golden sparkles + stars.
   */
  async function shinyConfetti() {
    const confetti = await getConfetti()
    if (!confetti) return

    const colors = ['#ffd700', '#ffe066', '#fff8dc', '#ffec80', '#ffd700']
    const defaults = { origin: { y: 0.5 }, colors, zIndex: 9999 }

    function fire(angle: number, spread: number, x: number) {
      confetti({
        ...defaults,
        angle,
        spread,
        particleCount: 60,
        origin: { x, y: 0.55 },
        shapes: ['star'],
        scalar: 1.2,
      })
    }

    // Left + right bursts for dramatic effect
    fire(55, 60, 0.2)
    setTimeout(() => fire(90, 80, 0.5), 100)
    setTimeout(() => fire(125, 60, 0.8), 200)
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 40,
        spread: 360,
        origin: { x: 0.5, y: 0.45 },
        shapes: ['star'],
        scalar: 0.8,
        gravity: 0.6,
      })
    }, 400)
  }

  /**
   * Fire a 5★ daycare hatch confetti — colorful burst from center.
   */
  async function hatchConfetti() {
    const confetti = await getConfetti()
    if (!confetti) return

    const colors = ['#9c6ade', '#ffd700', '#4fc3f7', '#56c96d', '#ff6b9d', '#ffd700']

    confetti({
      particleCount: 120,
      spread: 100,
      origin: { x: 0.5, y: 0.45 },
      colors,
      zIndex: 9999,
      scalar: 1.0,
    })

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: 0.3, y: 0.5 },
        colors,
        zIndex: 9999,
      })
    }, 200)

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: 0.7, y: 0.5 },
        colors,
        zIndex: 9999,
      })
    }, 350)
  }

  return { shinyConfetti, hatchConfetti }
}
