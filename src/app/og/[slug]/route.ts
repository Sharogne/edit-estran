import { readContent } from "@/lib/store";
import { decodeDataUri } from "@/lib/images";

// Covers live inside content.json as data URIs, which social crawlers cannot
// read. This endpoint decodes one back into a real image response so the
// OpenGraph tag on a book page points at something fetchable.

export async function GET(_request: Request, ctx: RouteContext<"/og/[slug]">) {
  const { slug } = await ctx.params;

  const { books } = await readContent();
  const book = books.find(
    (candidate) => candidate.slug === slug && candidate.status === "published"
  );
  const decoded = book?.coverImage ? decodeDataUri(book.coverImage) : null;
  if (!decoded) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(decoded.body, {
    headers: {
      "Content-Type": decoded.contentType,
      "Content-Length": String(decoded.body.byteLength),
      // Short: unlike the old uploads route, this URL is stable across edits.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
