"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

const SIZES = "(max-width: 768px) 80vw, 300px";

/**
 * The book cover, flipped to reveal the back cover on click.
 * Both faces stay mounted so the rotation can animate; the one facing away is
 * hidden from assistive tech, and `data-face` on the card says which is up.
 */
export function BookCoverFlip({
  title,
  coverImage,
  backCoverImage,
}: {
  title: string;
  coverImage: string | null;
  backCoverImage: string | null;
}) {
  const t = useTranslations("project");
  const [flipped, setFlipped] = useState(false);

  const front = coverImage ? (
    <Image
      src={coverImage}
      alt={title}
      fill
      priority
      sizes={SIZES}
      className="object-cover"
      data-cy="project-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center border border-line p-4">
      <span className="font-display text-center text-xl text-ink-muted">{title}</span>
    </div>
  );

  // No back cover on this book: plain, non-interactive cover.
  if (!backCoverImage) {
    return (
      <div
        className="relative aspect-2/3 overflow-hidden rounded-sm bg-surface shadow-book"
        data-cy="project-cover-card"
        data-face="front"
      >
        {front}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setFlipped((current) => !current)}
      aria-pressed={flipped}
      data-cy="project-cover-flip"
      className="group block w-full cursor-pointer perspective-[1200px]"
    >
      <div
        className={`relative aspect-2/3 w-full transform-3d transition-transform duration-700 motion-reduce:duration-0 ${
          flipped ? "rotate-y-180" : ""
        }`}
        data-cy="project-cover-card"
        data-face={flipped ? "back" : "front"}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-sm bg-surface shadow-book backface-hidden"
          aria-hidden={flipped}
        >
          {front}
        </div>
        <div
          className="absolute inset-0 rotate-y-180 overflow-hidden rounded-sm bg-surface shadow-book backface-hidden"
          aria-hidden={!flipped}
        >
          <Image
            src={backCoverImage}
            alt={t("backCoverAlt", { title })}
            fill
            sizes={SIZES}
            className="object-cover"
            data-cy="project-back-cover"
          />
        </div>
      </div>
      <span className="mt-3 block text-center text-sm text-ink-muted group-hover:text-ink">
        {flipped ? t("flipToFront") : t("flipToBack")}
      </span>
    </button>
  );
}
