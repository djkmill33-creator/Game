# mon jeu+

Jeu d'obstacles React + Vite avec contrôles clavier et tactiles.

## Point important : un seul record global = une seule API centrale

Oui : si les joueurs ne sont pas connectés à la même API de record, ils ne verront pas le même champion. Pour un record visible par tout le monde, il faut donc **déployer une API centrale unique** et faire pointer toutes les copies du jeu vers cette même URL.

Le projet inclut cette API Node dans `server/record-api.js`. Tu peux l'utiliser de deux façons :

1. **Même serveur que le jeu** : simple pour un seul site.
2. **Serveur/API centrale séparée** : recommandé si le jeu est publié sur plusieurs domaines ou appareils qui ne passent pas par le même serveur.

## Démarrage sur un seul serveur

```bash
npm run build
npm run start
```

Le serveur écoute par défaut sur `http://0.0.0.0:8787`, sert le jeu construit dans `dist/`, et expose l'API partagée sur `/api/record`.

Tous les appareils qui ouvrent cette même URL partagent alors le même record.

## Développement local

Dans deux terminaux :

```bash
npm run dev:api
npm run dev
```

Vite proxifie `/api` vers `http://127.0.0.1:8787`, donc l'application utilise automatiquement le record partagé local.

## Plusieurs serveurs ou plusieurs domaines

Déploie `server/record-api.js` une seule fois, par exemple sur `https://api.example.com`, puis configure chaque frontend pour utiliser cette même API centrale :

### Option 1 — au build

```bash
VITE_RECORD_API_URL=https://api.example.com/api/record npm run build
```

### Option 2 — sans rebuild

Après le build, modifie `dist/record-config.js` ou `public/record-config.js` avant déploiement :

```js
window.MON_JEU_PLUS_RECORD_API_URL = 'https://api.example.com/api/record'
```

Cette option est pratique si tu copies le même build sur plusieurs serveurs : ils pointeront tous vers le même record central.

## Déploiement et persistance

Le record est stocké dans `data/record.json` par défaut. Pour utiliser un autre emplacement persistant :

```bash
RECORD_FILE=/chemin/persistant/record.json npm run start
```

Contrat API :

- `GET /record` ou `GET /api/record` retourne `{ "name": "Alice", "score": 1200, "difficulty": "Difficile", "updatedAt": "..." }`.
- `POST /record` ou `POST /api/record` reçoit le même format, sauvegarde uniquement si le score bat le record actuel, puis retourne le record gagnant.
