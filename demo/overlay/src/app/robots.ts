import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// STATIC DEMO BUILD — identical to the real route, plus the force-static flag
// that `output: "export"` requires on metadata routes.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin"] },
    sitemap: `${siteConfig.baseUrl}/sitemap.xml`,
  };
}
