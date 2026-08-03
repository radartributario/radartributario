import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard"],
    },
    sitemap: "https://comparetributo.com.br/sitemap.xml",
    host: "https://comparetributo.com.br",
  };
}
