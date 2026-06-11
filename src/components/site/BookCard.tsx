import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { PublicBook } from "@/lib/books";

export function BookCard({ book, locale }: { book: PublicBook; locale: string }) {
  const year = book.publishedAt
    ? new Intl.DateTimeFormat(locale, { year: "numeric" }).format(book.publishedAt)
    : null;

  return (
    <Link
      href={`/projets/${book.slug}`}
      data-cy={`book-card-${book.slug}`}
      className="group block"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-sm bg-surface shadow-book">
        {book.coverImage ? (
          <Image
            src={`/uploads/${book.coverImage}`}
            alt={book.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center border border-line p-4">
            <span className="font-display text-center text-lg text-ink-muted">{book.title}</span>
          </div>
        )}
      </div>
      <h3 className="font-display mt-4 text-lg leading-snug text-ink group-hover:text-accent-deep">
        {book.title}
      </h3>
      {year && <p className="mt-1 text-sm text-ink-muted">{year}</p>}
    </Link>
  );
}
