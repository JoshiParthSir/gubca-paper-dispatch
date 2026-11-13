export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allocation_colleges: {
        Row: {
          allocation_id: string
          college_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          allocation_id: string
          college_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          allocation_id?: string
          college_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_colleges_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_colleges_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          allocated_by: string
          college_id: string | null
          created_at: string | null
          end_time: string
          exam_date: string
          id: string
          is_published: boolean | null
          paper_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          allocated_by: string
          college_id?: string | null
          created_at?: string | null
          end_time: string
          exam_date: string
          id?: string
          is_published?: boolean | null
          paper_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          allocated_by?: string
          college_id?: string | null
          created_at?: string | null
          end_time?: string
          exam_date?: string
          id?: string
          is_published?: boolean | null
          paper_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      colleges: {
        Row: {
          address: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      download_logs: {
        Row: {
          allocation_id: string
          download_time: string | null
          downloaded_by: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          allocation_id: string
          download_time?: string | null
          downloaded_by?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          allocation_id?: string
          download_time?: string | null
          downloaded_by?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_logs_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_assignments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          centre_id: string
          created_at: string
          created_by: string
          exam_date: string
          faculty_id: string
          id: string
          replaced_by: string | null
          seat_role: string
          session_id: string
          status: string
          subject_code: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          centre_id: string
          created_at?: string
          created_by?: string
          exam_date: string
          faculty_id: string
          id?: string
          replaced_by?: string | null
          seat_role: string
          session_id: string
          status?: string
          subject_code: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          centre_id?: string
          created_at?: string
          created_by?: string
          exam_date?: string
          faculty_id?: string
          id?: string
          replaced_by?: string | null
          seat_role?: string
          session_id?: string
          status?: string
          subject_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_assignments_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "duty_college_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "duty_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "duty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_college_data: {
        Row: {
          code: string
          college_id: string | null
          email: string | null
          full_name: string | null
          id: string
          pcs: number | null
          raw_name: string
          session_id: string
          students: number | null
          submitted_at: string | null
        }
        Insert: {
          code: string
          college_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          pcs?: number | null
          raw_name: string
          session_id: string
          students?: number | null
          submitted_at?: string | null
        }
        Update: {
          code?: string
          college_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          pcs?: number | null
          raw_name?: string
          session_id?: string
          students?: number | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duty_college_data_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_college_data_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_faculty: {
        Row: {
          college_data_id: string
          email: string | null
          id: string
          is_available: boolean
          is_senior: boolean
          is_visiting: boolean
          name: string
          name_key: string
          phone: string | null
          session_id: string
          subject_codes: string[]
          title: string
        }
        Insert: {
          college_data_id: string
          email?: string | null
          id?: string
          is_available?: boolean
          is_senior?: boolean
          is_visiting?: boolean
          name: string
          name_key: string
          phone?: string | null
          session_id: string
          subject_codes?: string[]
          title?: string
        }
        Update: {
          college_data_id?: string
          email?: string | null
          id?: string
          is_available?: boolean
          is_senior?: boolean
          is_visiting?: boolean
          name?: string
          name_key?: string
          phone?: string | null
          session_id?: string
          subject_codes?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_faculty_college_data_id_fkey"
            columns: ["college_data_id"]
            isOneToOne: false
            referencedRelation: "duty_college_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_faculty_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_letters: {
        Row: {
          content: Json
          faculty_id: string
          finalised_at: string | null
          finalised_by: string | null
          generated_at: string
          id: string
          sent_at: string | null
          sent_by: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          content: Json
          faculty_id: string
          finalised_at?: string | null
          finalised_by?: string | null
          generated_at?: string
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          faculty_id?: string
          finalised_at?: string | null
          finalised_by?: string | null
          generated_at?: string
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_letters_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "duty_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_letters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_sessions: {
        Row: {
          created_at: string
          created_by: string
          exam_month: string | null
          id: string
          letter_settings: Json
          published_at: string | null
          rules: Json
          semester_label: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          exam_month?: string | null
          id?: string
          letter_settings?: Json
          published_at?: string | null
          rules?: Json
          semester_label?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          exam_month?: string | null
          id?: string
          letter_settings?: Json
          published_at?: string | null
          rules?: Json
          semester_label?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      duty_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      duty_subjects: {
        Row: {
          code: string
          id: string
          is_practical: boolean
          name: string
          session_id: string
        }
        Insert: {
          code: string
          id?: string
          is_practical?: boolean
          name: string
          session_id: string
        }
        Update: {
          code?: string
          id?: string
          is_practical?: boolean
          name?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_subjects_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_timetable: {
        Row: {
          batch: string | null
          centre_id: string
          exam_date: string
          id: string
          seat_from: string | null
          seat_to: string | null
          session_id: string
          students: number | null
          subject_code: string
        }
        Insert: {
          batch?: string | null
          centre_id: string
          exam_date: string
          id?: string
          seat_from?: string | null
          seat_to?: string | null
          session_id: string
          students?: number | null
          subject_code: string
        }
        Update: {
          batch?: string | null
          centre_id?: string
          exam_date?: string
          id?: string
          seat_from?: string | null
          seat_to?: string | null
          session_id?: string
          students?: number | null
          subject_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_timetable_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "duty_college_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_timetable_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          batch_id: string
          created_at: string | null
          duration_minutes: number
          expires_at: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          google_drive_link: string | null
          id: string
          purged_at: string | null
          subject: string
          title: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          duration_minutes: number
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          google_drive_link?: string | null
          id?: string
          purged_at?: string | null
          subject: string
          title: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          duration_minutes?: number
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          google_drive_link?: string | null
          id?: string
          purged_at?: string | null
          subject?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          college_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          college_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          college_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_paper_file: { Args: { _path: string }; Returns: boolean }
      check_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      duty_cancel_and_replace: {
        Args: { _assignment: string; _new_faculty: string; _reason: string }
        Returns: string
      }
      duty_is_chair: { Args: never; Returns: boolean }
      duty_my_college_rows: { Args: { _session: string }; Returns: string[] }
      duty_session_published: { Args: { _session: string }; Returns: boolean }
      duty_visible_assignments: {
        Args: { _session: string }
        Returns: string[]
      }
      exam_ts: { Args: { _date: string; _time: string }; Returns: string }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      paper_retention: { Args: never; Returns: string }
      refresh_paper_expiry: { Args: { _paper_id: string }; Returns: undefined }
      server_now: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "chairperson" | "college_admin"
      user_role: "chairperson" | "college_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["chairperson", "college_admin"],
      user_role: ["chairperson", "college_admin"],
    },
  },
} as const
