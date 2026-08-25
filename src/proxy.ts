import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection + redirect (/ -> /fr) for the public site only.
export default createMiddleware(routing);

export const config = {
  // Everything EXCEPT: admin back office, API routes, the OpenGraph image
  // endpoint, Next internals and static files (anything with a dot).
  matcher: "/((?!api|admin|og|_next|_vercel|.*\..*).*)",
};
