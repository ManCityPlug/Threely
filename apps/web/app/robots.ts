import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/register", "/payment"],
      },
    ],
    sitemap: "https://threely.co/sitemap.xml",
  };
}
