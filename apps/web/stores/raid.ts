/**
 * Pinia store — Raids Mondiaux
 */

import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RaidBossInfo {
  name_fr: string
  species_id: number
  difficulty: string
  sprite_url: string | null
}

export interface MyContribution {
  damage_dealt: number
  attacks_count: number
  contribution_percent: number
  current_tier: string
  can_attack_now: boolean
  next_attack_at: string | null
}

export interface ActiveRaid {
  id: string
  boss: RaidBossInfo
  hp_remaining: number
  hp_total: number
  progress_percent: number
  ends_at: string
  time_remaining_seconds: number
  total_participants: number
  my_contribution: MyContribution | null
}

export interface LeaderboardEntry {
  rank: number
  username: string
  damage_dealt: number
  contribution_percent: number
  tier: string
  attacks_count: number
}

export interface RaidReward {
  id: string
  reward_type: string
  reward_data: Record<string, unknown>
  boss_name_fr: string
  created_at: string
}

export interface AttackResult {
  damage_dealt: number
  hp_remaining: number
  hp_total: number
  progress_percent: number
  my_total_damage: number
  my_contribution_percent: number
  current_tier: string
  cooldown_next_attack: string
  raid_defeated: boolean
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRaidStore = defineStore('raid', {
  state: () => ({
    active_raids: [] as ActiveRaid[],
    current_raid: null as ActiveRaid | null,
    leaderboard: [] as LeaderboardEntry[],
    my_rank: null as number | null,
    my_entry: null as LeaderboardEntry | null,
    pending_rewards: [] as RaidReward[],
    loading: false,
    attacking: false,
    last_attack_result: null as AttackResult | null,
    error: null as string | null,
  }),

  getters: {
    hasActiveRaid: (state) => state.active_raids.length > 0,
    canAttackCurrentRaid: (state) =>
      state.current_raid?.my_contribution?.can_attack_now ?? true,
  },

  actions: {
    // ── Charger les raids actifs ──────────────────────────────────────────
    async fetchActiveRaids() {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp() as any
        const raids = await $api('/raids/active')
        this.active_raids = raids
        if (raids.length > 0 && !this.current_raid) {
          this.current_raid = raids[0]
        }
      } catch (err: any) {
        this.error = err.message ?? 'Erreur lors du chargement des raids.'
      } finally {
        this.loading = false
      }
    },

    // ── Charger un raid spécifique ────────────────────────────────────────
    async fetchRaid(raid_id: string) {
      this.loading = true
      try {
        const { $api } = useNuxtApp() as any
        this.current_raid = await $api(`/raids/${raid_id}`)
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    // ── Attaquer ──────────────────────────────────────────────────────────
    async attack(raid_id: string): Promise<AttackResult | null> {
      this.attacking = true
      this.error = null
      try {
        const { $api } = useNuxtApp() as any
        const result: AttackResult = await $api(`/raids/${raid_id}/attack`, { method: 'POST' })
        this.last_attack_result = result

        // Mettre à jour la contribution locale
        if (this.current_raid?.id === raid_id) {
          if (this.current_raid.my_contribution) {
            this.current_raid.my_contribution.damage_dealt = result.my_total_damage
            this.current_raid.my_contribution.contribution_percent = result.my_contribution_percent
            this.current_raid.my_contribution.current_tier = result.current_tier
            this.current_raid.my_contribution.can_attack_now = false
            this.current_raid.my_contribution.next_attack_at = result.cooldown_next_attack
          } else {
            this.current_raid.my_contribution = {
              damage_dealt: result.my_total_damage,
              attacks_count: 1,
              contribution_percent: result.my_contribution_percent,
              current_tier: result.current_tier,
              can_attack_now: false,
              next_attack_at: result.cooldown_next_attack,
            }
          }
          this.current_raid.hp_remaining = result.hp_remaining
          this.current_raid.progress_percent = result.progress_percent
        }

        return result
      } catch (err: any) {
        this.error = err.data?.message ?? err.message ?? 'Erreur attaque.'
        return null
      } finally {
        this.attacking = false
      }
    },

    // ── Classement ────────────────────────────────────────────────────────
    async fetchLeaderboard(raid_id: string) {
      this.loading = true
      try {
        const { $api } = useNuxtApp() as any
        const data = await $api(`/raids/${raid_id}/leaderboard`)
        this.leaderboard = data.leaderboard ?? []
        this.my_rank = data.my_rank
        this.my_entry = data.my_entry
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    // ── Récompenses ───────────────────────────────────────────────────────
    async fetchPendingRewards() {
      try {
        const { $api } = useNuxtApp() as any
        this.pending_rewards = await $api('/raids/rewards')
      } catch { /* silencieux */ }
    },

    async collectReward(reward_id: string) {
      const { $api } = useNuxtApp() as any
      await $api(`/raids/rewards/${reward_id}/collect`, { method: 'POST' })
      this.pending_rewards = this.pending_rewards.filter((r) => r.id !== reward_id)
    },

    // ── Socket.io ────────────────────────────────────────────────────────
    joinRaidRoom(raid_id: string) {
      const { $socket } = useNuxtApp() as any
      if (!$socket) return
      $socket.emit('raid:join', raid_id)
    },

    leaveRaidRoom(raid_id: string) {
      const { $socket } = useNuxtApp() as any
      if (!$socket) return
      $socket.emit('raid:leave', raid_id)
    },

    handleHpUpdate(event: { hp_remaining: number; hp_total: number; progress_percent: number }) {
      if (this.current_raid) {
        this.current_raid.hp_remaining = event.hp_remaining
        this.current_raid.hp_total = event.hp_total
        this.current_raid.progress_percent = event.progress_percent
      }
    },

    handleRaidDefeated(event: { boss_name_fr: string; total_participants: number }) {
      if (this.current_raid) {
        // Le raid est vaincu — rafraîchir les récompenses
        this.fetchPendingRewards()
        this.fetchActiveRaids()
      }
    },

    handleNewRaid(event: { boss_name_fr: string; difficulty: string; ends_at: string; sprite_url: string }) {
      // Toast géré par le composant
      this.fetchActiveRaids()
    },
  },
})
