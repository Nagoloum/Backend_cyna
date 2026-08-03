# Cyna Backend

API du site e-commerce de cybersécurité **Cyna** : catalogue (catégories, services, produits), comptes clients, panier et commandes, abonnements avec licences, paiement Stripe, factures PDF, backoffice administrateur.

## Stack technique

| Outil | Rôle |
| --- | --- |
| NestJS 11 | Framework HTTP (Express) |
| Mongoose / MongoDB Atlas | Base de données |
| Stripe | Paiement (SetupIntent + PaymentIntent off-session, webhook signé) |
| Cloudinary | Stockage des images (produits, catégories, sliders) |
| PDFKit | Génération des factures PDF en mémoire |
| Nodemailer | Emails transactionnels (confirmation, commande, renouvellement...) |
| Winston | Journalisation (JSON en production) |
| Sentry | Remontée des erreurs (si `SENTRY_DSN` est défini) |
| Jest + Supertest | Tests unitaires et e2e |

## Prérequis

- Node.js 22 ou plus récent
- npm 9 ou plus récent
- Une base MongoDB accessible (Atlas ou locale)

## Installation

```bash
cd Backend_cyna
npm install
cp .env.example .env   # puis renseigner les valeurs
```

## Lancer en développement

```bash
npm run start:dev
```

L'API écoute sur <http://localhost:3000> avec le préfixe `/api`. La documentation Swagger est disponible sur <http://localhost:3000/api/docs> (désactivée par défaut en production).

## Commandes disponibles

| Commande | Description |
| --- | --- |
| `npm run start:dev` | Serveur de développement (watch) |
| `npm run build` | Compilation dans `dist/` |
| `npm run start:prod` | Démarrage du build compilé |
| `npm run lint` | Analyse ESLint (avec correction automatique) |
| `npm test` | Tests unitaires Jest |
| `npm run test:e2e` | Tests e2e (nécessite `DATABASE_URL`) |
| `npm run db:backup` | Sauvegarde MongoDB via mongodump (`scripts/backup.js`) |
| `npm run db:restore` | Restauration d'une archive (`scripts/restore.js`) |

Autres scripts utilitaires dans `scripts/` : `generate-vapid.js` (génère les clés push VAPID), `seed-categories.js` et `seed-products.js` (reconstruisent le catalogue de démonstration ; attention, `seed-products.js` supprime les produits existants), `upload-cloudinary-images.js` (réassigne les images Cloudinary du catalogue).

## Variables d'environnement

Toutes les variables sont documentées dans `.env.example` (base de données, secrets JWT access et refresh, SMTP, Cloudinary, Stripe, TVA, secret du cron, Sentry, clés VAPID). Aucune valeur réelle ne doit être commitée : en production, les valeurs sont saisies dans le dashboard Render.

## Sécurité

- CORS restreint aux origines de `FRONTEND_URL` (origines locales acceptées uniquement hors production).
- Helmet, `ValidationPipe` global avec whitelist (anti mass-assignment), cookies JWT httpOnly avec rotation du refresh token et révocation serveur.
- Rate limiting global (100 req/min/IP) et limites renforcées sur les endpoints sensibles (connexion, 2FA, inscription, contact, recherche).
- Filtre d'exceptions global : les messages métier (4xx) sont transmis, les erreurs techniques sont journalisées côté serveur et remplacées par un message générique. Aucune stack trace ni détail interne n'est renvoyé au client.
- Webhook Stripe vérifié par signature sur le corps brut de la requête.

## Déploiement

- **Production : Render** (process persistant). Le blueprint `render.yaml` décrit le service `cyna-api` (build, commande de démarrage, healthcheck `/api/health`, variables d'environnement à saisir dans le dashboard).
- **Cron des abonnements** : le workflow GitHub Actions `.github/workflows/cron-abonnements.yml` appelle chaque nuit `/api/cron/abonnements` (expiration des abonnements échus), protégé par `CRON_SECRET`. GitHub Actions doit être activé sur le dépôt pour que ce cron s'exécute.
- **CI** : `.github/workflows/ci.yml` (build + tests unitaires à chaque push sur `main`).
- **Alternative Docker** : `Dockerfile` multi-stage et `docker-compose.yml` (API + MongoDB locale) pour un hébergement conteneurisé, voir `DOCKER.md`.

## Structure du projet

```text
Backend_cyna/
├── src/
│   ├── features/           # Modules métier
│   │   ├── auth/           # Connexion, inscription, 2FA (email + TOTP), refresh
│   │   ├── users/          # Comptes, suspension (admin)
│   │   ├── categories/ services/ products/ sliders/   # Catalogue
│   │   ├── commandes/      # Commandes, abonnements, paiement, webhook Stripe, cron
│   │   ├── carte_bancaires/ adresse_facturations/     # Moyens de paiement, adresses
│   │   ├── coupons/        # Codes promotionnels
│   │   ├── contact/        # Formulaire de contact et réponses support
│   │   ├── audit/          # Journal d'audit (admin)
│   │   ├── push/           # Notifications push Web (VAPID)
│   │   └── search/         # Recherche avancée (agrégation MongoDB)
│   ├── health/             # Endpoint /api/health (healthcheck Render)
│   └── shared/             # Guards, filtres, DTO, services transverses
│       ├── filters/        # GlobalExceptionFilter
│       ├── guards/         # AuthGuard, AuthorizeGuard, CronGuard
│       └── services/       # Stripe, Cloudinary, emails, factures, analytics
├── scripts/                # Sauvegarde/restauration, seeds, clés VAPID
├── test/                   # Tests e2e (smoke health + products)
└── render.yaml             # Blueprint de déploiement Render
```

## Tests

```bash
npm test          # tests unitaires (coupons, tokens, guards, factures...)
npm run test:e2e  # smoke tests (ignorés si DATABASE_URL est absent)
```
