// lib/types.ts
export type SiteContent = {
  logoUrl: string | null;
  hero: string[];     // carousel #1 (0–10 položiek)
  heroText: string;   // text pod 1. carouselom
  gallery: string[];  // carousel #2 (0–10 položiek)
  bodyText: string;   // text pod 2. carouselom
};
