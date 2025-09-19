// lib/types.ts

export type ThemeConfig = {
  mode: 'light' | 'dark' | 'custom';
  /** Použité len pri mode === 'custom' */
  bgColor?: string;    // napr. "#ffffff"
  textColor?: string;  // napr. "#111111"
};

export type SiteContent = {
  logoUrl: string | null;
  carousel: string[]; // presne stringové URL
  text: string;
  /** Nepovinné pre spätnú kompatibilitu so staršími JSON */
  theme?: ThemeConfig;
};

// --- Rezervačný systém: Režim 1/2

export type ReservationMode = 1 | 2;

export type Service = {
  id: string;
  name: string;
  durationMin: number;   // minúty trvania služby
  isActive: boolean;
};

export type WorkWindow = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
};

export type DayWorkPlan = {
  date: string;           // "YYYY-MM-DD"
  windows: WorkWindow[];  // [{start,end}, ...]
  intervalMin: number;    // napr. 15
  bufferMin: number;      // napr. 5
};

export type Settings = {
  reservationMode: ReservationMode; // 1 | 2
  defaultIntervalMin: number;
  defaultBufferMin: number;
};
