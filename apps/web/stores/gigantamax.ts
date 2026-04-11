/**
 * Store Gigantamax — Formes GMax, Formes cosmétiques, Living Dex, Bonbons
 */

import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

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
      const api = (useNuxtApp() as any).$api
      try {
        const { data } = await api.get('/gigantamax/unlocked')
        this.unlocked_gmax = data
      } catch (err: any) {
        this.error = err.message
      }
    },

    async fetchAvailableGmax() {
      const api = (useNuxtApp() as any).$api
      try {
        const { data } = await api.get('/gigantamax/available')
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
        const api = (useNuxtApp() as any).$api
        const { data } = await api.get(`/pokemon-forms/cosmetic/${species_id}`)
        this.cosmetic_forms_cache[species_id] = data
        return data
      } catch {
        return []
      }
    },

    async changeCosmeticForm(pokemon_id: string, form_id: number) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post(`/player/pokemon/${pokemon_id}/cosmetic-form`, { form_id })
      return data
    },

    async resetCosmeticForm(pokemon_id: string) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.delete(`/player/pokemon/${pokemon_id}/cosmetic-form`)
      return data
    },

    // ─── Bonbons ────────────────────────────────────────────────────────────

    async useCandy(pokemon_id: string, item_id: number, quantity = 1) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post(`/player/pokemon/${pokemon_id}/use-candy`, { item_id, quantity })
      return data
    },

    // ─── Évolution manuelle ──────────────────────────────────────────────────

    async evolvePokemon(pokemon_id: string) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post(`/player/pokemon/${pokemon_id}/evolve`)
      return data
    },

    // ─── Living Dex ──────────────────────────────────────────────────────────

    async fetchLivingDexStatus() {
      const api = (useNuxtApp() as any).$api
      try {
        const { data } = await api.get('/player/living-dex')
        this.living_dex_status = data
      } catch (err: any) {
        this.error = err.message
      }
    },

    async fetchLivingDexObjectives() {
      const api = (useNuxtApp() as any).$api
      try {
        const { data } = await api.get('/player/living-dex/objectives')
        this.living_dex_objectives = data
      } catch (err: any) {
        this.error = err.message
      }
    },

    async claimObjective(objective_id: number) {
      const api = (useNuxtApp() as any).$api
      await api.post(`/player/living-dex/objectives/${objective_id}/claim`)
      // Mettre à jour l'état local
      const obj = this.living_dex_objectives.find((o) => o.id === objective_id)
      if (obj) obj.claimed = true
    },

    async fetchMissingSpecies(generation?: number) {
      const api = (useNuxtApp() as any).$api
      this.missing_generation = generation
      try {
        const params = generation ? `?generation=${generation}` : ''
        const { data } = await api.get(`/player/living-dex/missing${params}`)
        this.missing_species = data
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
