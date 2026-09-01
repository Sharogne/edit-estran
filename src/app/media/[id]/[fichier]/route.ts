import { readContent } from "@/lib/store";
import { decodeDataUri } from "@/lib/images";
import { mediaVersion, parseMediaFilename, type MediaVariant } from "@/lib/media";

// Les couvertures vivent dans content.json, encodées en data URI. Cette route
// les décode à la volée depuis le contenu déjà en mémoire : rien n'est écrit sur
// le disque, seule la LIVRAISON change. Voir src/lib/media.ts pour le pourquoi
// (poids du HTML, cache navigateur, chargement différé).

const CHAMPS: Record<MediaVariant, "coverCard" | "coverImage" | "backCoverImage"> = {
  card: "coverCard",
  cover: "coverImage",
  back: "backCoverImage",
};

const introuvable = () => new Response("Not found", { status: 404 });

export async function GET(_request: Request, ctx: RouteContext<"/media/[id]/[fichier]">) {
  const { id, fichier } = await ctx.params;

  const demande = parseMediaFilename(fichier);
  if (!demande) return introuvable();

  const { books } = await readContent();
  const book = books.find((candidate) => candidate.id === id);
  if (!book) return introuvable();

  // La version fait partie de l'adresse : une URL périmée doit échouer, sinon la
  // réponse immuable ci-dessous figerait l'ancienne couverture chez le visiteur.
  if (demande.version !== mediaVersion(book.updatedAt)) return introuvable();

  const stocke = book[CHAMPS[demande.variant]];
  const decoded = stocke ? decodeDataUri(stocke) : null;
  if (!decoded) return introuvable();

  return new Response(decoded.body, {
    headers: {
      "Content-Type": decoded.contentType,
      "Content-Length": String(decoded.body.byteLength),
      // Immuable sans risque : l'adresse porte la version du livre, donc une
      // couverture modifiée est servie sous une AUTRE URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
