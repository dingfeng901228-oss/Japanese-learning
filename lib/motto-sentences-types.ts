// Shared type for the MOTTO shadowing corpus (split from lib/motto-sentences.ts
// so the generated file can `import type` without needing a circular import).

export type MottoSentence = {
  id: string;
  prefix: string;
  filename: string;
  audioUrl: string;
  ja: string;
  jaHtml: string;
  zh: string;
};