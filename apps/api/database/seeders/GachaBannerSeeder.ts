/**
 * GachaBannerSeeder — 4 bannières régionales (Alola, Galar, Hisui, Paldea).
 * Idempotent : ON CONFLICT (name_fr) DO UPDATE.
 */

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

// Species IDs pour chaque bannière (IDs des formes régionales importées)
const BANNERS = [
  {
    name_fr: 'Bannière Alola',
    region: 'alola',
    species_pool: [
      10091, 10092, 10093, 10094, 10095, 10096, 10097, 10098,
      10099, 10100, 10101, 10102, 10103, 10104, 10105, 10106,
      10107, 10108, 10109, 10110, 10111, 10112, 10113, 10114, 10115,
    ],
    // Rate-up : légendaires Alola (Raichu, Exécuteur, Ossatueur comme représentants)
    rate_up_species: [10100, 10114, 10115],
    is_active: true,
  },
  {
    name_fr: 'Bannière Galar',
    region: 'galar',
    species_pool: [
      10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168,
      10169, 10170, 10171, 10172, 10173, 10174, 10175, 10176,
      10177, 10178, 10179, 10180,
    ],
    // Rate-up : Oiseaux légendaires de Galar
    rate_up_species: [10169, 10170, 10171],
    is_active: true,
  },
  {
    name_fr: 'Bannière Hisui',
    region: 'hisui',
    species_pool: [
      10221, 10222, 10223, 10224, 10225, 10226, 10227, 10228,
      10229, 10230, 10231, 10232, 10233, 10234, 10235,
    ],
    // Rate-up : Pokémon Hisui emblématiques
    rate_up_species: [10221, 10225, 10235],
    is_active: true,
  },
  {
    name_fr: 'Bannière Paldea',
    region: 'paldea',
    species_pool: [10251, 10252, 10253, 10254],
    rate_up_species: [10253, 10254],
    is_active: true,
  },
]

export default class GachaBannerSeeder extends BaseSeeder {
  async run() {
    for (const banner of BANNERS) {
      await db.rawQuery(
        `
        INSERT INTO gacha_banners (name_fr, region, species_pool, rate_up_species, is_active)
        SELECT ?, ?, ?::jsonb, ?::jsonb, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM gacha_banners WHERE name_fr = ?
        )
        `,
        [
          banner.name_fr,
          banner.region,
          JSON.stringify(banner.species_pool),
          JSON.stringify(banner.rate_up_species),
          banner.is_active,
          banner.name_fr,
        ]
      )
    }

    console.log(`✓ ${BANNERS.length} bannières gacha régionales insérées`)
  }
}
