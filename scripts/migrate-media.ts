import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BACK_COVER, COVER_CARD, COVER_FULL, processImageBuffer } from "../src/lib/images";
import { MAX_SYNOPSIS_CHARS } from "../src/config/content-limits";
import { COVER_RATIO } from "../src/config/uploads";

// Migration à exécution unique du contenu déjà en base.
//
//   npx tsx scripts/migrate-media.ts            rapport seul, rien n'est écrit
//   npx tsx scripts/migrate-media.ts --write    applique
//
// Trois choses ont changé sous les images :
//   1. elles sont recadrées au format 2:3 à l'encodage, plus par le CSS ;
//   2. la variante de liste passe de 320 à 600 px de large ;
//   3. le champ `coverThumb` devient `coverCard`.
//
// Les couvertures déjà stockées sont donc au mauvais format et à la mauvaise
// taille : il faut les repasser dans l'encodeur. La meilleure source disponible
// est la plus grande variante DÉJÀ stockée — un ré-encodage ne récupère pas les
// pixels que la première compression a jetés, d'où les avertissements ci-dessous
// invitant à réimporter les couvertures concernées.
//
// Le script est idempotent : le relancer sur un contenu déjà migré le laisse au
// bon format (il repart simplement de la plus grande variante présente).

type Traduction = { title?: string; synopsis?: string };
type LivreLegacy = {
  id: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  coverCard?: string | null;
  /** Ancien nom de `coverCard`, présent tant que la migration n'a pas tourné. */
  coverThumb?: string | null;
  coverImage?: string | null;
  backCoverImage?: string | null;
  translations?: Record<string, Traduction>;
};
type ContenuLegacy = { version: number; books: LivreLegacy[] };

const ecrire = process.argv.includes("--write");

const octets = (dataUri: string) => Buffer.from(dataUri.slice(dataUri.indexOf(",") + 1), "base64");

const ko = (valeur: string | null | undefined) =>
  valeur ? `${(octets(valeur).byteLength / 1024).toFixed(0)} Ko` : "—";

async function taille(buffer: Buffer) {
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  return { width, height };
}

/**
 * La variante stockée qui compte le plus de pixels : c'est la moins dégradée, et
 * donc la meilleure source pour tout ré-encoder.
 */
async function meilleureSource(candidats: (string | null | undefined)[]) {
  let meilleur: { buffer: Buffer; width: number; height: number } | null = null;
  for (const candidat of candidats) {
    if (!candidat) continue;
    const buffer = octets(candidat);
    const { width, height } = await taille(buffer);
    if (!meilleur || width * height > meilleur.width * meilleur.height) {
      meilleur = { buffer, width, height };
    }
  }
  return meilleur;
}

const alertes: string[] = [];

async function migrerLivre(livre: LivreLegacy) {
  const lignes: string[] = [];

  const recto = await meilleureSource([livre.coverImage, livre.coverCard, livre.coverThumb]);
  if (recto) {
    // La source est-elle à la hauteur de ce qu'on lui demande ? Une couverture
    // déjà rognée par le CSS a aussi perdu son cadrage d'origine : la ré-encoder
    // ne fait que figer proprement ce qui restait.
    if (recto.width < COVER_FULL.width || recto.height < COVER_FULL.height) {
      alertes.push(
        `${livre.slug} — source de ${recto.width} × ${recto.height} pour une cible de ` +
          `${COVER_FULL.width} × ${COVER_FULL.height} : réimportez la couverture d'origine ` +
          "depuis le back office pour retrouver de la finesse."
      );
    }
    const ratio = recto.width / recto.height;
    const ecart = Math.abs(ratio - COVER_RATIO) / COVER_RATIO;
    if (ecart > 0.05) {
      alertes.push(
        `${livre.slug} — couverture au format ${recto.width} × ${recto.height} (ratio ` +
          `${ratio.toFixed(2)} au lieu de ${COVER_RATIO.toFixed(2)}) : elle sera recadrée, ` +
          "vérifiez le rendu après migration."
      );
    }

    const avant = `${ko(livre.coverThumb ?? livre.coverCard)} / ${ko(livre.coverImage)}`;
    livre.coverCard = await processImageBuffer(recto.buffer, COVER_CARD);
    livre.coverImage = await processImageBuffer(recto.buffer, COVER_FULL);
    lignes.push(`recto ${avant} → ${ko(livre.coverCard)} / ${ko(livre.coverImage)}`);
  } else {
    livre.coverCard = livre.coverCard ?? null;
    livre.coverImage = livre.coverImage ?? null;
    lignes.push("aucune couverture");
  }

  const verso = await meilleureSource([livre.backCoverImage]);
  if (verso) {
    const avant = ko(livre.backCoverImage);
    livre.backCoverImage = await processImageBuffer(verso.buffer, BACK_COVER);
    lignes.push(`verso ${avant} → ${ko(livre.backCoverImage)}`);
  } else {
    livre.backCoverImage = livre.backCoverImage ?? null;
  }

  // Le champ a été renommé : le laisser derrière ferait grossir le fichier d'une
  // copie que plus rien ne lit.
  delete livre.coverThumb;

  return lignes;
}

/** Ce que la migration ne peut PAS trancher seule, et qui demande un arbitrage. */
function arbitrages(livres: LivreLegacy[]) {
  const points: string[] = [];

  for (const livre of livres) {
    // Le slug n'est plus figé par `publishedAt` mais par le statut. Un livre
    // remis en brouillon avant ce changement verrait donc son adresse redevenir
    // modifiable — or elle a pu circuler.
    if (livre.status !== "published" && livre.publishedAt) {
      points.push(
        `${livre.slug} — brouillon portant une date de parution (${livre.publishedAt.slice(0, 10)}). ` +
          "Son adresse n'est plus figée : republiez-le si elle a déjà circulé, ou effacez la date."
      );
    }
    for (const [locale, traduction] of Object.entries(livre.translations ?? {})) {
      const longueur = (traduction.synopsis ?? "").length;
      if (longueur > MAX_SYNOPSIS_CHARS) {
        points.push(
          `${livre.slug} (${locale}) — synopsis de ${longueur} caractères pour ` +
            `${MAX_SYNOPSIS_CHARS} désormais autorisés : il faudra le raccourcir avant ` +
            "le prochain enregistrement du livre."
        );
      }
    }
  }
  return points;
}

async function main() {
  const cible = path.resolve(process.cwd(), process.env.CONTENT_FILE ?? "./data/content.json");
  const contenu = JSON.parse(await fs.readFile(cible, "utf8")) as ContenuLegacy;

  console.log(`\n  ${cible}\n  ${contenu.books.length} livre(s)\n`);

  for (const livre of contenu.books) {
    const lignes = await migrerLivre(livre);
    console.log(`  ${livre.slug.padEnd(28)} ${lignes.join("  |  ")}`);
  }

  const aArbitrer = arbitrages(contenu.books);
  for (const [titre, liste] of [
    ["Qualité des images", alertes],
    ["À arbitrer", aArbitrer],
  ] as const) {
    if (!liste.length) continue;
    console.log(`\n  ${titre}\n  ${"─".repeat(60)}`);
    for (const ligne of liste) console.log(`  · ${ligne}`);
  }

  if (!ecrire) {
    console.log("\n  Rapport seul — rien n'a été écrit. Relancez avec --write pour appliquer.\n");
    return;
  }

  // Écriture atomique, comme le store : un fichier de contenu à moitié réécrit
  // serait un site à moitié perdu.
  const temporaire = `${cible}.tmp`;
  await fs.writeFile(temporaire, JSON.stringify(contenu, null, 2), "utf8");
  await fs.rename(temporaire, cible);

  const poids = (await fs.stat(cible)).size;
  console.log(`\n  Écrit — ${(poids / 1024).toFixed(0)} Ko\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
