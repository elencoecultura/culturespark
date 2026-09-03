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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
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
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      badges_awarded: {
        Row: {
          awarded_at: string
          badge_key: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      behavioral_tests: {
        Row: {
          answers: Json | null
          combination: string | null
          created_at: string
          id: string
          primary_essence: string
          profile_type: string
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          secondary_essence: string | null
          share_with_leadership: boolean
          taken_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          combination?: string | null
          created_at?: string
          id?: string
          primary_essence: string
          profile_type?: string
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          secondary_essence?: string | null
          share_with_leadership?: boolean
          taken_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          combination?: string | null
          created_at?: string
          id?: string
          primary_essence?: string
          profile_type?: string
          score_c?: number
          score_d?: number
          score_i?: number
          score_s?: number
          secondary_essence?: string | null
          share_with_leadership?: boolean
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evaluation_competencies: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          expected_score: number
          how_to_evaluate: string | null
          id: string
          name: string
          pillar_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          expected_score?: number
          how_to_evaluate?: string | null
          id?: string
          name: string
          pillar_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          expected_score?: number
          how_to_evaluate?: string | null
          id?: string
          name?: string
          pillar_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_competencies_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "evaluation_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          name: string
          quarter: string | null
          starts_on: string
          status: Database["public"]["Enums"]["evaluation_cycle_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          name: string
          quarter?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["evaluation_cycle_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          name?: string
          quarter?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["evaluation_cycle_status"]
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_documents: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          kind: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          kind: string
          mime_type?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          kind?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_documents_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_evaluators: {
        Row: {
          created_at: string
          evaluation_id: string
          evaluator_id: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          evaluator_id: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          evaluator_id?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_evaluators_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_pdis: {
        Row: {
          actions: string | null
          checklist: Json
          competency_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_on: string | null
          evaluation_id: string
          id: string
          objective: string
          status: Database["public"]["Enums"]["pdi_status"]
          updated_at: string
        }
        Insert: {
          actions?: string | null
          checklist?: Json
          competency_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          evaluation_id: string
          id?: string
          objective: string
          status?: Database["public"]["Enums"]["pdi_status"]
          updated_at?: string
        }
        Update: {
          actions?: string | null
          checklist?: Json
          competency_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          evaluation_id?: string
          id?: string
          objective?: string
          status?: Database["public"]["Enums"]["pdi_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_pdis_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "evaluation_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_pdis_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_pillars: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          tagline: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          tagline?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
        }
        Relationships: []
      }
      evaluation_scale: {
        Row: {
          description: string
          label: string
          score: number
        }
        Insert: {
          description: string
          label: string
          score: number
        }
        Update: {
          description?: string
          label?: string
          score?: number
        }
        Relationships: []
      }
      evaluation_scores: {
        Row: {
          comment: string | null
          competency_id: string
          created_at: string
          evaluation_id: string
          id: string
          score: number
          scored_by: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          competency_id: string
          created_at?: string
          evaluation_id: string
          id?: string
          score: number
          scored_by?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          competency_id?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          score?: number
          scored_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "evaluation_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_id: string
          evaluatee_id: string
          id: string
          meeting_at: string | null
          notes: string | null
          overall_score: number | null
          spirit_amar: Database["public"]["Enums"]["spirit_level"] | null
          spirit_honrar: Database["public"]["Enums"]["spirit_level"] | null
          spirit_justo: Database["public"]["Enums"]["spirit_level"] | null
          spirit_servir: Database["public"]["Enums"]["spirit_level"] | null
          spirit_verdadeiro: Database["public"]["Enums"]["spirit_level"] | null
          status: Database["public"]["Enums"]["evaluation_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_id: string
          evaluatee_id: string
          id?: string
          meeting_at?: string | null
          notes?: string | null
          overall_score?: number | null
          spirit_amar?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_honrar?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_justo?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_servir?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_verdadeiro?: Database["public"]["Enums"]["spirit_level"] | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_id?: string
          evaluatee_id?: string
          id?: string
          meeting_at?: string | null
          notes?: string | null
          overall_score?: number | null
          spirit_amar?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_honrar?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_justo?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_servir?: Database["public"]["Enums"]["spirit_level"] | null
          spirit_verdadeiro?: Database["public"]["Enums"]["spirit_level"] | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "evaluation_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_cycle_snapshots: {
        Row: {
          attraction: string | null
          breakdown: Json
          created_at: string
          cycle_end: string
          cycle_start: string
          full_name: string | null
          id: string
          negocio: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          setor: string | null
          total_points: number
          user_id: string
        }
        Insert: {
          attraction?: string | null
          breakdown?: Json
          created_at?: string
          cycle_end: string
          cycle_start: string
          full_name?: string | null
          id?: string
          negocio?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          setor?: string | null
          total_points?: number
          user_id: string
        }
        Update: {
          attraction?: string | null
          breakdown?: Json
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          full_name?: string | null
          id?: string
          negocio?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          setor?: string | null
          total_points?: number
          user_id?: string
        }
        Relationships: []
      }
      iluminari_moments: {
        Row: {
          audio_path: string | null
          author_id: string
          created_at: string
          id: string
          image_paths: string[]
          mentioned_user_id: string | null
          message: string | null
        }
        Insert: {
          audio_path?: string | null
          author_id: string
          created_at?: string
          id?: string
          image_paths?: string[]
          mentioned_user_id?: string | null
          message?: string | null
        }
        Update: {
          audio_path?: string | null
          author_id?: string
          created_at?: string
          id?: string
          image_paths?: string[]
          mentioned_user_id?: string | null
          message?: string | null
        }
        Relationships: []
      }
      job_requests: {
        Row: {
          activities: string
          attraction: string
          budget: string | null
          contract: string
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          department: string
          id: string
          level: string
          manager_name: string
          model: string
          reason: string
          requirements: string
          start_date: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          type: string
          updated_at: string
          urgency: string
          workload: string
        }
        Insert: {
          activities: string
          attraction: string
          budget?: string | null
          contract: string
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          department: string
          id?: string
          level: string
          manager_name: string
          model: string
          reason: string
          requirements: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          type: string
          updated_at?: string
          urgency: string
          workload: string
        }
        Update: {
          activities?: string
          attraction?: string
          budget?: string | null
          contract?: string
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          department?: string
          id?: string
          level?: string
          manager_name?: string
          model?: string
          reason?: string
          requirements?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          type?: string
          updated_at?: string
          urgency?: string
          workload?: string
        }
        Relationships: []
      }
      journey_absences: {
        Row: {
          absence_date: string
          attachment_path: string | null
          created_at: string
          id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_date: string
          attachment_path?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_date?: string
          attachment_path?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_progress: {
        Row: {
          completed_at: string
          id: string
          step_key: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          step_key: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          step_key?: string
          user_id?: string
        }
        Relationships: []
      }
      kudos: {
        Row: {
          category: string | null
          created_at: string
          flag_reason: string | null
          flagged: boolean
          from_user: string
          id: string
          message: string
          to_user: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          from_user: string
          id?: string
          message: string
          to_user: string
        }
        Update: {
          category?: string | null
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          from_user?: string
          id?: string
          message?: string
          to_user?: string
        }
        Relationships: []
      }
      kudos_likes: {
        Row: {
          created_at: string
          id: string
          kudos_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kudos_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kudos_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_likes_kudos_id_fkey"
            columns: ["kudos_id"]
            isOneToOne: false
            referencedRelation: "kudos"
            referencedColumns: ["id"]
          },
        ]
      }
      low_energy_alerts: {
        Row: {
          id: string
          streak_len: number
          triggered_at: string
          user_id: string
        }
        Insert: {
          id?: string
          streak_len: number
          triggered_at?: string
          user_id: string
        }
        Update: {
          id?: string
          streak_len?: number
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_checkins: {
        Row: {
          created_at: string
          id: string
          mood: number
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: number
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: number
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          score: number
          survey_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          score: number
          survey_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          score?: number
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          active: boolean
          closes_at: string
          created_at: string
          created_by: string | null
          id: string
          opens_at: string
          question: string
          title: string
        }
        Insert: {
          active?: boolean
          closes_at: string
          created_at?: string
          created_by?: string | null
          id?: string
          opens_at?: string
          question?: string
          title?: string
        }
        Update: {
          active?: boolean
          closes_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          opens_at?: string
          question?: string
          title?: string
        }
        Relationships: []
      }
      org_units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          points: number
          ref_id: string
          season: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          points: number
          ref_id: string
          season: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          points?: number
          ref_id?: string
          season?: string
          user_id?: string
        }
        Relationships: []
      }
      pre_registrations: {
        Row: {
          cargo: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          name_normalized: string | null
          negocio: string
          perfil: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          name_normalized?: string | null
          negocio: string
          perfil: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          name_normalized?: string | null
          negocio?: string
          perfil?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: string
          profile_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          profile_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          profile_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          area: string | null
          attraction: string | null
          birth_date: string | null
          co_leader_id: string | null
          cpf: string | null
          created_at: string
          days_off: string[] | null
          department: string | null
          email: string | null
          first_login_at: string | null
          full_name: string
          hero_id: string | null
          id: string
          manager_id: string | null
          negocio: string | null
          role_title: string | null
          setor: string | null
          updated_at: string
          weekly_hours: number | null
          wifi_bypass: boolean
        }
        Insert: {
          active?: boolean
          area?: string | null
          attraction?: string | null
          birth_date?: string | null
          co_leader_id?: string | null
          cpf?: string | null
          created_at?: string
          days_off?: string[] | null
          department?: string | null
          email?: string | null
          first_login_at?: string | null
          full_name?: string
          hero_id?: string | null
          id: string
          manager_id?: string | null
          negocio?: string | null
          role_title?: string | null
          setor?: string | null
          updated_at?: string
          weekly_hours?: number | null
          wifi_bypass?: boolean
        }
        Update: {
          active?: boolean
          area?: string | null
          attraction?: string | null
          birth_date?: string | null
          co_leader_id?: string | null
          cpf?: string | null
          created_at?: string
          days_off?: string[] | null
          department?: string | null
          email?: string | null
          first_login_at?: string | null
          full_name?: string
          hero_id?: string | null
          id?: string
          manager_id?: string | null
          negocio?: string | null
          role_title?: string | null
          setor?: string | null
          updated_at?: string
          weekly_hours?: number | null
          wifi_bypass?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          attraction: string
          completed_full: boolean
          created_at: string
          created_by: string | null
          days_off: string[]
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          week_start: string
          weekly_hours: number
        }
        Insert: {
          attraction: string
          completed_full?: boolean
          created_at?: string
          created_by?: string | null
          days_off?: string[]
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          week_start: string
          weekly_hours?: number
        }
        Update: {
          attraction?: string
          completed_full?: boolean
          created_at?: string
          created_by?: string | null
          days_off?: string[]
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      wifi_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          ip: string
          label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ip: string
          label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ip?: string
          label?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          _kind: string
          _points: number
          _ref_id: string
          _user_id: string
        }
        Returns: undefined
      }
      can_access_evaluation: {
        Args: { _evaluation_id: string; _user_id: string }
        Returns: boolean
      }
      complete_journey_step: {
        Args: { _step_key: string }
        Returns: {
          completed_at: string
          id: string
          step_key: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_cycle_start: { Args: never; Returns: string }
      current_season: { Args: { _at?: string }; Returns: string }
      generate_evaluations_for_cycle: {
        Args: { _cycle_id: string }
        Returns: number
      }
      generate_hero_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_evaluator_of: {
        Args: { _evaluation_id: string; _user_id: string }
        Returns: boolean
      }
      is_leader_of: {
        Args: { _leader: string; _member: string }
        Returns: boolean
      }
      is_manager_of: {
        Args: { _manager: string; _member: string }
        Returns: boolean
      }
      lookup_pre_registration: {
        Args: { _email: string; _full_name: string }
        Returns: {
          already_claimed: boolean
          full_name: string
          id: string
        }[]
      }
      map_perfil_to_role: {
        Args: { _perfil: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      my_email: { Args: never; Returns: string }
      normalize_name: { Args: { _s: string }; Returns: string }
      recompute_badges: { Args: { _user_id: string }; Returns: undefined }
      search_pre_registrations: {
        Args: { _limit?: number; _q: string }
        Returns: {
          already_claimed: boolean
          full_name: string
          id: string
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_gamification_cycle: {
        Args: { _cycle_end: string; _cycle_start: string }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "leader"
        | "messenger"
        | "elenco"
        | "lider"
        | "gerente"
        | "direcao"
      evaluation_cycle_status:
        | "rascunho"
        | "aberto"
        | "em_andamento"
        | "encerrado"
      evaluation_status:
        | "nao_iniciada"
        | "em_andamento"
        | "pendente_lancamento"
        | "pendente_documento"
        | "concluida"
      job_status:
        | "pending"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "in_recruitment"
        | "finished"
      pdi_status: "aberto" | "em_andamento" | "concluido" | "cancelado"
      spirit_level: "abaixo" | "no_esperado" | "acima"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "leader",
        "messenger",
        "elenco",
        "lider",
        "gerente",
        "direcao",
      ],
      evaluation_cycle_status: [
        "rascunho",
        "aberto",
        "em_andamento",
        "encerrado",
      ],
      evaluation_status: [
        "nao_iniciada",
        "em_andamento",
        "pendente_lancamento",
        "pendente_documento",
        "concluida",
      ],
      job_status: [
        "pending",
        "changes_requested",
        "approved",
        "rejected",
        "in_recruitment",
        "finished",
      ],
      pdi_status: ["aberto", "em_andamento", "concluido", "cancelado"],
      spirit_level: ["abaixo", "no_esperado", "acima"],
    },
  },
} as const
