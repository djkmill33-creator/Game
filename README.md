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

## Faire pointer tous les jeux vers la même API centrale

### 1. Déployer l'API centrale une seule fois

Sur le serveur qui gardera le record global :

```bash
npm run build
RECORD_FILE=/chemin/persistant/record.json npm run start
```

Son endpoint central sera par exemple :

```text
https://records.example.com/api/record
```

### 2. Configurer chaque serveur de jeu avec la même URL centrale

Sur chaque serveur qui héberge une copie du jeu, utilise la même variable :

```bash
CENTRAL_RECORD_API_URL=https://records.example.com/api/record npm run start
```

`server/record-api.js` génère alors automatiquement `/record-config.js`, et le frontend pointera vers cette API centrale. Ainsi, même si les jeux sont sur plusieurs serveurs, ils lisent et publient tous le même record.

### 3. Alternative au build

Tu peux aussi construire chaque frontend avec la même URL :

```bash
VITE_RECORD_API_URL=https://records.example.com/api/record npm run build
```

### 4. Alternative sans rebuild ni variable serveur

Après le build, modifie `dist/record-config.js` ou `public/record-config.js` avant déploiement :

```js
window.MON_JEU_PLUS_RECORD_API_URL = 'https://records.example.com/api/record'
```

Cette option est pratique si tu copies le même build sur plusieurs serveurs : ils pointeront tous vers le même record central.

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

Contrat API :

- `GET /record` ou `GET /api/record` retourne `{ "name": "Alice", "score": 1200, "difficulty": "Difficile", "updatedAt": "..." }`.
- `POST /record` ou `POST /api/record` reçoit le même format, sauvegarde uniquement si le score bat le record actuel, puis retourne le record gagnant.
