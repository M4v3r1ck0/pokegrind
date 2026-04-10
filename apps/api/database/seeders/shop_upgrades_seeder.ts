import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default class ShopUpgradesSeeder extends BaseSeeder {
  async run() {
    const upgrades = [
      // Pension
      {
        id: 1,
        category: 'pension',
        name_fr: 'Slot Pension #6',
        description_fr: 'Débloque le 6ème emplacement de pension.',
        cost_gems: 50,
        effect_type: 'daycare_slot',
        effect_value: JSON.stringify({ slot: 6 }),
        requires_upgrade_id: null,
      },
      {
        id: 2,
        category: 'pension',
        name_fr: 'Slot Pension #7',
        description_fr: 'Débloque le 7ème emplacement de pension.',
        cost_gems: 120,
        effect_type: 'daycare_slot',
        effect_value: JSON.stringify({ slot: 7 }),
        requires_upgrade_id: 1,
      },
      {
        id: 3,
        category: 'pension',
        name_fr: 'Auto-collect',
        description_fr: 'Les Pokémon éclos en pension sont automatiquement collectés dans votre boîte.',
        cost_gems: 200,
        effect_type: 'auto_collect',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: 1,
      },
      {
        id: 4,
        category: 'pension',
        name_fr: 'Slot Pension #8',
        description_fr: 'Débloque le 8ème emplacement de pension.',
        cost_gems: 250,
        effect_type: 'daycare_slot',
        effect_value: JSON.stringify({ slot: 8 }),
        requires_upgrade_id: 2,
      },
      {
        id: 5,
        category: 'pension',
        name_fr: "File d'attente",
        description_fr: "Permet de mettre des Pokémon en file d'attente pour la pension.",
        cost_gems: 400,
        effect_type: 'daycare_queue',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: 3,
      },
      {
        id: 6,
        category: 'pension',
        name_fr: 'Slot Pension #9',
        description_fr: 'Débloque le 9ème emplacement de pension.',
        cost_gems: 500,
        effect_type: 'daycare_slot',
        effect_value: JSON.stringify({ slot: 9 }),
        requires_upgrade_id: 4,
      },
      {
        id: 7,
        category: 'pension',
        name_fr: 'Slot Pension #10',
        description_fr: 'Débloque le 10ème emplacement de pension (maximum).',
        cost_gems: 800,
        effect_type: 'daycare_slot',
        effect_value: JSON.stringify({ slot: 10 }),
        requires_upgrade_id: 6,
      },
      // Gacha
      {
        id: 8,
        category: 'gacha',
        name_fr: 'Pity réduit',
        description_fr: 'Réduit le pity des Légendaires de 200 à 180 invocations.',
        cost_gems: 100,
        effect_type: 'pity_legendary',
        effect_value: JSON.stringify({ from: 200, to: 180 }),
        requires_upgrade_id: null,
      },
      {
        id: 9,
        category: 'gacha',
        name_fr: 'Filtre de vente',
        description_fr: 'Permet de filtrer les Pokémon à vendre par rareté et type.',
        cost_gems: 60,
        effect_type: 'sell_filter',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: null,
      },
      {
        id: 10,
        category: 'gacha',
        name_fr: 'Tri avancé',
        description_fr: 'Tri avancé de la collection par IVs, nature, génération.',
        cost_gems: 80,
        effect_type: 'advanced_sort',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: 9,
      },
      {
        id: 11,
        category: 'gacha',
        name_fr: 'Pokédex étendu',
        description_fr: 'Affiche des informations détaillées sur chaque espèce dans le Pokédex.',
        cost_gems: 120,
        effect_type: 'extended_dex',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: null,
      },
      {
        id: 12,
        category: 'gacha',
        name_fr: 'Historique pulls',
        description_fr: 'Consulter les 200 dernières invocations.',
        cost_gems: 60,
        effect_type: 'pull_history',
        effect_value: JSON.stringify({ count: 200 }),
        requires_upgrade_id: null,
      },
      // Combat
      {
        id: 13,
        category: 'combat',
        name_fr: 'Équipes sauvegardées',
        description_fr: 'Sauvegarde jusqu\'à 5 compositions d\'équipe pour les réutiliser rapidement.',
        cost_gems: 80,
        effect_type: 'saved_teams',
        effect_value: JSON.stringify({ count: 5 }),
        requires_upgrade_id: null,
      },
      {
        id: 14,
        category: 'combat',
        name_fr: 'Swap rapide',
        description_fr: 'Permet de changer d\'équipe en un clic depuis le combat.',
        cost_gems: 120,
        effect_type: 'quick_swap',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: 13,
      },
      {
        id: 15,
        category: 'combat',
        name_fr: '5ème emplacement move',
        description_fr: 'Ajoute un 5ème slot de move à tous vos Pokémon.',
        cost_gems: 500,
        effect_type: 'move_slot_5',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: null,
      },
      {
        id: 16,
        category: 'combat',
        name_fr: 'Simulateur DPS',
        description_fr: 'Simulateur de DPS pour comparer différentes compositions.',
        cost_gems: 100,
        effect_type: 'dps_simulator',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: null,
      },
      {
        id: 17,
        category: 'combat',
        name_fr: 'Profils de moveset',
        description_fr: 'Sauvegarde 3 profils de movesets par Pokémon.',
        cost_gems: 120,
        effect_type: 'moveset_profiles',
        effect_value: JSON.stringify({ count: 3 }),
        requires_upgrade_id: 16,
      },
      {
        id: 18,
        category: 'combat',
        name_fr: 'Mode Farm auto',
        description_fr: 'L\'équipe recommence automatiquement au dernier étage clearedé au démarrage.',
        cost_gems: 150,
        effect_type: 'auto_farm',
        effect_value: JSON.stringify({}),
        requires_upgrade_id: null,
      },
    ]

    // Insert in order (respecting requires_upgrade_id FK chain)
    for (const upgrade of upgrades) {
      await db
        .knexQuery()
        .table('shop_upgrades')
        .insert(upgrade)
        .onConflict('id')
        .merge()
    }

    console.log(`✓ ${upgrades.length} améliorations boutique gems insérées`)
  }
}
