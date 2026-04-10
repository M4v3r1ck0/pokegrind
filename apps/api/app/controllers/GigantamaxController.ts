/**
 * GigantamaxController — Gigantamax, Formes cosmétiques, Bonbons, Évolutions, Living Dex.
 */

import type { HttpContext } from '@adonisjs/core/http'
import gigantamaxService from '#services/GigantamaxService'

export default class GigantamaxController {
  // ─── Gigantamax ──────────────────────────────────────────────────────────

  /** GET /api/gigantamax/unlocked */
  async unlocked({ player, response }: HttpContext) {
    const data = await gigantamaxService.getPlayerGmaxUnlocked(player.id)
    return response.ok(data)
  }

  /** GET /api/gigantamax/available */
  async available({ response }: HttpContext) {
    const data = await gigantamaxService.getAllGmaxAvailable()
    return response.ok(data)
  }

  // ─── Formes cosmétiques ───────────────────────────────────────────────────

  /** GET /api/pokemon-forms/cosmetic/:species_id */
  async cosmeticForms({ params, response }: HttpContext) {
    const forms = await gigantamaxService.getCosmeticFormsForSpecies(Number(params.species_id))
    return response.ok(forms)
  }

  /** POST /api/player/pokemon/:id/cosmetic-form */
  async changeCosmeticForm({ params, player, request, response }: HttpContext) {
    const { form_id } = request.only(['form_id'])
    if (!form_id) return response.badRequest({ message: 'form_id requis.' })

    try {
      const pokemon = await gigantamaxService.changeCosmeticForm(
        player.id,
        params.id,
        Number(form_id)
      )
      return response.ok(pokemon)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /** DELETE /api/player/pokemon/:id/cosmetic-form */
  async resetCosmeticForm({ params, player, response }: HttpContext) {
    try {
      await gigantamaxService.resetCosmeticForm(player.id, params.id)
      return response.ok({ message: 'Forme réinitialisée.' })
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  // ─── Bonbons ─────────────────────────────────────────────────────────────

  /** POST /api/player/pokemon/:id/use-candy */
  async useCandy({ params, player, request, response }: HttpContext) {
    const { item_id, quantity = 1 } = request.only(['item_id', 'quantity'])
    if (!item_id) return response.badRequest({ message: 'item_id requis.' })

    try {
      const result = await gigantamaxService.useCandy(
        player.id,
        params.id,
        Number(item_id),
        Number(quantity)
      )

      // Émettre event socket si can_evolve
      if (result.can_evolve && result.evolution_species) {
        try {
          const { getIO } = await import('../../start/socket.js')
          const io = getIO()
          io.to(`player:${player.id}`).emit('player:can_evolve', {
            pokemon_id: params.id,
            current_species_name_fr: `Niveau ${result.level_before}`,
            evolved_species_name_fr: result.evolution_species.name_fr,
            evolved_sprite_url: result.evolution_species.sprite_url,
          })
        } catch { /* socket optionnel */ }
      }

      return response.ok(result)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  // ─── Évolution manuelle ───────────────────────────────────────────────────

  /** POST /api/player/pokemon/:id/evolve */
  async evolve({ params, player, response }: HttpContext) {
    try {
      const result = await gigantamaxService.evolvePokemon(player.id, params.id)
      return response.ok(result)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  // ─── Living Dex ───────────────────────────────────────────────────────────

  /** GET /api/player/living-dex */
  async livingDex({ player, response }: HttpContext) {
    const status = await gigantamaxService.getLivingDexStatus(player.id)
    return response.ok(status)
  }

  /** GET /api/player/living-dex/objectives */
  async livingDexObjectives({ player, response }: HttpContext) {
    const objectives = await gigantamaxService.getLivingDexObjectives(player.id)
    return response.ok(objectives)
  }

  /** POST /api/player/living-dex/objectives/:id/claim */
  async claimObjective({ params, player, response }: HttpContext) {
    try {
      await gigantamaxService.claimObjective(player.id, Number(params.id))
      return response.ok({ message: 'Récompense réclamée !' })
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /** GET /api/player/living-dex/missing */
  async missingSpecies({ player, request, response }: HttpContext) {
    const generation = request.input('generation')
    const missing = await gigantamaxService.getMissingSpecies(
      player.id,
      generation ? Number(generation) : undefined
    )
    return response.ok(missing)
  }
}
