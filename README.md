# Théogonie

Arbre généalogique interactif de la mythologie grecque : primordiaux, Titans, Olympiens, divinités, nymphes, héros, mortels, monstres et créatures (358 personnages, 753 histoires résumées, glossaire de 60 termes).

- **Vue maître/détail** : graphe zoomable à gauche, carte de détail à droite (panneau du bas sur mobile).
- **Vue focalisée / complète**, filtres par catégorie.
- **Recherche** de personnages, de termes du glossaire et de tags (`#mer`, `#guerre de troie`…).
- **Glossaire** des catégories et des notions (Titanomachie, hybris, Néréide…).

## Développement

```bash
npm install
npm run dev        # génère les données puis lance le serveur de développement
npm run generate   # régénère src/generated/ (à relancer après avoir modifié les données)
npm run validate   # vérifie les données (schéma, références, tags, glossaire)
npm test           # tests unitaires
npm run build      # validation + build de production dans dist/
npm run deploy     # build + publication sur la branche gh-pages
```

## Données

- `src/data/ids.md` — liste maîtresse des identifiants, par fichier.
- `src/data/entities/*.json` — les personnages (schéma dans `src/data/schema.ts`).
- `src/data/tags.json` — vocabulaire contrôlé des tags.
- `src/data/glossaire.json` — le glossaire.

`npm run generate` produit `src/generated/` (non versionné) : les personnages sans leurs histoires, les histoires (chargées en différé) et les positions du graphe précalculées avec ELK pour chaque vue, afin de ne pas faire tourner la mise en page sur l'appareil.

Les enfants ne sont jamais saisis : ils sont dérivés des filiations. Pour ajouter un personnage, l'inscrire d'abord dans `ids.md`, puis dans son fichier, et lancer `npm run validate`.

Les résumés sont des paraphrases rédigées d'après les sources antiques (Hésiode, Homère, Apollodore, Ovide, les tragiques…) ; ils peuvent contenir des imprécisions.

Compatibilité : Safari 12 / iOS 12 et navigateurs récents.

Stack : Vite, React, TypeScript, React Flow, ELK, Fuse.js, Zod, Vitest.
