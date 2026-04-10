/**
 * Store Gigantamax — Formes GMax, Formes cosmétiques, Living Dex, Bonbons
 */

import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GmaxForm {
  id: number
  species_id: number
  gmax_name_fr: string
  gmax_move_id: number | null
  gmax_hp_mult: number
  gmax_atk_mult: number
  gmax_def_mult: number
  gmax_spatk_mult: number
  gmax_spdef_mult: number
  gmax_speed_mult: number
  sprite_url: string | null
  sprite_shiny_url: string | null
  obtain_method: string
  unlocked?: boolean
}

export interface CosmeticForm {
  id: number
  species_id: number
  form_name_fr: string
  form_key: string
  sprite_url: string
  sprite_shiny_url: string
  obtain_method: string
}

export interface LivingDexEntry {
  species_id: number
  form_key: string
  has_shiny: boolean
  obtained_at: string | null
}

export interface LivingDexObjective {
  id: number
  name_fr: string
  description_fr: string
  condition_type: string
  condition_value: number
  gems_reward: number
  completed: boolean
  claimed: boolean
  progress: number
  progress_max: number
}

export interface LivingDexStatus {
  species_owned: number
  species_total: number
  shiny_owned: number
  forms_owned: number
  gmax_unlocked: number
  gmax_total: number
  completion_percent: number
}

export interface MissingSpecies {
  species_id: number
  name_fr: string
  generation: number
  rarity: string
  sprite_url: string | null
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGigantamaxStore = defineStore('gigantamax', {
  state: () => ({
    // GMax
    unlocked_gmax: [] as GmaxForm[],
    available_gmax: [] as GmaxForm[],

    // Living Dex
    living_dex_status: null as LivingDexStatus | null,
    living_dex_objectives: [] as LivingDexObjective[],
    missing_species: [] as MissingSpecies[],
    missing_generation: undefined as number | undefined,

    // Cosmetic Forms (par species_id)
    cosmetic_forms_cache: {} as Record<number, CosmeticForm[]>,

    loading: false,
    error: null as string | null,
  }),

  getters: {
    unlockedSpeciesIds: (state) => state.unlocked_gmax.map((g) => g.species_id),

    unclaimedObjectives: (state) =>
      state.living_dex_objectives.filter((o) => o.completed && !o.claimed),

    completedObjectivesCount: (state) =>
      state.living_dex_objectives.filter((o) => o.completed).length,
  },

  actions: {
    // ─── GMax ───────────────────────────────────────────────────────────────

    async fetchUnlockedGmax() {
      const auth = useAuthStore()
      try {
        const data = await auth.apiFetch('/api/gigantamax/unlocked')
        this.unlocked_gmax = data
      } catch (err: any) {
        this.error = err.message
      }
    },

    async fetchAvailableGmax() {
      try {
        const auth = useAuthStore()
        const data = await auth.apiFetch('/api/gigantamax/available')
        // Merge with unlocked state
        const unlocked_ids = new Set(this.unlocked_gmax.map((g) => g.species_id))
        this.available_gmax = data.map((g: GmaxForm) => ({
          ...g,
          unlocked: unlocked_ids.has(g.species_id),
        }))
      } catch (err: any) {
        this.error = err.message
      }
    },

    // ─── Formes cosmétiques ──────────────────────────────────────────────────

    async fetchCosmeticForms(species_id: number): Promise<CosmeticForm[]> {
      if (this.cosmetic_forms_cache[species_id]) {
        return this.cosmetic_forms_cache[species_id]
      }
      try {
        const auth = useAuthStore()
        const data = await auth.apiFetch(`/api/pokemon-forms/cosmetic/${species_id}`)
        this.cosmetic_forms_cache[species_id] = data
        return data
      } catch {
        return []
      }
    },

    async changeCosmeticForm(pokemon_id: string, form_id: number) {
      const auth = useAuthStore()
      return await auth.apiFetch(`/api/player/pokemon/${pokemon_id}/cosmetic-form`, {
        method: 'POST',
        body: JSON.stringify({ form_id }),
      })
    },

    async resetCosmeticForm(pokemon_id: string) {
      const auth = useAuthStore()
      return await auth.apiFetch(`/api/player/pokemon/${pokemon_id}/cosmetic-form`, {
        method: 'DELETE',
      })
    },

    // ─── Bonbons ────────────────────────────────────────────────────────────

    async useCandy(pokemon_id: string, item_id: number, quantity = 1) {
      const auth = useAuthStore()
      return await auth.apiFetch(`/api/player/pokemon/${pokemon_id}/use-candy`, {
        method: 'POST',
        body: JSON.stringify({ item_id, quantity }),
      })
    },

    // ─── Évolution manuelle ──────────────────────────────────────────────────

    async evolvePokemon(pokemon_id: string) {
      const auth = useAuthStore()
      return await auth.apiFetch(`/api/player/pokemon/${pokemon_id}/evolve`, {
        method: 'POST',
      })
    },

    // ─── Living Dex ──────────────────────────────────────────────────────────

    async fetchLivingDexStatus() {
      const auth = useAuthStore()
      try {
        this.living_dex_status = await auth.apiFetch('/api/player/living-dex')
      } catch (err: any) {
        this.error = err.message
      }
    },

    async fetchLivingDexObjectives() {
      const auth = useAuthStore()
      try {
        this.living_dex_objectives = await auth.apiFetch('/api/player/living-dex/objectives')
      } catch (err: any) {
        this.error = err.message
      }
    },

    async claimObjective(objective_id: number) {
      const auth = useAuthStore()
      await auth.apiFetch(`/api/player/living-dex/objectives/${objective_id}/claim`, {
        method: 'POST',
      })
      // Mettre à jour l'état local
      const obj = this.living_dex_objectives.find((o) => o.id === objective_id)
      if (obj) obj.claimed = true
    },

    async fetchMissingSpecies(generation?: number) {
      const auth = useAuthStore()
      this.missing_generation = generation
      try {
        const params = generation ? `?generation=${generation}` : ''
        this.missing_species = await auth.apiFetch(`/api/player/living-dex/missing${params}`)
      } catch (err: any) {
        this.error = err.message
      }
    },

    // ─── Socket handlers ─────────────────────────────────────────────────────

    handleGmaxUnlocked(data: { species_id: number; gmax_name_fr: string }) {
      const form = this.available_gmax.find((g) => g.species_id === data.species_id)
      if (form) {
        form.unlocked = true
        this.unlocked_gmax.push({ ...form })
      }
    },

    handleLivingDexObjective(data: { objective_id: number }) {
      const obj = this.living_dex_objectives.find((o) => o.id === data.objective_id)
      if (obj) obj.completed = true
    },
  },
})
