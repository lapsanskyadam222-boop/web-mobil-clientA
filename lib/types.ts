// lib/types.ts
export type SiteContent = {
  logoUrl: string | null;
  carousel1: string[]; // 0–10 obrázkov
  text1: string;       // môže byť prázdny
  carousel2: string[]; // 0–10 obrázkov
  text2: string;       // môže byť prázdny
};
