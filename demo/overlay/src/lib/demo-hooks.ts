"use client";

// STATIC DEMO BUILD — shared client hook for the mock back office.

import { useEffect, useState } from "react";
import { loadBooks, type DemoBook } from "@/lib/demo-data";
import { onDemoChange } from "@/app/admin/(protected)/livres/actions";

/**
 * Returns null until the browser has read localStorage. Pages render a neutral
 * placeholder during that frame, which also keeps the pre-rendered HTML (built
 * without any storage) consistent with the first client render.
 */
export function useDemoBooks(): DemoBook[] | null {
  const [books, setBooks] = useState<DemoBook[] | null>(null);

  useEffect(() => {
    const refresh = () => setBooks(loadBooks());
    refresh();
    return onDemoChange(refresh);
  }, []);

  return books;
}
