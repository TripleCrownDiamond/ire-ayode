# Platform-IRede : Sync KoboToolbox & Dashboard

Plateforme web pour synchroniser automatiquement les formulaires KoboCollect et afficher les données de manière lisible (images, géolocalisation, réponses, etc.).

---

## 1. Ce dont vous avez besoin

### Compte KoboToolbox
- **URL** : [https://kf.kobotoolbox.org](https://kf.kobotoolbox.org) (KoboToolbox humanitaires) OU [https://eu.kobotoolbox.org](https://eu.kobotoolbox.org) (UE)
- **API Token** : Générez-le dans `Paramètres > API Token`
- **Droits** : Votre compte doit avoir accès en lecture (`GET`) aux formulaires et soumissions

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# === KoboToolbox ===
KOBO_API_URL=https://kf.kobotoolbox.org
KOBO_API_TOKEN=your_token_here

# === Base de données ===
DATABASE_URL=sqlite:///kobo_sync.db
# OU pour PostgreSQL :
# DATABASE_URL=postgresql://user:password@localhost:5432/kobo_sync

# === Serveur ===
PORT=3000
HOST=0.0.0.0
SECRET_KEY=change_this_to_a_random_string

# === Sync (optionnel) ===
SYNC_INTERVAL_MINUTES=15
AUTO_SYNC_ENABLED=true
```

---

## 2. Stack technique recommandée

### Option A : Python (Recommandé pour rapidité)

| Composant | Technologie | Pourquoi |
|-----------|-------------|----------|
| Backend | **FastAPI** | API rapide, async, auto-docs Swagger |
| ORM | **SQLAlchemy** | Gestion DB facile |
| DB | **SQLite** (dev) / **PostgreSQL** (prod) | Stockage local des métadonnées |
| Sync | **APScheduler** | Tâches planifiées pour auto-sync |
| Frontend | **React + Tailwind CSS** | Dashboard moderne, responsive |
| Cache | **Redis** (optionnel) | Cache des images média |

### Option B : Node.js

| Composant | Technologie | Pourquoi |
|-----------|-------------|----------|
| Backend | **Express.js** ou **Fastify** | Léger, performant |
| DB | **Prisma** + SQLite/PostgreSQL | ORM moderne |
| Frontend | **Next.js** + Tailwind | SSR + dashboard |
| Sync | **node-cron** | Auto-sync périodique |

---

## 3. Architecture du projet

```
platform-irede/
├── backend/
│   ├── app/
│   │   ├── main.py              # Point d'entrée FastAPI
│   │   ├── config.py            # Config depuis .env
│   │   ├── database.py          # Connexion DB
│   │   ├── models.py            # Tables SQLAlchemy
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── forms.py         # CRUD formulaires
│   │   │   ├── submissions.py   # CRUD soumissions
│   │   │   └── sync.py          # Endpoints sync
│   │   ├── services/
│   │   │   ├── kobo_client.py   # Client API KoboToolbox
│   │   │   ├── sync_service.py  # Logique de sync
│   │   │   └── media_service.py # Download images/fichiers
│   │   └── utils/
│   │       ├── geo.py           # Parsing géolocalisation
│   │       └── form_parser.py   # Parsing réponses complexes
│   ├── requirements.txt
│   └── alembic/                 # Migrations DB
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FormList.vue     # Liste des formulaires
│   │   │   ├── SubmissionsTable.vue  # Tableau des soumissions
│   │   │   ├── MediaViewer.vue  # Affichage images/audio/video
│   │   │   ├── MapView.vue      # Carte géolocalisation
│   │   │   └── SyncStatus.vue   # Indicateur sync
│   │   ├── pages/
│   │   └── App.vue
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. Fonctionnalités clés à implémenter

### 4.1 Sync automatique des formulaires

```python
# Logique de détection automatique
async def auto_sync_forms():
    """
    1. GET /api/v2/forms.json → liste tous les formulaires
    2. Comparer avec ceux en DB
    3. Si nouveau form détecté → créer en DB + sync soumissions
    4. Pour chaque form existant → GET /api/v2/forms/{id}/submissions
    5. Télécharger les médias (images, audio, vidéo)
    """
```

**API Endpoints KoboToolbox :**
- `GET /api/v2/forms.json` → Liste des formulaires
- `GET /api/v2/forms/{formid}/form.json` → Structure du formulaire (XLSForm)
- `GET /api/v2/forms/{formid}/submissions.json` → Toutes les soumissions
- `GET /api/v2/forms/{formid}/submissions/{submissionid}` → Une soumission
- `GET /api/v2/forms/{formid}/media/{filename}` → Télécharger un média

### 4.2 Parsing des types de données

| Type Kobo | Stockage | Affichage |
|-----------|----------|-----------|
| `text`, `integer`, `decimal` | Champ DB | Texte simple |
| `select_one`, `select_multiple` | Valeur + label | Tags / Badges |
| `date`, `time`, `datetime` | ISO 8601 | Format localisé |
| `image`, `audio`, `video` | URL Kobo + cache local | Player intégré |
| `geopoint` (lat, lon, alt, acc) | 4 colonnes float | Carte Leaflet/Mapbox |
| `gps` (Android) | Parsing JSON | Carte avec clustering |
| `note` | Ignoré | Non affiché |
| `repeat` (répétitions) | Table séparée | Accordion / expandable |
| `matrix` | JSON sérialisé | Tableau dynamique |

### 4.3 Affichage des images

```python
# Service de gestion des médias
class MediaService:
    """
    1. Télécharger l'image depuis Kobo
    2. Stocker en cache local (ou S3/MinIO)
    3. Générer thumbnails pour aperçu
    4. Servir via endpoint /api/media/{filename}
    """
```

**Endpoints frontend :**
- `GET /api/media/{submission_id}/{filename}` → Image/audio/video
- `GET /api/media/thumbnail/{filename}?width=200` → Miniature
- `GET /api/forms/{id}/schema` → Schéma du formulaire (pour affichage dynamique)

### 4.4 Affichage géolocalisation

```javascript
// Composant MapView.vue
// Utiliser Leaflet + OpenStreetMap (gratuit)
// Ou Mapbox (plus beau, payant après 50k vues)
- Points markers pour chaque soumission avec géoloc
- Clustering si beaucoup de points
- Popup avec résumé de la soumission
- Filtre par formulaire / date / auteur
```

---

## 5. Steps de mise en place

### Étape 1 : Cloner et configurer

```bash
git clone <votre-repo>
cd platform-irede

# Backend Python
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Étape 2 : Configurer KoboToolbox

1. Aller sur [kobotoolbox.org](https://kf.kobotoolbox.org) → Connexion
2. Menu utilisateur > **Paramètres** > **API Token**
3. Copier le token dans `.env` → `KOBO_API_TOKEN`
4. Vérifier l'URL (humanitaire vs standard)

### Étape 3 : Initialiser la DB

```bash
cd backend
alembic upgrade head
# OU :
python -c "from app.database import create_tables; create_tables()"
```

### Étape 4 : Lancer

```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Étape 5 : Tester la sync

```bash
# Forcer une sync manuelle
curl -X POST http://localhost:8000/api/sync/trigger

# Vérifier les formulaires sync
curl http://localhost:8000/api/forms
```

---

## 6. Auto-sync : comment ça marche

```
┌─────────────────────────────────────────────────────────┐
│                    AUTO-SYNC LOOP                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Cron toutes les N minutes (configurable)            │
│     └─► scheduler.add_job(sync_forms, minutes=15)       │
│                                                         │
│  2. GET /api/v2/forms.json                              │
│     └─► Liste des formulaires actifs                    │
│                                                         │
│  3. Comparer avec forms en DB                           │
│     ├─► Nouveau form ? → Créer + sync soumissions      │
│     └─► Form existant ? → Sync nouvelles soumissions   │
│                                                         │
│  4. Pour chaque form : GET /submissions.json            │
│     └─► Filtrer par date (last_sync < created)         │
│                                                         │
│  5. Parser réponses → Stocker en DB                     │
│     └─► Télécharger images/audio/video                 │
│                                                         │
│  6. Logger résultat sync                                │
│     └─► "Synced 12 new submissions from form X"        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. API Backend (FastAPI)

### Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/forms` | Liste des formulaires |
| `GET` | `/api/forms/{id}` | Détail d'un formulaire |
| `GET` | `/api/forms/{id}/submissions` | Soumissions d'un formulaire |
| `GET` | `/api/submissions/{id}` | Détail d'une soumission |
| `POST` | `/api/sync/trigger` | Forcer sync maintenant |
| `GET` | `/api/sync/status` | État de la dernière sync |
| `GET` | `/api/media/{filename}` | Télécharger un média |
| `GET` | `/api/forms/{id}/schema` | Schéma XLSForm parsé |
| `GET` | `/api/stats` | Statistiques globales |

### Exemple réponse

```json
{
  "form": {
    "id": "abc123",
    "title": "Enquête terrain",
    "submissions_count": 156,
    "last_sync": "2024-01-15T10:30:00Z"
  },
  "submissions": [
    {
      "id": 1,
      "submitted_by": "agent1",
      "submitted_at": "2024-01-15T09:22:00Z",
      "data": {
        "nom_enqueteur": "Jean Dupont",
        "photo Terrain": "/api/media/sub1/photo_01.jpg",
        "geopointTerrain": {
          "latitude": -1.2345,
          "longitude": 36.7890,
          "altitude": 1200,
          "accuracy": 5.2
        },
        "observations": "Sol argileux, bonne irrigabilité"
      }
    }
  ]
}
```

---

## 8. Docker (Optionnel mais recommandé)

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./media_cache:/app/media_cache
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kobo_sync
      POSTGRES_USER: kobo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

```bash
docker-compose up -d
```

---

## 9. Checklist avant de coder

- [ ] Compte KoboToolbox créé et fonctionnel
- [ ] API Token généré et copié
- [ ] URL API vérifiée (kf vs eu)
- [ ] Python 3.10+ installé (si Option A)
- [ ] Node.js 18+ installé (si Option B)
- [ ] Docker installé (optionnel)
- [ ] PostgreSQL installé (pour prod) ou SQLite (pour dev)
- [ ] Fichier `.env` créé avec vos vraies valeurs
- [ ] Test curl vers API KoboToolbox fonctionne :
  ```bash
  curl -H "Authorization: Token YOUR_TOKEN" \
    https://kf.kobotoolbox.org/api/v2/forms.json
  ```

---

## 10. Problèmes courants

| Problème | Solution |
|----------|----------|
| `401 Unauthorized` | Vérifier le token API dans `.env` |
| `403 Forbidden` | Le formulaire n'est pas partagé avec votre compte |
| Images non affichées | Vérifier que le media service tourne, tester l'URL directe |
| Pas de géoloc sur carte | Vérifier que `geopoint` est bien dans le XLSForm |
| Sync lente | Augmenter `SYNC_INTERVAL_MINUTES`, utiliser Redis cache |
| Docker crash | Vérifier les logs : `docker-compose logs backend` |

---

## 11. Extensions possibles

- [ ] **Export** : Générer PDF/Excel par formulaire
- [ ] **Alertes** : Email/Telegram quand nouvelle soumission
- [ ] **Utilisateurs** : Authentification + rôles (admin/readonly)
- [ ] **Offline** : Service worker pour usage terrain
- [ ] **Multi-form** : Dashboard global cross-formulaires
- [ ] **Validation** : Workflow de validation des soumissions
- [ ] **Webhooks** : Push vers autres systèmes
