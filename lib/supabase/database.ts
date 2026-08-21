/**
 * Minimal Database type for Supabase.
 *
 * The project doesn't have a generated database.types.ts (no Supabase
 * CLI in the dev loop). We declare only the tables / columns that the
 * Chrome-extension API routes and the new settings page touch. The
 * existing vocabulary list / detail pages still use `select("*")` +
 * explicit casts to VocabularyItem, so they don't need typing here.
 *
 * If/when the team adopts `supabase gen types typescript`, this file
 * becomes redundant and can be deleted in favour of the generated one.
 *
 * TypeScript-only — no runtime cost. Apply via the generic:
 *
 *   const admin = createAdminClient<Database>();
 */

export type VocabularyType = "word" | "phrase" | "grammar" | "sentence";

export type Database = {
  public: {
    Tables: {
      // Chrome-extension one-time codes (0005_chrome_extension.sql).
      extension_connect_codes: {
        Row: {
          code_hash: string;
          user_id: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          code_hash: string;
          user_id: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          code_hash: string;
          user_id: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      // Chrome-extension long-term Bearer tokens.
      extension_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          label: string | null;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          label?: string | null;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          token_hash: string;
          label: string | null;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        }>;
        Relationships: [];
      };
      // vocabulary_items — full schema (0003 + 0005 migrations).
      vocabulary_items: {
        Row: {
          id: string;
          user_id: string;
          type: VocabularyType;
          word: string;
          reading: string | null;
          meaning: string;
          language: string;
          part_of_speech: string | null;
          level: string | null;
          mastery: number;
          created_at: string;
          updated_at: string;
          source: string | null;
          source_url: string | null;
          source_title: string | null;
          source_domain: string | null;
          source_favicon: string | null;
          source_added_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: VocabularyType;
          word: string;
          reading?: string | null;
          meaning: string;
          language?: string;
          part_of_speech?: string | null;
          level?: string | null;
          mastery?: number;
          created_at?: string;
          updated_at?: string;
          source?: string | null;
          source_url?: string | null;
          source_title?: string | null;
          source_domain?: string | null;
          source_favicon?: string | null;
          source_added_at?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          type: VocabularyType;
          word: string;
          reading: string | null;
          meaning: string;
          language: string;
          part_of_speech: string | null;
          level: string | null;
          mastery: number;
          created_at: string;
          updated_at: string;
          source: string | null;
          source_url: string | null;
          source_title: string | null;
          source_domain: string | null;
          source_favicon: string | null;
          source_added_at: string | null;
        }>;
        Relationships: [];
      };
      // vocabulary_examples — for auto-attaching primary example.
      vocabulary_examples: {
        Row: {
          id: string;
          vocabulary_id: string;
          sentence: string;
          translation: string | null;
          reading: string | null;
          is_primary: boolean;
          generated_by_ai: boolean;
          user_edited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vocabulary_id: string;
          sentence: string;
          translation?: string | null;
          reading?: string | null;
          is_primary?: boolean;
          generated_by_ai?: boolean;
          user_edited?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          vocabulary_id: string;
          sentence: string;
          translation: string | null;
          reading: string | null;
          is_primary: boolean;
          generated_by_ai: boolean;
          user_edited: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      // vocabulary_reviews — for SRS queue hookup.
      vocabulary_reviews: {
        Row: {
          id: string;
          user_id: string;
          vocabulary_id: string;
          example_id: string | null;
          review_type: string | null;
          user_answer: string | null;
          correct: boolean | null;
          reviewed_at: string | null;
          next_review_at: string | null;
          interval_days: number;
          ease_factor: number;
          mastery: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          vocabulary_id: string;
          example_id?: string | null;
          review_type?: string | null;
          user_answer?: string | null;
          correct?: boolean | null;
          reviewed_at?: string | null;
          next_review_at?: string | null;
          interval_days?: number;
          ease_factor?: number;
          mastery?: number;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          vocabulary_id: string;
          example_id: string | null;
          review_type: string | null;
          user_answer: string | null;
          correct: boolean | null;
          reviewed_at: string | null;
          next_review_at: string | null;
          interval_days: number;
          ease_factor: number;
          mastery: number;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};