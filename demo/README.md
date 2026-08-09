# Démo statique (GitHub Pages)

Version vitrine **et** back office du site, exportée en HTML/CSS/JS pur et publiée sur
GitHub Pages : <https://sharogne.github.io/edit-estran/>

Il n'y a ni serveur, ni base de données. Le but est de montrer le produit, pas de le faire
tourner.

## Ce que la démo fait — et ne fait pas

| | Démo statique | Application réelle |
| --- | --- | --- |
| Site public FR/EN | Pré-rendu au build depuis `demo/overlay/src/lib/demo-data.ts` | Prisma + SQLite |
| Back office | Maquette cliquable, données dans le `localStorage` du visiteur | Server Actions + iron-session |
| Login | `admin` / `admin`, en clair dans le bundle | bcrypt + cookie chiffré |
| Uploads | Image redimensionnée en `data:` URL, gardée dans le navigateur | sharp → `UPLOADS_DIR` |
| Portée des modifications | Le navigateur du visiteur, effacées si le cache est vidé | La base, pour tout le monde |

**Limite à connaître** : les pages publiques sont du HTML figé, généré au build. Un livre créé
dans le back office de démo apparaît dans le back office, mais **pas** sur le site public — il
faudrait un serveur pour ça. Le bouton « Réinitialiser la démo » du dashboard restaure le
catalogue d'origine.

## Comment ça marche

Le vrai code n'est **jamais** modifié dans le dépôt. `scripts/build-static-demo.mjs` :

1. vérifie que `src/`, `public/` et `next.config.ts` sont propres (sinon il s'arrête) ;
2. copie `demo/overlay/**` par-dessus l'arbre de travail ;
3. supprime ce qu'un export statique ne peut pas compiler : `src/app/uploads/` (route
   handler), `src/proxy.ts` (middleware next-intl), `src/app/admin/(protected)/livres/[id]/`
   (segment dynamique, remplacé par `editer/?id=`) ;
4. génère les visuels de démo dans `public/uploads/` (`scripts/gen-demo-images.ts`, mêmes
   images que le seed de dev) ;
5. lance `next build` en `output: "export"` ;
6. écrit `out/.nojekyll` et un `out/index.html` qui redirige vers `/fr/` — le middleware de
   détection de locale ne tourne pas sur un hébergement statique ;
7. **restaure l'arbre de travail dans un `finally`** (`git checkout` + suppression des fichiers
   ajoutés).

```bash
npm run demo:build                          # build dans out/ (basePath /edit-estran)
NEXT_PUBLIC_BASE_PATH= npm run demo:build   # build servable à la racine, pour tester en local
```

Le déploiement est automatique à chaque push sur `main` via
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

## Pourquoi les composants sont réutilisés tels quels

`BookForm`, `AddPreviewsForm`, `DeleteBookButton`, `StatusBadge` ne sont **pas** dupliqués :
React 19 accepte une fonction client dans `<form action={…}>` et `useActionState`, donc
`demo/overlay/src/app/admin/**/actions.ts` réexporte les mêmes noms avec la même signature,
en version navigateur. La validation Zod (`src/lib/validation/book.ts`) est isomorphe et sert
aux deux — les messages d'erreur sont identiques à la production.

Seuls trois composants ont une variante dans l'overlay, pour des raisons précises :

- `LoginForm` — champ texte au lieu d'e-mail (l'identifiant de démo est `admin`) et champs
  pré-remplis ;
- `PreviewPagesManager` — doit être un composant client ici ;
- les pages `admin/**` — le garde `requireAdmin()` devient un test côté navigateur.

## Si tu modifies le vrai code

- **Un composant de `src/components/admin/`** → vérifie s'il a une variante dans
  `demo/overlay/src/components/admin/`, et reporte le changement.
- **Une signature de server action** → reporte-la dans
  `demo/overlay/src/app/admin/(protected)/livres/actions.ts`.
- **Le catalogue de démo** (`demo/overlay/src/lib/demo-data.ts`) → les ids et le nombre de
  previews doivent rester alignés avec `scripts/gen-demo-images.ts`, qui génère les fichiers
  correspondants.
- **Un chemin d'image** → passe par `uploadSrc()` (`src/lib/image-src.ts`). `next/image`
  n'applique pas le `basePath` aux images non optimisées ; sans ce helper, les images sont
  cassées sur GitHub Pages.

`demo/overlay` est exclu de `tsconfig.json` : ces fichiers ne sont valides qu'une fois copiés
à leur emplacement de destination. Ils sont donc type-checkés pendant `npm run demo:build`,
pas avant.
