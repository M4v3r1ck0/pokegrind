/**
 * SwaggerController — Documentation API auto-générée (OpenAPI 3.0).
 * Accessible sur GET /api/docs (dev uniquement).
 */

import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'PokeGrind API',
    version: '3.0.0',
    description: 'API backend du jeu idle Pokémon PokeGrind.',
    contact: { email: 'admin@pokegrind.gg' },
  },
  servers: [{ url: '/api', description: 'API PokeGrind' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Player: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          gems: { type: 'integer' },
          gold: { type: 'integer' },
          current_floor: { type: 'integer' },
          prestige_level: { type: 'integer' },
        },
      },
      PokemonSpecies: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name_fr: { type: 'string' },
          type1: { type: 'string' },
          type2: { type: 'string', nullable: true },
          rarity: { type: 'string', enum: ['common', 'rare', 'epic', 'legendary', 'mythic'] },
        },
      },
      GachaPull: {
        type: 'object',
        properties: {
          species_id: { type: 'integer' },
          name_fr: { type: 'string' },
          rarity: { type: 'string' },
          is_shiny: { type: 'boolean' },
          ivs: {
            type: 'object',
            properties: {
              hp: { type: 'integer' }, atk: { type: 'integer' }, def: { type: 'integer' },
              spatk: { type: 'integer' }, spdef: { type: 'integer' }, speed: { type: 'integer' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        summary: 'Créer un compte',
        tags: ['Auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 32 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Compte créé', content: { 'application/json': { schema: { properties: { access_token: { type: 'string' } } } } } },
          422: { description: 'Validation échouée', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Connexion email/mot de passe',
        tags: ['Auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Connexion réussie — retourne access_token + refresh_token (cookie)' },
          401: { description: 'Identifiants invalides' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rafraîchir le token JWT',
        tags: ['Auth'],
        responses: {
          200: { description: 'Nouveau access_token' },
          401: { description: 'Refresh token invalide ou expiré' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Déconnexion',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Déconnecté' } },
      },
    },
    // ── Gacha ─────────────────────────────────────────────────────────────────
    '/gacha/pull': {
      post: {
        summary: 'Effectuer des pulls gacha',
        tags: ['Gacha'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['count'],
                properties: {
                  count: { type: 'integer', enum: [1, 10] },
                  banner_id: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Résultats des pulls',
            content: { 'application/json': { schema: { type: 'object', properties: { pulls: { type: 'array', items: { $ref: '#/components/schemas/GachaPull' } } } } } },
          },
          400: { description: 'Or insuffisant' },
        },
      },
    },
    '/gacha/pity': {
      get: {
        summary: 'Consulter le compteur de pity',
        tags: ['Gacha'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Compteurs pity epic et legendary' },
        },
      },
    },
    // ── Combat ────────────────────────────────────────────────────────────────
    '/combat/start': {
      post: {
        summary: 'Démarrer une session de combat idle',
        tags: ['Combat'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Session de combat démarrée' },
          400: { description: "Équipe vide ou déjà en combat" },
        },
      },
    },
    '/combat/status': {
      get: {
        summary: "État de la session de combat",
        tags: ['Combat'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'État actuel du combat (étage, HP ennemis, etc.)' } },
      },
    },
    // ── Player ────────────────────────────────────────────────────────────────
    '/player/me': {
      get: {
        summary: 'Profil du joueur connecté',
        tags: ['Player'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Données joueur', content: { 'application/json': { schema: { $ref: '#/components/schemas/Player' } } } } },
      },
    },
    '/player/pokemon': {
      get: {
        summary: 'Collection de Pokémon du joueur',
        tags: ['Player'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Liste paginée des Pokémon' } },
      },
    },
    // ── Raids ─────────────────────────────────────────────────────────────────
    '/raids/active': {
      get: {
        summary: 'Raid mondial actif',
        tags: ['Raids'],
        responses: { 200: { description: 'Données du raid actif (HP, participants, boss)' } },
      },
    },
    '/raids/:id/attack': {
      post: {
        summary: 'Attaquer le raid mondial',
        tags: ['Raids'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Dégâts infligés' },
          429: { description: 'Cooldown non expiré' },
        },
      },
    },
    // ── Tour Infinie ──────────────────────────────────────────────────────────
    '/tower/start': {
      post: {
        summary: 'Démarrer une session Tour Infinie',
        tags: ['Tour Infinie'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Session Tour démarrée' } },
      },
    },
    '/tower/season': {
      get: {
        summary: 'Saison Tour Infinie active',
        tags: ['Tour Infinie'],
        responses: { 200: { description: 'Données de la saison actuelle et classement' } },
      },
    },
    // ── Donjons ───────────────────────────────────────────────────────────────
    '/dungeons': {
      get: {
        summary: 'Liste des donjons disponibles',
        tags: ['Donjons'],
        responses: { 200: { description: 'Liste des donjons actifs' } },
      },
    },
    '/dungeons/:id/start': {
      post: {
        summary: 'Commencer un donjon',
        tags: ['Donjons'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Run de donjon commencé' },
          400: { description: 'Équipe insuffisante ou donjon inactif' },
        },
      },
    },
  },
}

export default class SwaggerController {
  /**
   * GET /api/docs — Documentation OpenAPI (dev uniquement)
   */
  async index({ response }: HttpContext) {
    if (env.get('NODE_ENV') === 'production') {
      return response.notFound({ message: 'Documentation non disponible en production' })
    }

    // Retourner le HTML Swagger UI
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>PokeGrind API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/spec',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    })
  </script>
</body>
</html>`

    response.header('Content-Type', 'text/html')
    return response.ok(html)
  }

  /**
   * GET /api/docs/spec — Spec OpenAPI JSON
   */
  async spec({ response }: HttpContext) {
    if (env.get('NODE_ENV') === 'production') {
      return response.notFound({ message: 'Non disponible en production' })
    }
    return response.ok(OPENAPI_SPEC)
  }
}
