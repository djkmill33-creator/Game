# mon jeu+

Jeu d'obstacles React + Vite avec contrôles clavier et tactiles.

## Record partagé entre appareils

Le jeu enregistre toujours un record local. Pour que le nom du champion et son score soient visibles par tous les joueurs sur différents appareils, configure un endpoint HTTP partagé avec la variable Vite suivante :

```bash
VITE_RECORD_API_URL=https://ton-api.example.com/record
```

Contrat attendu :

- `GET /record` retourne le meilleur record sous la forme `{ "name": "Alice", "score": 1200, "difficulty": "Difficile", "updatedAt": "..." }`.
- `POST /record` reçoit le même format et doit sauvegarder le record uniquement s'il bat le record actuel, puis retourner le record gagnant.

Sans `VITE_RECORD_API_URL`, le jeu reste jouable mais le record est seulement local à l'appareil.
