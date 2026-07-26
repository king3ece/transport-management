# TransGestion — gestion d'une entreprise de transport

Application web de gestion pour une entreprise de transport **de personnes et de marchandises** :
flotte, chauffeurs, lignes, voyages, billetterie, colis/fret avec suivi, clients et tableau de bord.

- **Backend** : FastAPI + SQLAlchemy 2 (SQLite en dev, PostgreSQL en production), JWT + rôles
- **Frontend** : React 19 + Vite + TypeScript + Tailwind CSS 4
- **Tests** : pytest (API), `tsc` + `oxlint` (frontend)

## Modules fonctionnels

| Module | Contenu |
| --- | --- |
| Tableau de bord | Recettes du mois (voyageurs/fret), impayés, voyages du jour, taux de remplissage, flotte, permis à renouveler, prochains départs, courbe de CA sur 6 mois |
| Véhicules | Immatriculation, type (autocar/minibus/fourgon/camion), places, capacité de fret, kilométrage, statut |
| Maintenance | Interventions préventives/correctives/contrôles, coûts, prochaine échéance, mise à jour du compteur |
| Chauffeurs | Effectif, permis + date d'expiration (alerte à 60 jours), disponibilité |
| Lignes | Code, origine/destination, distance, durée, tarif voyageur et tarif fret au kg |
| Voyages | Affectation véhicule + chauffeur, détection de conflit de planning (± 6 h), cycle planifié → en cours → terminé/annulé |
| Réservations | Attribution de siège (manuelle ou automatique), contrôle des doublons et de la capacité, encaissement, embarquement |
| Colis & fret | Tarification au poids selon la ligne, contrôle de la capacité de fret du voyage, historique de statuts, numéro de suivi |
| Suivi public | Page `/suivi` accessible sans compte via le numéro de suivi |
| Clients | Particuliers et entreprises |
| Utilisateurs | Comptes, rôles, activation/désactivation (admin uniquement) |

### Rôles

| Rôle | Droits |
| --- | --- |
| `admin` | Tout, y compris la gestion des utilisateurs |
| `dispatcher` (régulateur) | Exploitation complète : flotte, chauffeurs, lignes, voyages, réservations, colis |
| `driver` / `client` | Lecture de l'exploitation, création de réservations et de colis |

## Démarrage rapide

Prérequis : Python 3.10+, Node 20.19+ (voir `.nvmrc`).

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- API : http://localhost:8000 · documentation OpenAPI : http://localhost:8000/docs
- Au premier démarrage, la base est créée et un **jeu de données de démonstration** est inséré
  (`SEED_ON_STARTUP=false` pour le désactiver).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface : http://localhost:5173 (les appels `/api` sont proxifiés vers `http://localhost:8000`).

### Comptes de démonstration

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@transport.tg` | `Admin1234` |
| Régulateur | `dispatch@transport.tg` | `Dispatch1234` |
| Chauffeur | `chauffeur@transport.tg` | `Driver1234` |
| Client | `client@transport.tg` | `Client1234` |

### Docker

```bash
docker compose up --build
```

Lance PostgreSQL, l'API (port 8000) et le frontend servi par Vite (port 5173).

## Tests et qualité

```bash
cd backend  && .venv/bin/pytest -q && .venv/bin/ruff check .
cd frontend && npm run build && npm run lint
```

## Passage en PostgreSQL

```bash
export DATABASE_URL="postgresql+psycopg://user:password@localhost:5432/transport"
```

Les tables sont créées au démarrage via `Base.metadata.create_all`. Pour un vrai cycle de vie de
schéma en production, ajouter Alembic (`alembic init`) — non inclus volontairement pour garder le
projet minimal.

## Structure

```
backend/
  app/
    api/routers/    auth, fleet (véhicules/maintenance/chauffeurs), network (lignes/clients/voyages),
                    bookings, shipments, dashboard
    core/           configuration et sécurité (JWT, bcrypt)
    db/             session SQLAlchemy et données de démonstration
    models.py       modèle de données (12 tables)
    schemas.py      schémas Pydantic
    services.py     règles métier partagées (sièges, capacité fret, tarification, références)
  tests/            tests d'API pytest
frontend/
  src/api/          client HTTP typé et types du domaine
  src/auth/         contexte d'authentification (JWT en localStorage)
  src/components/   layout et composants d'UI
  src/pages/        une page par module
```

## Sécurité — note

`npm audit` signale un avertissement `react-router` lié au **mode RSC** (exécution d'actions serveur).
Cette application est une SPA `BrowserRouter` sans RSC ni server actions : le vecteur n'est pas
exploitable ici. La version utilisée (7.18.1) est la plus récente disponible.
