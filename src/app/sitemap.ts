import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://quiznurse.com";
  const lastModified = new Date();

  const publicRoutes = [
    "",
    "/exams",
    "/study",
    "/care-plans",
    "/mark-k",
    "/community",
    "/faq",
    "/nclex",
    "/teas",
    "/rn-nursing",
    "/pages/exams/nclex-rn",
    "/pages/exams/nclex-pn",
    "/pages/exams/ati-teas",
    "/pages/exams/hesi-a2",
    "/pages/exams/lpn-nursing",
    "/pages/exams/rn-nursing",
    "/pages/entrance",
    "/pages/about-us",
    "/pages/mission",
    "/pages/values",
    "/pages/team",
    "/pages/contact-us",
    "/pages/terms-of-service",
    "/pages/privacy",
    "/learner/library",
    "/sign-in",
    "/sign-up",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/learner/library" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route.startsWith("/learner/library") ? 0.9 : 0.8,
  }));
}
