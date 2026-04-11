import { ref } from 'vue'

/**
 * Retourne l'URL du sprite selon la préférence animé/statique du joueur.
 * Préférence stockée dans localStorage sous 'pg_animated_sprites'.
 */
export function useSprite() {
  const animated = ref<boolean>(
    import.meta.client
      ? localStorage.getItem('pg_animated_sprites') !== 'false'
      : true
  )

  function toggle() {
    animated.value = !animated.value
    if (import.meta.client) {
      localStorage.setItem('pg_animated_sprites', String(animated.value))
    }
  }

  function getSpriteUrl(
    speciesId: number,
    isShiny = false,
    staticUrl?: string | null,
    shinyUrl?: string | null
  ): string {
    if (animated.value && !isShiny) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${speciesId}.gif`
    }
    if (isShiny && shinyUrl) return shinyUrl
    if (staticUrl) return staticUrl
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`
  }

  return { animated, toggle, getSpriteUrl }
}
