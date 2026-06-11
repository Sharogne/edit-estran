import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-in replacements for Next.js navigation APIs.
// Always use these (not next/link, next/navigation) inside the public site.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
