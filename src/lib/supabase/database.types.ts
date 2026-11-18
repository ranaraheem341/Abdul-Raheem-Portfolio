// Schema contract through 202611180006_upwork_profile.sql. Regenerate with the
// Supabase CLI after applying future migrations (see SUPABASE_SETUP.md).
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};
type Ordered = { id: string; sort_order: number };

export type Database = {
  public: {
    Tables: {
      profile: Table<{ id: boolean; full_name: string; headline: string; biography: string; location: string; professional_summary: string }, "full_name">;
      profile_draft: Table<{ id: boolean; payload: Omit<import("../admin/profile-validation").ProfileValues, "upwork"> & { upwork?: string }; revision: number; published_revision: number | null }, "payload">;
      record_drafts: Table<import("../admin/records-validation").RecordDraft, "kind" | "id" | "payload" | "revision">;
      links: Table<Ordered & { label: string; url: string }, "label" | "url">;
      experience: Table<Ordered & { archived: boolean; role: string; company: string; start_date: string; end_date: string | null; highlights: string[] }, "role" | "company" | "start_date">;
      skills: Table<Ordered & { archived: boolean; name: string; category: string }, "name" | "category">;
      education: Table<Ordered & { archived: boolean; institution: string; qualification: string; start_date: string | null; end_date: string | null; description: string }, "institution" | "qualification">;
      certifications: Table<Ordered & { archived: boolean; name: string; issuer: string; issued_on: string | null; expires_on: string | null; credential_url: string | null }, "name" | "issuer">;
      projects: Table<Ordered & { archived: boolean; title: string; description: string; technologies: string[]; project_url: string | null; source_url: string | null }, "title">;
      media: {
        Row: MediaRow;
        Insert: Pick<MediaRow, "object_path" | "mime_type" | "size_bytes"> & Partial<Omit<MediaRow, "object_path" | "mime_type" | "size_bytes">>;
        Update: Partial<MediaRow>;
        Relationships: [{ foreignKeyName: "media_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      has_published_profile: { Args: Record<PropertyKey, never>; Returns: boolean };
      write_record_editor: {
        Args: { record_kind: import("../admin/records-validation").RecordKind; record_id: string; content: import("../admin/records-validation").RecordPayload; expected_revision: number; operation: string };
        Returns: import("../admin/records-validation").RecordDraft[];
      };
      write_media_editor: {
        Args: { media_id: string; expected_revision: number; operation: string; metadata: { [key: string]: string | number | null } };
        Returns: MediaRow[];
      };
      is_portfolio_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      write_profile_editor: {
        Args: { content: import("../admin/profile-validation").ProfileValues; expected_revision: number; publish_now: boolean };
        Returns: { revision: number; published_revision: number | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type MediaRow = {
  id: string;
  purpose: "legacy" | "photo" | "cv" | "screenshot";
  draft_project_id: string | null;
  project_kind: string;
  deleting: boolean;
  published: boolean;
  revision: number;
  bucket_id: string;
  object_path: string;
  alt_text: string;
  mime_type: string;
  size_bytes: number;
  project_id: string | null;
};
