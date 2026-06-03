# mon jeu+

Jeu d'obstacles React + Vite avec contrôles clavier et tactiles.

## Démarrage avec record partagé configuré

Le projet inclut maintenant une API Node sans dépendance externe. Tous les appareils qui ouvrent le jeu depuis le même serveur voient le même champion et le même score.

```bash
npm run build
npm run start
```

Le serveur écoute par défaut sur `http://0.0.0.0:8787`, sert le jeu construit dans `dist/`, et expose l'API partagée sur `/api/record`.

## Développement local

Dans deux terminaux :

```bash
npm run dev:api
npm run dev
```

Vite proxifie `/api` vers `http://127.0.0.1:8787`, donc l'application utilise automatiquement le record partagé local.

## Déploiement et persistance

Le record est stocké dans `data/record.json` par défaut. Pour utiliser un autre emplacement persistant :

```bash
RECORD_FILE=/chemin/persistant/record.json npm run start
```

Tu peux aussi brancher une API externe en définissant :

```bash
VITE_RECORD_API_URL=https://ton-api.example.com/record
```

Contrat attendu :

- `GET /record` ou `GET /api/record` retourne `{ "name": "Alice", "score": 1200, "difficulty": "Difficile", "updatedAt": "..." }`.
- `POST /record` ou `POST /api/record` reçoit le même format, sauvegarde uniquement si le score bat le record actuel, puis retourne le record gagnant.
