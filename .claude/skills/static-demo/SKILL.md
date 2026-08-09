---
name: static-demo
description: Construire, vérifier et déployer la démo statique publiée sur GitHub Pages (site public pré-rendu + back office simulé côté navigateur). À utiliser pour mettre à jour la démo, diagnostiquer un build export en échec, ou après toute modification du vrai code qui touche l'admin ou les images.
---

# Démo statique GitHub Pages

URL : <https://sharogne.github.io/edit-estran/> — déployée automatiquement à chaque push sur
`main` (`.github/workflows/pages.yml`). Mécanique détaillée : [`demo/README.md`](../../../demo/README.md).

Principe : le vrai code n'est jamais modifié. `scripts/build-static-demo.mjs` applique
l'overlay `demo/overlay/**` sur l'arbre de travail, build en `output: "export"`, puis restaure
tout dans un `finally`.

## Commandes

```bash
npm run demo:build                          # build dans out/ (basePath /edit-estran)
NEXT_PUBLIC_BASE_PATH= npm run demo:build   # variante servable à la racine, pour tester en local
```

Vérification locale (le build par défaut attend d'être servi sous `/edit-estran/`) :

```bash
npm run demo:build && node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let x=p.join('out',decodeURIComponent(q.url.split('?')[0]).replace(/^\/edit-estran/,''));if(f.existsSync(x)&&f.statSync(x).isDirectory())x=p.join(x,'index.html');if(!f.existsSync(x)){s.writeHead(404);return s.end()}s.writeHead(200);f.createReadStream(x).pipe(s)}).listen(4173,()=>console.log('http://localhost:4173/edit-estran/'))"
```

## Après une modification du vrai code

L'overlay duplique volontairement quelques fichiers. À reporter à la main :

| Tu modifies… | Reporte dans… |
| --- | --- |
| `src/components/admin/LoginForm.tsx` ou `PreviewPagesManager.tsx` | `demo/overlay/src/components/admin/` (mêmes noms) |
| une signature de server action livre | `demo/overlay/src/app/admin/(protected)/livres/actions.ts` |
| `src/app/admin/**` (structure, layout) | l'équivalent dans `demo/overlay/src/app/admin/**` |
| le catalogue de démo | `demo/overlay/src/lib/demo-data.ts` **et** `scripts/gen-demo-images.ts` (ids + nombre de previews alignés) |

`BookForm`, `AddPreviewsForm`, `DeleteBookButton`, `StatusBadge` et toute la validation Zod
sont réutilisés tels quels — ne les duplique pas.

## Pièges connus

- **Images cassées sur Pages** : `next/image` n'applique pas le `basePath` quand les images
  sont `unoptimized`. Tout chemin d'image doit passer par `uploadSrc()`
  (`src/lib/image-src.ts`). Exception : les URLs de `metadata` (OpenGraph), résolues contre
  `metadataBase` qui contient déjà le `basePath` — les préfixer produirait `/edit-estran/edit-estran/…`.
- **`Cannot find module '…/[id]/page.js'`** : validateurs de types laissés par un `next dev`.
  Le script supprime `.next` avant de builder ; si l'erreur revient, vérifie que ce `rmSync`
  est toujours là.
- **`export const dynamic = "force-static" not configured on route "/robots.txt"`** : toute
  route de metadata (`robots.ts`, `sitemap.ts`) doit exporter `dynamic = "force-static"` en
  mode export — d'où leurs variantes dans l'overlay.
- **Le build refuse de démarrer** : `src/`, `public/` ou `next.config.ts` ont des modifications
  non commitées. C'est volontaire — le script restaure ces chemins avec `git checkout`.
- **Une route dynamique nouvelle** (`[param]`) ne peut pas être exportée si ses valeurs
  n'existent qu'au runtime. Passer par une query string, comme `admin/livres/editer/?id=`.

## Limite structurelle à rappeler

Les pages publiques sont figées au build : un livre créé dans le back office de démo n'apparaît
pas sur le site public. Pour une démo avec boucle complète, il faut un hébergement avec process
Node et disque persistant (voir le skill `deploy-ovh`).
