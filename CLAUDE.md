# CLAUDE.md — PokeGrind
> Fichier de référence architecte pour Claude Code.
> **Lire ce fichier intégralement avant chaque session de travail.**
> Toute décision technique se réfère à ce document. Ne jamais déroger sans signaler le conflit.

---

## 1. Identité du projet

**PokeGrind** est un jeu idle Pokémon jouable en navigateur.
- Combat automatique — l'équipe de 6 Pokémon, les movesets, les IVs et les items créent la profondeur stratégique.
- Les gems permettent de débloquer des améliorations de confort de jeu (jamais de pay-to-win).
- GDD de référence : `docs/GDD_v3.4.md` (copie du document officiel).
- **Langue du jeu : Français uniquement** pour le MVP. Toutes les strings UI sont en français.

---

## 1.5 Direction artistique — DÉCISIONS DÉFINITIVES

**Style cible : Animé/manga coloré — style Pokémon classique (Gen 4-5 era)**

### Palette de couleurs (à respecter dans tous les composants)
```css
/* Variables CSS globales — à définir dans apps/web/assets/css/design-tokens.css */

/* Fonds */
--color-bg-primary:    #1a1c2e;   /* bleu nuit profond */
--color-bg-secondary:  #252742;   /* carte/panel */
--color-bg-tertiary:   #2f3259;   /* éléments surélevés */
--color-bg-overlay:    rgba(26, 28, 46, 0.92);

/* Accents principaux */
--color-accent-yellow: #ffd700;   /* jaune Pokémon iconic */
--color-accent-red:    #e63946;   /* rouge Pokéball */
--color-accent-blue:   #4fc3f7;   /* bleu clair énergique */
--color-accent-purple: #9c6ade;   /* violet prestige/légendaire */

/* Rarités Pokémon */
--color-rarity-common:    #a8b5c2;  /* gris argent */
--color-rarity-rare:      #4fc3f7;  /* bleu clair */
--color-rarity-epic:      #c678dd;  /* violet */
--color-rarity-legendary: #ffd700;  /* or */
--color-rarity-mythic:    #ff6b9d;  /* rose/fuchsia */
--color-rarity-shiny:     #ffe066;  /* or brillant */

/* Texte */
--color-text-primary:   #f0f0f0;
--color-text-secondary: #a0aec0;
--color-text-muted:     #6b7a99;
--color-text-accent:    #ffd700;

/* Types Pokémon */
--type-fire:     #ff6b35;
--type-water:    #4fc3f7;
--type-grass:    #56c96d;
--type-electric: #ffd700;
--type-psychic:  #ff6b9d;
--type-ice:      #96d9e8;
--type-dragon:   #6c5ce7;
--type-dark:     #4a4a6a;
--type-fairy:    #ffb3d9;
--type-fighting: #d4522a;
--type-poison:   #a855c8;
--type-ground:   #c8a85e;
--type-rock:     #8b7355;
--type-bug:      #91b800;
--type-ghost:    #6c5ce7;
--type-steel:    #8fa8c8;
--type-normal:   #a8a878;
--type-flying:   #89aadc;
```

### Typographie
```css
/* Police principale : Nunito (Google Fonts — ronde et lisible, style manga) */
/* Police accent/titres : Bangers (Google Fonts — impact, style comics) */
--font-primary: 'Nunito', sans-serif;
--font-display: 'Bangers', cursive;   /* titres de section, noms de boss */
```

### Règles de design à appliquer PARTOUT
1. **Cartes avec bordure colorée** selon la rareté du contenu (glow effect CSS)
2. **Sprites Pokémon** : toujours affichés à 96×96px minimum, jamais pixelisés (image-rendering: pixelated UNIQUEMENT si sprite est intentionnellement rétro)
3. **Barres HP** : dégradé vert→jaune→rouge selon le pourcentage restant + animation smooth
4. **Badges de type** : petites pastilles colorées arrondies avec la couleur `--type-*`
5. **Boutons** : gradient subtle, légère ombre portée, hover avec scale(1.02)
6. **Fond global** : gradient radial très subtil depuis `--color-bg-primary`
7. **Animations** : préférer `transition: all 0.2s ease` — fluide mais pas lent
8. **Icônes** : utiliser Lucide Vue ou Heroicons — cohérence sur tout le projet

### Composants à créer dans apps/web/components/ui/ (Sprint 19)
- `PokemonCard.vue` — carte Pokémon avec sprite, rareté, types, IVs, étoiles
- `HpBar.vue` — barre HP animée avec couleur dynamique
- `TypeBadge.vue` — badge de type coloré
- `RarityBadge.vue` — badge de rareté avec glow
- `GemCounter.vue` — compteur gems animé
- `StarRating.vue` — affichage des étoiles pension (★★★☆☆)
- `CombatLog.vue` — log de combat scrollable avec couleurs d'efficacité
- `PrestigeBadge.vue` — badge prestige avec effet brillant
- `Modal.vue` — modal réutilisable avec backdrop blur
- `Toast.vue` — notifications toast animées (gain gems, drop item, etc.)

### Sprint 19 — Visual Polish (dernier sprint)
Dédié exclusivement à :
- Implémenter le design system complet (design-tokens.css)
- Refaire chaque page avec la palette et les composants UI
- Ajouter les animations de combat (barres HP, sprites, effets statut)
- Page d'accueil / landing attractive
- Responsive mobile (breakpoints Tailwind)
- Performance : lazy loading sprites, skeleton loaders
- Easter eggs visuels (confetti sur éclosion shiny, flash Méga-Évolution)

---

## 2. Stack technique — DÉCISIONS DÉFINITIVES

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | AdonisJS | 6.x (TypeScript natif) |
| ORM | Lucid ORM | intégré AdonisJS 6 |
| Auth | @adonisjs/auth | Email/password + Discord OAuth |
| Frontend jeu | Nuxt 3 + Vue 3 + Pinia | latest stable |
| Frontend admin | Vue 3 + Vuestic Admin | latest stable |
| UI jeu | TailwindCSS v4 + composants custom | Dark RPG |
| Base de données | PostgreSQL | 16+ |
| Cache / Sessions | Redis | 7+ |
| WebSocket | Socket.io | via AdonisJS |
| Jobs async | AdonisJS Scheduler + BullMQ | — |
| Notifications push | Web Push API (serveur) + Service Worker (client) | natif navigateur |
| Deploy | Docker Compose → CT Proxmox | — |

### Règles absolues stack
- **Zéro calcul de ressources côté client.** Toute logique de combat, gains, progression = serveur uniquement.
- **Anti-triche total** — le client ne reçoit que les résultats, jamais les formules de calcul intermédiaires.
- **Zero reset joueur** — chaque mise à jour = migration Lucid versionnée. Jamais de truncate en production.
- **TypeScript strict** partout — `"strict": true` dans tsconfig.

---

## 3. Structure du projet

```
pokegrind/
├── apps/
│   ├── api/                  # AdonisJS 6 backend
│   │   ├── app/
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   ├── services/     # logique métier (combat, gacha, pension...)
│   │   │   ├── jobs/         # BullMQ jobs (offline calc, notifications...)
│   │   │   └── middleware/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── seeders/
│   │   └── config/
│   ├── web/                  # Nuxt 3 frontend jeu
│   │   ├── pages/
│   │   ├── components/
│   │   ├── stores/           # Pinia stores
│   │   └── public/
│   └── admin/                # Vue 3 + Vuestic Admin
│       ├── src/
│       └── vite.config.ts
├── packages/
│   └── shared/               # types TypeScript partagés API ↔ frontend
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
├── docs/
│   └── GDD_v3.4.md
├── scripts/
│   └── import-pokeapi.ts     # import PokéAPI one-shot
└── CLAUDE.md                 # ce fichier
```

---

## 4. Base de données — Schéma complet

### Tables core (MVP)

```sql
-- Joueurs
players (
  id uuid PK,
  username varchar(32) UNIQUE NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255),
  discord_id varchar(64) UNIQUE,
  gems integer DEFAULT 0,
  gold bigint DEFAULT 0,
  frontier_points integer DEFAULT 0,
  current_floor integer DEFAULT 1,
  last_seen_at timestamp,
  created_at timestamp,
  updated_at timestamp
)

-- Pokémon espèces (importé PokéAPI)
pokemon_species (
  id integer PK,             -- national dex number
  name_fr varchar(64) NOT NULL,
  name_en varchar(64) NOT NULL,
  type1 varchar(16) NOT NULL,
  type2 varchar(16),
  base_hp integer, base_atk integer, base_def integer,
  base_spatk integer, base_spdef integer, base_speed integer,
  rarity varchar(16) NOT NULL,  -- common/rare/epic/legendary/mythic
  generation integer NOT NULL,
  capture_rate integer,
  egg_groups jsonb,
  evolves_from_id integer REFERENCES pokemon_species(id),
  sprite_url varchar(512),      -- PokeAPI CDN
  sprite_shiny_url varchar(512),
  sprite_fallback_url varchar(512),  -- Showdown fallback
  created_at timestamp
)

-- Pokémon d'un joueur (instances)
player_pokemon (
  id uuid PK,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  species_id integer REFERENCES pokemon_species(id),
  nickname varchar(32),
  level integer DEFAULT 1,
  is_shiny boolean DEFAULT false,
  stars integer DEFAULT 0,        -- 0 à 5 (pension)
  nature varchar(32) NOT NULL,
  iv_hp integer, iv_atk integer, iv_def integer,
  iv_spatk integer, iv_spdef integer, iv_speed integer,
  equipped_item_id integer,
  slot_team integer,              -- NULL si pas en équipe, 1-6
  slot_daycare integer,           -- NULL si pas en pension
  hidden_talent_move_id integer,  -- NULL si pas de talent caché
  created_at timestamp
)

-- Movesets d'un Pokémon joueur
player_pokemon_moves (
  id uuid PK,
  player_pokemon_id uuid REFERENCES player_pokemon(id) ON DELETE CASCADE,
  slot integer NOT NULL,          -- 1 à 4 (5 avec amélioration gems)
  move_id integer REFERENCES moves(id),
  pp_current integer NOT NULL,
  pp_max integer NOT NULL
)

-- Moves (importé PokéAPI)
moves (
  id integer PK,
  name_fr varchar(64) NOT NULL,
  name_en varchar(64) NOT NULL,
  type varchar(16) NOT NULL,
  category varchar(16) NOT NULL,  -- physical/special/status
  power integer,
  accuracy integer,
  pp integer,
  priority integer DEFAULT 0,
  effect_id integer REFERENCES move_effects(id)
)

-- Effets de moves
move_effects (
  id integer PK,
  effect_type varchar(32),        -- burn/poison/paralysis/sleep/freeze/confusion/stat_change
  stat_target varchar(16),        -- atk/def/spatk/spdef/speed/hp
  stat_change integer,            -- -2 à +2
  target varchar(16),             -- self/opponent
  duration_min integer,
  duration_max integer,
  chance_percent integer DEFAULT 100
)

-- Learnsets
pokemon_learnset (
  species_id integer REFERENCES pokemon_species(id),
  move_id integer REFERENCES moves(id),
  learn_method varchar(16),       -- level/tm/hm/egg/tutor/hidden_talent
  level_learned_at integer,
  PRIMARY KEY (species_id, move_id, learn_method)
)

-- Pension (daycare)
daycare_slots (
  id uuid PK,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,   -- 1 à 10 max
  player_pokemon_id uuid REFERENCES player_pokemon(id),
  damage_accumulated bigint DEFAULT 0,
  partner_pokemon_id uuid REFERENCES player_pokemon(id),  -- pour dressage
  started_at timestamp,
  PRIMARY KEY (player_id, slot_number)
)

-- Boutique gems — catalogue
shop_upgrades (
  id integer PK,
  category varchar(32) NOT NULL,  -- pension/gacha/combat/cosmetic
  name_fr varchar(128) NOT NULL,
  description_fr text,
  cost_gems integer NOT NULL,
  effect_type varchar(64) NOT NULL,
  effect_value jsonb,
  requires_upgrade_id integer REFERENCES shop_upgrades(id)
)

-- Améliorations achetées par joueur
player_upgrades (
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id integer REFERENCES shop_upgrades(id),
  purchased_at timestamp,
  PRIMARY KEY (player_id, upgrade_id)
)

-- Audit gems
gems_audit (
  id uuid PK,
  player_id uuid REFERENCES players(id),
  amount integer NOT NULL,        -- positif = gain, négatif = dépense
  reason varchar(128) NOT NULL,
  source varchar(64),             -- boss_first/region_complete/pvp/bf/...
  created_at timestamp
)

-- Rapports offline
offline_reports (
  id uuid PK,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  gold_earned bigint,
  xp_earned bigint,
  kills integer,
  hatches integer,
  drops_json jsonb,
  absence_seconds integer,
  floor_farmed integer,
  created_at timestamp
)

-- Abonnements push
push_subscriptions (
  id uuid PK,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  endpoint varchar(1024) NOT NULL,
  keys jsonb NOT NULL,
  notification_prefs_json jsonb DEFAULT '{}',
  created_at timestamp
)

-- Audit panel admin
admin_audit_log (
  id uuid PK,
  admin_id uuid REFERENCES players(id),
  action varchar(128) NOT NULL,
  target_type varchar(32),
  target_id varchar(64),
  payload jsonb,
  created_at timestamp
)

-- Battle Frontier rotations
bf_rotations (
  id uuid PK,
  mode varchar(32) NOT NULL,     -- tower/factory/arena
  tier_restriction jsonb,
  rules_json jsonb,
  start_at timestamp NOT NULL,
  end_at timestamp NOT NULL
)

-- Battle Frontier leaderboard
bf_leaderboard (
  rotation_id uuid REFERENCES bf_rotations(id),
  player_id uuid REFERENCES players(id),
  score integer DEFAULT 0,
  rank integer,
  updated_at timestamp,
  PRIMARY KEY (rotation_id, player_id)
)
```

---

## 5. Décisions de gameplay — RÈGLES DÉFINITIVES

### Équipe
- **6 Pokémon maximum, non extensible.** Aucun slot d'équipe dans la boutique gems.
- Un Pokémon en pension ne peut pas être en équipe simultanément.

### Combat idle
- Timing action = `3000ms ÷ (Speed ÷ 100)`
- 4 moves en boucle fixe M1→M2→M3→M4 (5 avec amélioration gems 500💎)
- Les 6 Pokémon agissent en parallèle selon leur Speed propre
- PP vides → skip vers move suivant
- **Formule dégâts** : `((2×Niveau/5+2) × Puissance × Stat_off/Stat_def) / 50 + 2 × Efficacité_type × STAB(×1.5 si applicable) × Critique(×1.5, chance 1/24)`
- STAB : move du même type que le Pokémon → ×1.5
- Efficacité type : ×2 super efficace, ×0.5 peu efficace, ×0 immunité, double type → ×4 ou ×0.25

### Offline
- **Farming fixé sur le dernier étage clearedé** — l'équipe ne progresse pas hors connexion.
- Cap à 24h de calcul offline maximum.
- Rapport affiché automatiquement à reconnexion si absence > 5 minutes.
- Calcul : DPS moyen de l'équipe × temps absent × taux de drop de l'étage.
- Bouton "Récupérer" → applique les gains en BDD et ferme le rapport.
- Historique des 10 derniers rapports consultable depuis le profil.

### Gacha & Pity
| Rareté | Taux | IVs garantis | Pity |
|--------|------|--------------|------|
| Commun | 55% | Aléatoires 0-31 | — |
| Rare | 33% | Aléatoires 0-31 | — |
| Épique | 9% | 1 IV à 20+ garanti | 50 pulls |
| Légendaire | 2.5% | 3 IVs à 31 | 200 pulls (180 avec amélioration) |
| Mythique | 0.5% | 5 IVs à 31 | Events uniquement |
| ✨ Shiny | 1/8192 | 3 IVs à 31 min. | — |

### Pension
- Seuils d'éclosion : Commun 500K dégâts / Rare 1M / Épique 2M / Légendaire 5M
- 5★ : 1/200 chance d'éclosion shiny
- Talent Caché : 0.5% par éclosion
- L'équipe active génère des dégâts → alimente tous les slots pension actifs

### Gems
- **Farm-only, jamais achetables.** Équité totale entre tous les joueurs.
- Sources : boss 1ère fois (2💎), région complète (10💎), Pokédex gen (15💎), BF Top10 (5💎/semaine), ELO PvP (10💎/palier), succès (1-10💎), events, milestones kills.

---

## 6. Sprites — Stratégie

```
Source principale : https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png
Shiny : https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/{id}.png
Fallback (si 404) : https://play.pokemonshowdown.com/sprites/gen5/{name_en_lowercase}.png
Fallback shiny : https://play.pokemonshowdown.com/sprites/gen5-shiny/{name_en_lowercase}.png
```

Toujours stocker les deux URLs en BDD (`sprite_url` + `sprite_fallback_url`).
Le frontend tente la principale et bascule sur le fallback en `@error`.

---

## 7. Authentification

- **Email + mot de passe** via `@adonisjs/auth` + Lucid (provider `db`)
- **Discord OAuth** via `@adonisjs/ally`
- Pas de session serveur — JWT tokens (access token 15min + refresh token 30 jours en httpOnly cookie)
- Middleware `auth` sur toutes les routes `/api/player/*` et `/api/game/*`
- Middleware `role` (admin/mod/support) sur toutes les routes `/admin/*`

---

## 8. Sécurité & Anti-triche

- **Zéro calcul ressource côté client** — le serveur est la seule source de vérité.
- Rate limiting Redis sur toutes les routes sensibles (login, gacha, combat actions).
- Validation Zod/VineJS sur tous les inputs entrants.
- Logs de toutes les transactions gems dans `gems_audit`.
- Alertes admin automatiques : DPS anormal, gains gems suspects.
- Sessions invalidées côté serveur sur ban/suspension.

---

## 9. Roadmap implémentation

### V1 — MVP (sprints 0 à 7)

| Sprint | Contenu |
|--------|---------|
| **S0** | Scaffold : AdonisJS 6 + Nuxt 3 + Vue 3 admin + PostgreSQL + Redis + Docker Compose + HTTPS |
| **S1** | Import PokéAPI : 1025 espèces + stats + learnsets + moves + effets + sprites |
| **S2** | Auth (email/password + Discord OAuth) + modèle joueur + inventaire Pokémon + gacha de base + pity |
| **S3** | Système de combat idle (formules, movesets, statuts, étages, boss) |
| **S4** | Pension : slots, dressage, éclosion, Talent Caché, auto-collect |
| **S5** | Rapport offline + calcul serveur + Notifications push Web API |
| **S6** | Boutique gems V1 + économie + audit |
| **S7** | Panel admin V1 (dashboard, gestion joueurs, audit gems, logs) + déploiement Proxmox |

### V2 — Contenu (mois 3-5)
Battle Frontier complet, PvP ELO, items équipables, formes régionales, Méga-Évolutions, gems V2.

### V3 — Endgame infini (mois 6-10)
Prestige 50 niveaux, Tour Infinie, Donjons Ancestraux, Raids Mondiaux, Gigantamax.

---

## 10. Conventions de code

- **TypeScript strict** partout — pas de `any`, pas de `@ts-ignore`.
- Nommage : `camelCase` pour variables/fonctions, `PascalCase` pour types/interfaces/classes, `snake_case` pour colonnes BDD.
- Toutes les strings UI en **français**.
- Chaque service métier dans `apps/api/app/services/` — pas de logique dans les controllers.
- Controllers = validation entrée + appel service + réponse HTTP. C'est tout.
- Tests unitaires sur les formules de combat et les calculs offline (Japa/Vitest).
- Migrations Lucid pour chaque changement de schéma — jamais d'ALTER manuel.
- Commits en anglais, format conventionnel : `feat:`, `fix:`, `chore:`, `docs:`.

---

## 11. Variables d'environnement requises

```env
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/pokegrind

# Redis
REDIS_URL=redis://redis:6379

# Auth
APP_KEY=                    # adonisjs app key (openssl rand -hex 32)
JWT_SECRET=                 # openssl rand -hex 32

# Discord OAuth
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=https://pokegrind.gg/auth/discord/callback

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@pokegrind.gg

# App
NODE_ENV=production
PORT=3333
FRONTEND_URL=https://pokegrind.gg
ADMIN_URL=https://admin.pokegrind.gg
```

---

## 12. Notes importantes pour Claude Code

1. **Toujours lire ce fichier en premier** avant d'écrire du code.
2. Si une décision du GDD contredit ce fichier → **ce fichier fait foi**.
3. Ne jamais créer de route qui expose des formules de calcul ou des données brutes de combat côté client.
4. Chaque migration doit être idempotente et inclure un `down()` propre.
5. L'import PokéAPI (S1) est un script one-shot — il doit être idempotent (upsert, pas insert).
6. Le panel admin est sur `/admin` — middleware IP whitelist recommandé en production.
7. Ne jamais truncate une table qui contient des données joueurs sans confirmation explicite.
8. **Gems** : toute transaction gems (gain ou dépense) DOIT créer une entrée dans `gems_audit`. Sans exception.
