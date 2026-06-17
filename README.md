# MAM — Mail Alias Manager

Application web mono-utilisateur pour gérer les alias email OVH.

```bash
npm install && npm start
# → http://127.0.0.1:3000
```

## Stack

| Technologie | Version | Rôle |
|---|---|---|
| **Express** | 5.2.1 | Framework web |
| **EJS** | 3.1 | Moteur de templates |
| **TailwindCSS** | 4.3 | CSS utility-first (CLI, pas PostCSS) |
| **Node.js** | ≥20 | Runtime |
| **Stockage** | — | JSON Store (fichier, pas de base de données) |

5 dépendances runtime, 3 devDependencies.

## Fonctionnalités

### Epic 1 — Gérer ses alias
- ✅ **Lister** les alias dans un tableau (7 colonnes, responsive)
- ✅ **Créer** un alias (modal avec From, To, Description, Tags, Statut)
- ✅ **Modifier** un alias (destination, description, tags, statut)
- ✅ **Supprimer** un alias (OVH + blacklist, force locale si OVH échoue)
- ✅ **Activer/désactiver** un alias (supprime/recrée sur OVH)
- ✅ **Alias temporaire** 7/14/30 jours avec badge jours restants
- ✅ **Tags** libres (max 10, séparés par virgule)
- ✅ **Sync automatique** au démarrage et périodique (5 min)
- ✅ **Sync manuelle** avec modale de discrepancy (local-only / OVH-only / synced)
- ✅ **Multi-domaines** — sélecteur avec filtre temps réel
- ✅ **Thème dark/light** Solarized, persisté dans localStorage

### Epic 2 — Créer vite et retrouver
- ✅ **Générateur d'alias** trilingue (fr/en/es/mashup) — 55 adjectifs × 55 noms
- ✅ **Quick alias** — créer un alias en 2 clics depuis la top bar
- ✅ **Recherche temps réel** (debounced 150ms) sur from/domain/to/description/tags
- ✅ **Tri par colonne** ▲/▼ (3 états : asc/desc/none, persisté après CRUD)

### Epic 3 — API + déploiement
- ✅ **API REST** protégée par `X-Api-Key` (POST/PUT/DELETE /api/alias)
- ✅ **Quick alias** via API (`POST /api/alias/quick`)
- ✅ **Rate limiting** OVH avec retry exponentiel + header `Retry-After`
- ✅ **Service systemd** (`mam.service`)
- ✅ **Reverse proxy Caddy** (`Caddyfile`)

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer (build CSS + serveur)
npm start
```

L'application écoute sur `http://127.0.0.1:3000`.

## Configuration

Copier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Variables disponibles :

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `OVH_APPLICATION_KEY` | — | Clé API OVH |
| `OVH_APPLICATION_SECRET` | — | Secret API OVH |
| `OVH_CONSUMER_KEY` | — | Consumer key OVH |
| `OVH_DOMAINS` | `toto.fr,example.com` | Domaines séparés par virgule |
| `API_KEY` | — | Clé pour l'endpoint API |
| `NODE_ENV` | `development` | Mode production = messages d'erreur masqués |
| `DRY_RUN` | `true` | `true` = pas d'appels OVH réels |
| `SYNC_INTERVAL` | `300000` | Intervalle sync périodique (ms) |

### Mode dry-run

Par défaut (`DRY_RUN=true`), les appels OVH sont simulés. Pas besoin de credentials OVH pour développer ou tester l'interface.

Pour tester avec OVH réel :

```bash
DRY_RUN=false npm start
```

## API REST

Tous les endpoints API nécessitent le header `X-Api-Key` (valeur définie dans `.env`).

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/alias` | Créer un alias |
| `PUT` | `/api/alias/:id` | Modifier un alias |
| `DELETE` | `/api/alias/:id` | Supprimer un alias |
| `POST` | `/api/alias/quick` | Quick alias (from généré aléatoirement) |
| `POST` | `/api/alias/sync` | Déclencher une sync manuelle |

Format réponse :

```json
// Succès
{ "success": true, "data": { ... } }

// Erreur
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

Exemple :

```bash
curl -X POST http://localhost:3000/api/alias \
  -H 'X-Api-Key: votre-clé' \
  -H 'Content-Type: application/json' \
  -d '{"domain":"toto.fr","from":"contact","to":"dest@example.com"}'
```

## Déploiement production

### systemd

```bash
sudo cp mam.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mam
```

### Caddy

Déposer le `Caddyfile` et ajuster le domaine. Le reverse proxy :

- Transmet `/api/*` vers le backend Express
- Bloque l'accès public à l'UI (localhost uniquement)
- Masque le header `X-Api-Key` des logs

```bash
sudo cp Caddyfile /etc/caddy/
sudo systemctl reload caddy
```

## Structure du projet

```
mam/
├── app.js                  # Entry point Express
├── bin/www                 # Démarrage serveur
├── config/
│   ├── AppError.js         # Classe d'erreur métier
│   ├── index.js            # Configuration (.env)
│   ├── logger.js           # Utilitaire de logging
│   └── ovh.js              # Client API OVH
├── db/
│   ├── index.js            # JSON Store (lecture/écriture atomique)
│   └── lock.js             # Lock fichier pour writes concurrents
├── services/
│   ├── alias.service.js    # CRUD alias
│   ├── generator.js        # Générateur d'alias aléatoire
│   └── sync.service.js     # Sync OVH (startup, périodique, manuelle)
├── routes/
│   ├── api.js              # Endpoints API (X-Api-Key)
│   └── index.js            # Routes UI (localhost)
├── views/
│   ├── layout.ejs          # Template principal
│   └── index.ejs           # Page d'accueil
├── public/
│   ├── css/input.css       # Source TailwindCSS
│   └── js/app.js           # Client JS
├── data/
│   ├── aliases.json        # Stockage des alias (gitignoré)
│   └── dictionary.json     # Dictionnaire du générateur
├── mam.service             # Unité systemd
├── Caddyfile               # Configuration reverse proxy
└── package.json
```

## Licence

Non spécifiée — usage interne.
