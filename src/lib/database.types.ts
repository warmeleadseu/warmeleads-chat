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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          avatar_url: string | null
          celebration_video_end: number | null
          celebration_video_start: number | null
          celebration_video_url: string | null
          created_at: string | null
          email: string
          email_signature_html: string | null
          id: string
          is_account_manager: boolean
          is_active: boolean | null
          last_login: string | null
          name: string
          password_hash: string
          phone: string | null
          role: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          celebration_video_end?: number | null
          celebration_video_start?: number | null
          celebration_video_url?: string | null
          created_at?: string | null
          email: string
          email_signature_html?: string | null
          id?: string
          is_account_manager?: boolean
          is_active?: boolean | null
          last_login?: string | null
          name: string
          password_hash: string
          phone?: string | null
          role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          celebration_video_end?: number | null
          celebration_video_start?: number | null
          celebration_video_url?: string | null
          created_at?: string | null
          email?: string
          email_signature_html?: string | null
          id?: string
          is_account_manager?: boolean
          is_active?: boolean | null
          last_login?: string | null
          name?: string
          password_hash?: string
          phone?: string | null
          role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      adviser_availability: {
        Row: {
          created_at: string | null
          customer_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          portal_user_id: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          portal_user_id?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          portal_user_id?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adviser_availability_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adviser_availability_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_briefs: {
        Row: {
          branch: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number
          deleted_at: string | null
          geographic_targeting: Json
          id: string
          image_formats: string[]
          is_test_mode: boolean
          lead_form_id: string
          max_total_budget_cents: number
          naming_prefix: string | null
          page_id: string
          preferred_image_provider: string | null
          special_ad_category: string
          status: string
          strategy_params: Json
          strategy_plan: Json | null
          target_audience: Json
          target_cpl_cents: number | null
          target_cpql_cents: number | null
          targeting_spec: Json
          updated_at: string
          variant_count: number
          visual_dna_json: Json | null
        }
        Insert: {
          branch: string
          created_at?: string
          created_by?: string | null
          daily_budget_cents: number
          deleted_at?: string | null
          geographic_targeting?: Json
          id?: string
          image_formats?: string[]
          is_test_mode?: boolean
          lead_form_id: string
          max_total_budget_cents: number
          naming_prefix?: string | null
          page_id: string
          preferred_image_provider?: string | null
          special_ad_category?: string
          status?: string
          strategy_params?: Json
          strategy_plan?: Json | null
          target_audience?: Json
          target_cpl_cents?: number | null
          target_cpql_cents?: number | null
          targeting_spec?: Json
          updated_at?: string
          variant_count?: number
          visual_dna_json?: Json | null
        }
        Update: {
          branch?: string
          created_at?: string
          created_by?: string | null
          daily_budget_cents?: number
          deleted_at?: string | null
          geographic_targeting?: Json
          id?: string
          image_formats?: string[]
          is_test_mode?: boolean
          lead_form_id?: string
          max_total_budget_cents?: number
          naming_prefix?: string | null
          page_id?: string
          preferred_image_provider?: string | null
          special_ad_category?: string
          status?: string
          strategy_params?: Json
          strategy_plan?: Json | null
          target_audience?: Json
          target_cpl_cents?: number | null
          target_cpql_cents?: number | null
          targeting_spec?: Json
          updated_at?: string
          variant_count?: number
          visual_dna_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_briefs_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "ai_campaign_briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_budget_guards: {
        Row: {
          branch: string
          daily_budget_cents: number
          last_day_reset_at: string
          last_month_reset_at: string
          monthly_budget_cents: number
          openai_monthly_cap_cents: number
          openai_spent_month_cents: number
          spent_month_cents: number
          spent_today_cents: number
          updated_at: string
        }
        Insert: {
          branch: string
          daily_budget_cents?: number
          last_day_reset_at?: string
          last_month_reset_at?: string
          monthly_budget_cents?: number
          openai_monthly_cap_cents?: number
          openai_spent_month_cents?: number
          spent_month_cents?: number
          spent_today_cents?: number
          updated_at?: string
        }
        Update: {
          branch?: string
          daily_budget_cents?: number
          last_day_reset_at?: string
          last_month_reset_at?: string
          monthly_budget_cents?: number
          openai_monthly_cap_cents?: number
          openai_spent_month_cents?: number
          spent_month_cents?: number
          spent_today_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_budget_guards_branch_fkey"
            columns: ["branch"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
        ]
      }
      ai_campaign_decisions: {
        Row: {
          action: string
          created_at: string
          dry_run: boolean
          experiment_id: string | null
          id: string
          metrics_snapshot: Json
          reason: string | null
          variant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          dry_run?: boolean
          experiment_id?: string | null
          id?: string
          metrics_snapshot?: Json
          reason?: string | null
          variant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          dry_run?: boolean
          experiment_id?: string | null
          id?: string
          metrics_snapshot?: Json
          reason?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_decisions_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_campaign_decisions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_experiments: {
        Row: {
          brief_id: string
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          id: string
          last_optimizer_tick_at: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          phase: string
          started_at: string | null
          stop_reason: string | null
          tree_summary: Json | null
        }
        Insert: {
          brief_id: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          last_optimizer_tick_at?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          phase?: string
          started_at?: string | null
          stop_reason?: string | null
          tree_summary?: Json | null
        }
        Update: {
          brief_id?: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          last_optimizer_tick_at?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          phase?: string
          started_at?: string | null
          stop_reason?: string | null
          tree_summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_experiments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_lookalikes: {
        Row: {
          branch: string
          country: string
          created_at: string
          exclusion_audience_id: string | null
          id: string
          last_refreshed_at: string | null
          lookalike_audience_id: string | null
          notes: string | null
          ratio: number
          seed_audience_id: string | null
          source_lead_count: number
          status: string
          updated_at: string
        }
        Insert: {
          branch: string
          country: string
          created_at?: string
          exclusion_audience_id?: string | null
          id?: string
          last_refreshed_at?: string | null
          lookalike_audience_id?: string | null
          notes?: string | null
          ratio?: number
          seed_audience_id?: string | null
          source_lead_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          branch?: string
          country?: string
          created_at?: string
          exclusion_audience_id?: string | null
          id?: string
          last_refreshed_at?: string | null
          lookalike_audience_id?: string | null
          notes?: string | null
          ratio?: number
          seed_audience_id?: string | null
          source_lead_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_lookalikes_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
        ]
      }
      ai_campaign_meta_adsets: {
        Row: {
          archived_at: string | null
          created_at: string
          daily_budget_cents: number | null
          id: string
          meta_adset_id: string | null
          meta_campaign_row_id: string
          name: string
          predicted_cpl_cents: number | null
          status: string
          strategy_type: string
          targeting_summary: Json
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          id?: string
          meta_adset_id?: string | null
          meta_campaign_row_id: string
          name: string
          predicted_cpl_cents?: number | null
          status?: string
          strategy_type: string
          targeting_summary?: Json
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          id?: string
          meta_adset_id?: string | null
          meta_campaign_row_id?: string
          name?: string
          predicted_cpl_cents?: number | null
          status?: string
          strategy_type?: string
          targeting_summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_meta_adsets_meta_campaign_row_id_fkey"
            columns: ["meta_campaign_row_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_meta_campaigns: {
        Row: {
          angle: string
          archived_at: string | null
          bid_strategy: string
          created_at: string
          daily_budget_cents: number
          daily_budget_share: number
          experiment_id: string
          id: string
          meta_campaign_id: string | null
          rationale: string | null
          status: string
          updated_at: string
        }
        Insert: {
          angle: string
          archived_at?: string | null
          bid_strategy?: string
          created_at?: string
          daily_budget_cents?: number
          daily_budget_share?: number
          experiment_id: string
          id?: string
          meta_campaign_id?: string | null
          rationale?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          angle?: string
          archived_at?: string | null
          bid_strategy?: string
          created_at?: string
          daily_budget_cents?: number
          daily_budget_share?: number
          experiment_id?: string
          id?: string
          meta_campaign_id?: string | null
          rationale?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_meta_campaigns_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_variants: {
        Row: {
          angle: string | null
          aspect_ratio: string | null
          brief_id: string
          created_at: string
          creative_style: string | null
          cta: string
          description: string | null
          experiment_id: string | null
          framework: string | null
          generation: Json
          headline: string
          id: string
          image_brief_json: Json | null
          image_model: string | null
          image_prompt: string | null
          image_provider: string | null
          image_regeneration_count: number
          image_storage_path: string | null
          image_url: string | null
          lineage_depth: number
          meta_ad_id: string | null
          meta_adset_row_id: string | null
          meta_creative_id: string | null
          meta_image_hash: string | null
          overlay_text: string | null
          overlay_used: boolean | null
          parent_variant_id: string | null
          policy_precheck: Json
          predicted_cpl_cents: number | null
          primary_text: string
          prompt_used: string | null
          scale_count: number
          status: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          angle?: string | null
          aspect_ratio?: string | null
          brief_id: string
          created_at?: string
          creative_style?: string | null
          cta: string
          description?: string | null
          experiment_id?: string | null
          framework?: string | null
          generation?: Json
          headline: string
          id?: string
          image_brief_json?: Json | null
          image_model?: string | null
          image_prompt?: string | null
          image_provider?: string | null
          image_regeneration_count?: number
          image_storage_path?: string | null
          image_url?: string | null
          lineage_depth?: number
          meta_ad_id?: string | null
          meta_adset_row_id?: string | null
          meta_creative_id?: string | null
          meta_image_hash?: string | null
          overlay_text?: string | null
          overlay_used?: boolean | null
          parent_variant_id?: string | null
          policy_precheck?: Json
          predicted_cpl_cents?: number | null
          primary_text: string
          prompt_used?: string | null
          scale_count?: number
          status?: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          angle?: string | null
          aspect_ratio?: string | null
          brief_id?: string
          created_at?: string
          creative_style?: string | null
          cta?: string
          description?: string | null
          experiment_id?: string | null
          framework?: string | null
          generation?: Json
          headline?: string
          id?: string
          image_brief_json?: Json | null
          image_model?: string | null
          image_prompt?: string | null
          image_provider?: string | null
          image_regeneration_count?: number
          image_storage_path?: string | null
          image_url?: string | null
          lineage_depth?: number
          meta_ad_id?: string | null
          meta_adset_row_id?: string | null
          meta_creative_id?: string | null
          meta_image_hash?: string | null
          overlay_text?: string | null
          overlay_used?: boolean | null
          parent_variant_id?: string | null
          policy_precheck?: Json
          predicted_cpl_cents?: number | null
          primary_text?: string
          prompt_used?: string | null
          scale_count?: number
          status?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_variants_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_campaign_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_campaign_variants_meta_adset_row_id_fkey"
            columns: ["meta_adset_row_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_meta_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_campaign_variants_parent_variant_id_fkey"
            columns: ["parent_variant_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lead_forms_created: {
        Row: {
          ai_cost_cents: number
          ai_model: string | null
          branch: string
          context_card_json: Json | null
          created_at: string
          created_by: string | null
          form_id: string
          form_name: string
          form_type: string
          id: string
          locale: string
          page_id: string
          privacy_policy_url: string | null
          questions_count: number
          questions_json: Json
          thank_you_page_json: Json | null
        }
        Insert: {
          ai_cost_cents?: number
          ai_model?: string | null
          branch: string
          context_card_json?: Json | null
          created_at?: string
          created_by?: string | null
          form_id: string
          form_name: string
          form_type?: string
          id?: string
          locale?: string
          page_id: string
          privacy_policy_url?: string | null
          questions_count?: number
          questions_json?: Json
          thank_you_page_json?: Json | null
        }
        Update: {
          ai_cost_cents?: number
          ai_model?: string | null
          branch?: string
          context_card_json?: Json | null
          created_at?: string
          created_by?: string | null
          form_id?: string
          form_name?: string
          form_type?: string
          id?: string
          locale?: string
          page_id?: string
          privacy_policy_url?: string | null
          questions_count?: number
          questions_json?: Json
          thank_you_page_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_lead_forms_created_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "ai_lead_forms_created_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_openai_usage: {
        Row: {
          branch: string | null
          brief_id: string | null
          cost_cents: number
          created_at: string
          id: string
          input_tokens: number | null
          kind: string
          metadata: Json
          model: string
          output_tokens: number | null
          variant_id: string | null
        }
        Insert: {
          branch?: string | null
          brief_id?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind: string
          metadata?: Json
          model: string
          output_tokens?: number | null
          variant_id?: string | null
        }
        Update: {
          branch?: string | null
          brief_id?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind?: string
          metadata?: Json
          model?: string
          output_tokens?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_openai_usage_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "ai_openai_usage_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_openai_usage_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ai_campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      am_elearning_progress: {
        Row: {
          admin_user_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          module_id: string
          quiz_answers: Json | null
          quiz_score: number | null
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          module_id: string
          quiz_answers?: Json | null
          quiz_score?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          module_id?: string
          quiz_answers?: Json | null
          quiz_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "am_elearning_progress_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      am_leaderboard_batch_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_batch_id: string
          id: string
          reason: string | null
          year_month: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_batch_id: string
          id?: string
          reason?: string | null
          year_month: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_batch_id?: string
          id?: string
          reason?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "am_leaderboard_batch_exclusions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "am_leaderboard_batch_exclusions_customer_batch_id_fkey"
            columns: ["customer_batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      am_leaderboard_manual_lines: {
        Row: {
          admin_user_id: string
          amount_euro: number
          counts_as_batch: number
          created_at: string
          created_by: string | null
          id: string
          label: string
          year_month: string
        }
        Insert: {
          admin_user_id: string
          amount_euro: number
          counts_as_batch?: number
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          year_month: string
        }
        Update: {
          admin_user_id?: string
          amount_euro?: number
          counts_as_batch?: number
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "am_leaderboard_manual_lines_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "am_leaderboard_manual_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      am_targets: {
        Row: {
          admin_user_id: string
          bonus_amount: number | null
          celebrated: boolean | null
          created_at: string | null
          id: string
          label: string
          notes: string | null
          period_end: string
          period_start: string
          status: string | null
          target_type: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          bonus_amount?: number | null
          celebrated?: boolean | null
          created_at?: string | null
          id?: string
          label: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string | null
          target_type: string
          target_value: number
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          bonus_amount?: number | null
          celebrated?: boolean | null
          created_at?: string | null
          id?: string
          label?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          target_type?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "am_targets_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      appointment_batches: {
        Row: {
          account_manager_id: string | null
          appointments_delivered: number
          appointments_per_day: number | null
          appointments_per_week: number | null
          batch_size: number
          branch: string
          created_at: string | null
          customer_id: string
          id: string
          is_paid: boolean
          lead_filters: Json | null
          mollie_payment_id: string | null
          notes: string | null
          price_per_appointment: number
          starts_at: string | null
          status: string
          total_price: number
          updated_at: string | null
        }
        Insert: {
          account_manager_id?: string | null
          appointments_delivered?: number
          appointments_per_day?: number | null
          appointments_per_week?: number | null
          batch_size: number
          branch: string
          created_at?: string | null
          customer_id: string
          id?: string
          is_paid?: boolean
          lead_filters?: Json | null
          mollie_payment_id?: string | null
          notes?: string | null
          price_per_appointment: number
          starts_at?: string | null
          status?: string
          total_price: number
          updated_at?: string | null
        }
        Update: {
          account_manager_id?: string | null
          appointments_delivered?: number
          appointments_per_day?: number | null
          appointments_per_week?: number | null
          batch_size?: number
          branch?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          is_paid?: boolean
          lead_filters?: Json | null
          mollie_payment_id?: string | null
          notes?: string | null
          price_per_appointment?: number
          starts_at?: string | null
          status?: string
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_batches_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_batches_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "appointment_batches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_orders: {
        Row: {
          appointments_per_day: number | null
          appointments_per_week: number | null
          batch_id: string | null
          batch_size: number
          branch: string
          created_at: string | null
          customer_id: string
          id: string
          lead_filters: Json | null
          mollie_payment_id: string | null
          notes: string | null
          paid_at: string | null
          price_per_appointment: number
          source_batch_id: string | null
          status: string
          total_price: number
          updated_at: string | null
          welcome_discount_applied: boolean | null
        }
        Insert: {
          appointments_per_day?: number | null
          appointments_per_week?: number | null
          batch_id?: string | null
          batch_size: number
          branch: string
          created_at?: string | null
          customer_id: string
          id?: string
          lead_filters?: Json | null
          mollie_payment_id?: string | null
          notes?: string | null
          paid_at?: string | null
          price_per_appointment: number
          source_batch_id?: string | null
          status?: string
          total_price: number
          updated_at?: string | null
          welcome_discount_applied?: boolean | null
        }
        Update: {
          appointments_per_day?: number | null
          appointments_per_week?: number | null
          batch_id?: string | null
          batch_size?: number
          branch?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          lead_filters?: Json | null
          mollie_payment_id?: string | null
          notes?: string | null
          paid_at?: string | null
          price_per_appointment?: number
          source_batch_id?: string | null
          status?: string
          total_price?: number
          updated_at?: string | null
          welcome_discount_applied?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "appointment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_orders_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "appointment_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_orders_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "appointment_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          batch_id: string | null
          branch: string
          cancelled_at: string | null
          cancelled_reason: string | null
          city: string | null
          completed_at: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          created_by_admin_id: string | null
          created_by_portal_user_id: string | null
          customer_id: string
          duration_minutes: number
          house_number: string | null
          id: string
          lead_assignment_id: string | null
          lead_confirmation_sent_at: string | null
          lead_id: string | null
          lead_reminder_sent_at: string | null
          notes: string | null
          portal_user_id: string | null
          postcode: string | null
          reminder_sent_at: string | null
          rescheduled_from_id: string | null
          source: string
          starts_at: string
          status: string
          street: string | null
          travel_buffer_minutes: number
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          branch: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          city?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          created_by_portal_user_id?: string | null
          customer_id: string
          duration_minutes?: number
          house_number?: string | null
          id?: string
          lead_assignment_id?: string | null
          lead_confirmation_sent_at?: string | null
          lead_id?: string | null
          lead_reminder_sent_at?: string | null
          notes?: string | null
          portal_user_id?: string | null
          postcode?: string | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          source?: string
          starts_at: string
          status?: string
          street?: string | null
          travel_buffer_minutes?: number
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          branch?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          city?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          created_by_portal_user_id?: string | null
          customer_id?: string
          duration_minutes?: number
          house_number?: string | null
          id?: string
          lead_assignment_id?: string | null
          lead_confirmation_sent_at?: string | null
          lead_id?: string | null
          lead_reminder_sent_at?: string | null
          notes?: string | null
          portal_user_id?: string | null
          postcode?: string | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          street?: string | null
          travel_buffer_minutes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "appointment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "appointments_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_portal_user_id_fkey"
            columns: ["created_by_portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_assignment_id_fkey"
            columns: ["lead_assignment_id"]
            isOneToOne: false
            referencedRelation: "lead_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          admin_name: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          created_at: string | null
          customer_id: string
          date: string
          end_time: string | null
          id: string
          portal_user_id: string | null
          reason: string | null
          start_time: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          date: string
          end_time?: string | null
          id?: string
          portal_user_id?: string | null
          reason?: string | null
          start_time?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          date?: string
          end_time?: string | null
          id?: string
          portal_user_id?: string | null
          reason?: string | null
          start_time?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_overrides_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_delivery_daily: {
        Row: {
          batch_id: string
          day_date: string
          delivered_count: number
        }
        Insert: {
          batch_id: string
          day_date: string
          delivered_count?: number
        }
        Update: {
          batch_id?: string
          day_date?: string
          delivered_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_delivery_daily_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_orders: {
        Row: {
          batch_id: string | null
          batch_kind: string
          batch_size: number
          branch: string
          created_at: string | null
          customer_id: string
          delivery_model: string
          id: string
          lead_branch_slug: string | null
          lead_filters: Json | null
          leads_per_day: number | null
          leads_per_week: number | null
          lookback_days: number | null
          mollie_payment_id: string | null
          niche_title: string | null
          notes: string | null
          paid_at: string | null
          price_per_lead: number
          source_batch_id: string | null
          status: string | null
          total_price: number
          welcome_discount_applied: boolean | null
        }
        Insert: {
          batch_id?: string | null
          batch_kind?: string
          batch_size: number
          branch: string
          created_at?: string | null
          customer_id: string
          delivery_model?: string
          id?: string
          lead_branch_slug?: string | null
          lead_filters?: Json | null
          leads_per_day?: number | null
          leads_per_week?: number | null
          lookback_days?: number | null
          mollie_payment_id?: string | null
          niche_title?: string | null
          notes?: string | null
          paid_at?: string | null
          price_per_lead: number
          source_batch_id?: string | null
          status?: string | null
          total_price: number
          welcome_discount_applied?: boolean | null
        }
        Update: {
          batch_id?: string | null
          batch_kind?: string
          batch_size?: number
          branch?: string
          created_at?: string | null
          customer_id?: string
          delivery_model?: string
          id?: string
          lead_branch_slug?: string | null
          lead_filters?: Json | null
          leads_per_day?: number | null
          leads_per_week?: number | null
          lookback_days?: number | null
          mollie_payment_id?: string | null
          niche_title?: string | null
          notes?: string | null
          paid_at?: string | null
          price_per_lead?: number
          source_batch_id?: string | null
          status?: string | null
          total_price?: number
          welcome_discount_applied?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_orders_lead_branch_slug_fkey"
            columns: ["lead_branch_slug"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "batch_orders_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_blocked: {
        Row: {
          created_at: string | null
          date: string
          id: string
          reason: string | null
          time: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          reason?: string | null
          time?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          reason?: string | null
          time?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          branch: string | null
          company: string | null
          created_at: string | null
          date: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string
          status: string | null
          time: string
        }
        Insert: {
          branch?: string | null
          company?: string | null
          created_at?: string | null
          date: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone: string
          status?: string | null
          time: string
        }
        Update: {
          branch?: string | null
          company?: string | null
          created_at?: string | null
          date?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string
          status?: string | null
          time?: string
        }
        Relationships: []
      }
      branch_fields: {
        Row: {
          branch_id: string
          created_at: string | null
          field_type: string
          id: string
          is_required: boolean | null
          key: string
          label: string
          options: string[] | null
          sort_order: number | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          key: string
          label: string
          options?: string[] | null
          sort_order?: number | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          key?: string
          label?: string
          options?: string[] | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_fields_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          appointment_min_batch_size: number | null
          appointment_nationwide_discount: number | null
          appointment_pricing_tiers: Json | null
          color: string
          created_at: string | null
          default_appointment_duration: number | null
          default_travel_buffer: number | null
          description: string | null
          hidden_from_admin: boolean
          id: string
          is_active: boolean | null
          is_partner_branch: boolean
          min_batch_size: number | null
          name: string
          nationwide_discount: number | null
          pricing_tiers: Json | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          appointment_min_batch_size?: number | null
          appointment_nationwide_discount?: number | null
          appointment_pricing_tiers?: Json | null
          color?: string
          created_at?: string | null
          default_appointment_duration?: number | null
          default_travel_buffer?: number | null
          description?: string | null
          hidden_from_admin?: boolean
          id?: string
          is_active?: boolean | null
          is_partner_branch?: boolean
          min_batch_size?: number | null
          name: string
          nationwide_discount?: number | null
          pricing_tiers?: Json | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          appointment_min_batch_size?: number | null
          appointment_nationwide_discount?: number | null
          appointment_pricing_tiers?: Json | null
          color?: string
          created_at?: string | null
          default_appointment_duration?: number | null
          default_travel_buffer?: number | null
          description?: string | null
          hidden_from_admin?: boolean
          id?: string
          is_active?: boolean | null
          is_partner_branch?: boolean
          min_batch_size?: number | null
          name?: string
          nationwide_discount?: number | null
          pricing_tiers?: Json | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      celebration_events: {
        Row: {
          created_at: string | null
          displayed_at: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          displayed_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          displayed_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      customer_appointment_pricing: {
        Row: {
          branch_slug: string
          created_at: string | null
          customer_id: string
          id: string
          nationwide_discount: number | null
          notes: string | null
          pricing_tiers: Json
          updated_at: string | null
        }
        Insert: {
          branch_slug: string
          created_at?: string | null
          customer_id: string
          id?: string
          nationwide_discount?: number | null
          notes?: string | null
          pricing_tiers?: Json
          updated_at?: string | null
        }
        Update: {
          branch_slug?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          nationwide_discount?: number | null
          notes?: string | null
          pricing_tiers?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_appointment_pricing_branch_slug_fkey"
            columns: ["branch_slug"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "customer_appointment_pricing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_batches: {
        Row: {
          account_manager_id: string | null
          batch_kind: string
          batch_size: number
          branch: string
          compensations: Json | null
          completed_at: string | null
          created_at: string | null
          customer_id: string
          delivery_model: string
          distribution_priority: boolean
          id: string
          is_paid: boolean | null
          lead_branch_slug: string | null
          lead_filters: Json | null
          leads_delivered: number | null
          leads_delivered_external: number | null
          leads_per_day: number | null
          leads_per_week: number | null
          lookback_days: number | null
          meta_campaign_ids: string[]
          meta_campaign_paused_ids: string[]
          meta_campaign_sync_enabled: boolean
          meta_sync_last_attempt_at: string | null
          meta_sync_last_error: string | null
          meta_sync_last_success_at: string | null
          mollie_payment_id: string | null
          niche_title: string | null
          notes: string | null
          notified_80pct: boolean | null
          notified_completed: boolean | null
          notified_reminder: boolean | null
          price_per_lead: number | null
          starts_at: string | null
          status: string | null
          total_price: number | null
        }
        Insert: {
          account_manager_id?: string | null
          batch_kind?: string
          batch_size: number
          branch: string
          compensations?: Json | null
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          delivery_model?: string
          distribution_priority?: boolean
          id?: string
          is_paid?: boolean | null
          lead_branch_slug?: string | null
          lead_filters?: Json | null
          leads_delivered?: number | null
          leads_delivered_external?: number | null
          leads_per_day?: number | null
          leads_per_week?: number | null
          lookback_days?: number | null
          meta_campaign_ids?: string[]
          meta_campaign_paused_ids?: string[]
          meta_campaign_sync_enabled?: boolean
          meta_sync_last_attempt_at?: string | null
          meta_sync_last_error?: string | null
          meta_sync_last_success_at?: string | null
          mollie_payment_id?: string | null
          niche_title?: string | null
          notes?: string | null
          notified_80pct?: boolean | null
          notified_completed?: boolean | null
          notified_reminder?: boolean | null
          price_per_lead?: number | null
          starts_at?: string | null
          status?: string | null
          total_price?: number | null
        }
        Update: {
          account_manager_id?: string | null
          batch_kind?: string
          batch_size?: number
          branch?: string
          compensations?: Json | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          delivery_model?: string
          distribution_priority?: boolean
          id?: string
          is_paid?: boolean | null
          lead_branch_slug?: string | null
          lead_filters?: Json | null
          leads_delivered?: number | null
          leads_delivered_external?: number | null
          leads_per_day?: number | null
          leads_per_week?: number | null
          lookback_days?: number | null
          meta_campaign_ids?: string[]
          meta_campaign_paused_ids?: string[]
          meta_campaign_sync_enabled?: boolean
          meta_sync_last_attempt_at?: string | null
          meta_sync_last_error?: string | null
          meta_sync_last_success_at?: string | null
          mollie_payment_id?: string | null
          niche_title?: string | null
          notes?: string | null
          notified_80pct?: boolean | null
          notified_completed?: boolean | null
          notified_reminder?: boolean | null
          price_per_lead?: number | null
          starts_at?: string | null
          status?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_batches_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_batches_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "customer_batches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_batches_lead_branch_slug_fkey"
            columns: ["lead_branch_slug"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
        ]
      }
      customer_branch_meta_defaults: {
        Row: {
          branch: string
          customer_id: string
          meta_campaign_ids: string[]
          meta_campaign_paused_ids: string[]
          meta_campaign_sync_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch: string
          customer_id: string
          meta_campaign_ids?: string[]
          meta_campaign_paused_ids?: string[]
          meta_campaign_sync_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch?: string
          customer_id?: string
          meta_campaign_ids?: string[]
          meta_campaign_paused_ids?: string[]
          meta_campaign_sync_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_branch_meta_defaults_branch_fkey"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "customer_branch_meta_defaults_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_branch_meta_defaults_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_integrations: {
        Row: {
          access_token_enc: string | null
          client_id_enc: string | null
          client_secret_enc: string | null
          connected_at: string | null
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token_enc: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          client_id_enc?: string | null
          client_secret_enc?: string | null
          connected_at?: string | null
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token_enc?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          client_id_enc?: string | null
          client_secret_enc?: string | null
          connected_at?: string | null
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token_enc?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_integrations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_pricing: {
        Row: {
          branch_slug: string
          created_at: string | null
          customer_id: string
          id: string
          nationwide_discount: number | null
          notes: string | null
          pricing_tiers: Json
          updated_at: string | null
        }
        Insert: {
          branch_slug: string
          created_at?: string | null
          customer_id: string
          id?: string
          nationwide_discount?: number | null
          notes?: string | null
          pricing_tiers?: Json
          updated_at?: string | null
        }
        Update: {
          branch_slug?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          nationwide_discount?: number | null
          notes?: string | null
          pricing_tiers?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_pricing_branch_slug_fkey"
            columns: ["branch_slug"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "customer_pricing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_targets: {
        Row: {
          country: string | null
          created_at: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          label: string
          lat: number | null
          lng: number | null
          provinces: string[] | null
          radius_km: number
          target_type: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          label: string
          lat?: number | null
          lng?: number | null
          provinces?: string[] | null
          radius_km?: number
          target_type?: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          lat?: number | null
          lng?: number | null
          provinces?: string[] | null
          radius_km?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_targets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_manager_id: string | null
          address: string | null
          branches: string[] | null
          bulk_price_per_lead: number | null
          city: string | null
          contact_person: string | null
          country: string
          created_at: string | null
          demo_mode: boolean
          email: string | null
          email_notifications: boolean | null
          exclude_customers: string[] | null
          house_number: string | null
          id: string
          is_active: boolean | null
          kvk_nummer: string | null
          last_login_at: string | null
          last_seen_at: string | null
          login_count: number | null
          name: string
          notes: string | null
          notification_frequency: string | null
          password_hash: string | null
          phone: string | null
          portal_active: boolean | null
          portal_password: string | null
          agents_see_unassigned_leads: boolean
          postcode: string | null
          preferred_crm_provider: string | null
          signup_source: string | null
          street: string | null
          updated_at: string | null
          vat_id: string | null
          welcome_offer_expires_at: string | null
          welcome_offer_used: boolean | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          branches?: string[] | null
          bulk_price_per_lead?: number | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string | null
          demo_mode?: boolean
          email?: string | null
          email_notifications?: boolean | null
          exclude_customers?: string[] | null
          house_number?: string | null
          id?: string
          is_active?: boolean | null
          kvk_nummer?: string | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          name: string
          notes?: string | null
          notification_frequency?: string | null
          password_hash?: string | null
          phone?: string | null
          portal_active?: boolean | null
          portal_password?: string | null
          agents_see_unassigned_leads?: boolean
          postcode?: string | null
          preferred_crm_provider?: string | null
          signup_source?: string | null
          street?: string | null
          updated_at?: string | null
          vat_id?: string | null
          welcome_offer_expires_at?: string | null
          welcome_offer_used?: boolean | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          branches?: string[] | null
          bulk_price_per_lead?: number | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string | null
          demo_mode?: boolean
          email?: string | null
          email_notifications?: boolean | null
          exclude_customers?: string[] | null
          house_number?: string | null
          id?: string
          is_active?: boolean | null
          kvk_nummer?: string | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          name?: string
          notes?: string | null
          notification_frequency?: string | null
          password_hash?: string | null
          phone?: string | null
          portal_active?: boolean | null
          portal_password?: string | null
          agents_see_unassigned_leads?: boolean
          postcode?: string | null
          preferred_crm_provider?: string | null
          signup_source?: string | null
          street?: string | null
          updated_at?: string | null
          vat_id?: string | null
          welcome_offer_expires_at?: string | null
          welcome_offer_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          admin_id: string
          audience_summary: Json | null
          created_at: string
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          opt_out: number
          options: Json | null
          sent: number
          status: string
          template_key: string
          total: number
        }
        Insert: {
          admin_id: string
          audience_summary?: Json | null
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          opt_out?: number
          options?: Json | null
          sent?: number
          status?: string
          template_key: string
          total?: number
        }
        Update: {
          admin_id?: string
          audience_summary?: Json | null
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          opt_out?: number
          options?: Json | null
          sent?: number
          status?: string
          template_key?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_jobs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          bcc_emails: string[] | null
          body_text: string | null
          cc_emails: string[] | null
          clicks_count: number | null
          created_at: string | null
          customer_id: string | null
          error: string | null
          from_admin_id: string | null
          html: string
          id: string
          last_clicked_at: string | null
          last_opened_at: string | null
          metadata: Json | null
          opens_count: number | null
          prospect_id: string | null
          provider_message_id: string | null
          reply_to: string | null
          status: string
          subject: string
          template_key: string | null
          template_options: Json | null
          to_email: string
          to_name: string | null
          type: string
          unsubscribe_token: string | null
        }
        Insert: {
          bcc_emails?: string[] | null
          body_text?: string | null
          cc_emails?: string[] | null
          clicks_count?: number | null
          created_at?: string | null
          customer_id?: string | null
          error?: string | null
          from_admin_id?: string | null
          html: string
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          opens_count?: number | null
          prospect_id?: string | null
          provider_message_id?: string | null
          reply_to?: string | null
          status?: string
          subject: string
          template_key?: string | null
          template_options?: Json | null
          to_email: string
          to_name?: string | null
          type: string
          unsubscribe_token?: string | null
        }
        Update: {
          bcc_emails?: string[] | null
          body_text?: string | null
          cc_emails?: string[] | null
          clicks_count?: number | null
          created_at?: string | null
          customer_id?: string | null
          error?: string | null
          from_admin_id?: string | null
          html?: string
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          opens_count?: number | null
          prospect_id?: string | null
          provider_message_id?: string | null
          reply_to?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          template_options?: Json | null
          to_email?: string
          to_name?: string | null
          type?: string
          unsubscribe_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_from_admin_id_fkey"
            columns: ["from_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_optouts: {
        Row: {
          created_at: string
          email: string
          scope: string
          source: string | null
          unsubscribed_via_message_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          scope?: string
          source?: string | null
          unsubscribed_via_message_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          scope?: string
          source?: string | null
          unsubscribed_via_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_optouts_unsubscribed_via_message_id_fkey"
            columns: ["unsubscribed_via_message_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          assignment_id: string
          attempts: number
          created_at: string
          customer_id: string
          error_message: string | null
          id: string
          lead_id: string
          provider: string
          status: string
          teamleader_contact_id: string | null
          teamleader_deal_id: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          attempts?: number
          created_at?: string
          customer_id: string
          error_message?: string | null
          id?: string
          lead_id: string
          provider?: string
          status?: string
          teamleader_contact_id?: string | null
          teamleader_deal_id?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          attempts?: number
          created_at?: string
          customer_id?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          provider?: string
          status?: string
          teamleader_contact_id?: string | null
          teamleader_deal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "lead_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_batch_id: string | null
          batch_id: string | null
          batch_order_id: string | null
          btw_amount: number
          btw_percentage: number
          created_at: string | null
          customer_address: string | null
          customer_email: string
          customer_id: string
          customer_kvk: string | null
          customer_name: string
          customer_vat_id: string | null
          description: string
          id: string
          invoice_number: string
          line_items: Json
          mollie_payment_id: string | null
          paid_at: string | null
          status: string | null
          subtotal: number
          total_incl_btw: number
          uploaded_pdf_path: string | null
          vat_mode: string
        }
        Insert: {
          appointment_batch_id?: string | null
          batch_id?: string | null
          batch_order_id?: string | null
          btw_amount: number
          btw_percentage?: number
          created_at?: string | null
          customer_address?: string | null
          customer_email: string
          customer_id: string
          customer_kvk?: string | null
          customer_name: string
          customer_vat_id?: string | null
          description: string
          id?: string
          invoice_number: string
          line_items?: Json
          mollie_payment_id?: string | null
          paid_at?: string | null
          status?: string | null
          subtotal: number
          total_incl_btw: number
          uploaded_pdf_path?: string | null
          vat_mode?: string
        }
        Update: {
          appointment_batch_id?: string | null
          batch_id?: string | null
          batch_order_id?: string | null
          btw_amount?: number
          btw_percentage?: number
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string
          customer_id?: string
          customer_kvk?: string | null
          customer_name?: string
          customer_vat_id?: string | null
          description?: string
          id?: string
          invoice_number?: string
          line_items?: Json
          mollie_payment_id?: string | null
          paid_at?: string | null
          status?: string | null
          subtotal?: number
          total_incl_btw?: number
          uploaded_pdf_path?: string | null
          vat_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_batch_id_fkey"
            columns: ["appointment_batch_id"]
            isOneToOne: false
            referencedRelation: "appointment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_batch_order_id_fkey"
            columns: ["batch_order_id"]
            isOneToOne: false
            referencedRelation: "batch_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          assigned_at: string | null
          batch_id: string | null
          customer_id: string
          distance_km: number | null
          id: string
          lead_id: string
          notities: string | null
          portal_user_id: string | null
          source: string
          status: string | null
          terminal_status_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          batch_id?: string | null
          customer_id: string
          distance_km?: number | null
          id?: string
          lead_id: string
          notities?: string | null
          portal_user_id?: string | null
          source?: string
          status?: string | null
          terminal_status_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          batch_id?: string | null
          customer_id?: string
          distance_km?: number | null
          id?: string
          lead_id?: string
          notities?: string | null
          portal_user_id?: string | null
          source?: string
          status?: string | null
          terminal_status_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_exports: {
        Row: {
          added_to_portal: boolean | null
          admin_id: string | null
          admin_name: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          filters: Json | null
          format: string
          id: string
          lead_count: number
          lead_ids: string[] | null
        }
        Insert: {
          added_to_portal?: boolean | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          filters?: Json | null
          format?: string
          id?: string
          lead_count?: number
          lead_ids?: string[] | null
        }
        Update: {
          added_to_portal?: boolean | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          filters?: Json | null
          format?: string
          id?: string
          lead_count?: number
          lead_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_exports_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_exports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string
          id: string
          lead_id: string
          rating: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          lead_id: string
          rating: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          lead_id?: string
          rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_feedback_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reclamations: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          customer_id: string
          description: string | null
          id: string
          lead_id: string
          reason: string
          resolved_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          id?: string
          lead_id: string
          reason: string
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          lead_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_reclamations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_reclamations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_customer_ids: string[]
          boorwerkzaamheden_toegestaan: string | null
          branch: string
          bron: string | null
          budget: string | null
          bulk_export_count: number | null
          created_at: string | null
          custom_fields: Json | null
          customer_id: string | null
          dynamisch_contract: string | null
          email: string | null
          hoeveel_ruimtes: string | null
          huisnummer: string | null
          id: string
          is_assigned: boolean | null
          koelen_verwarmen: string | null
          koop_of_huur: string | null
          land: string | null
          lat: number | null
          lead_cost: number | null
          lng: number | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_leadgen_id: string | null
          naam_klant: string
          notities: string | null
          phone_valid: boolean | null
          plaatsnaam: string | null
          postcode: string | null
          provincie: string | null
          quality_score: number | null
          reden_thuisbatterij: string | null
          status: string | null
          stroomverbruik: string | null
          telefoonnummer: string | null
          type_airco: string | null
          updated_at: string | null
          wervingsdatum: string | null
          wervingsdatum_unknown: boolean
          zakelijk: string | null
          zonnepanelen: string | null
        }
        Insert: {
          assigned_customer_ids?: string[]
          boorwerkzaamheden_toegestaan?: string | null
          branch: string
          bron?: string | null
          budget?: string | null
          bulk_export_count?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          dynamisch_contract?: string | null
          email?: string | null
          hoeveel_ruimtes?: string | null
          huisnummer?: string | null
          id?: string
          is_assigned?: boolean | null
          koelen_verwarmen?: string | null
          koop_of_huur?: string | null
          land?: string | null
          lat?: number | null
          lead_cost?: number | null
          lng?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_leadgen_id?: string | null
          naam_klant: string
          notities?: string | null
          phone_valid?: boolean | null
          plaatsnaam?: string | null
          postcode?: string | null
          provincie?: string | null
          quality_score?: number | null
          reden_thuisbatterij?: string | null
          status?: string | null
          stroomverbruik?: string | null
          telefoonnummer?: string | null
          type_airco?: string | null
          updated_at?: string | null
          wervingsdatum?: string | null
          wervingsdatum_unknown?: boolean
          zakelijk?: string | null
          zonnepanelen?: string | null
        }
        Update: {
          assigned_customer_ids?: string[]
          boorwerkzaamheden_toegestaan?: string | null
          branch?: string
          bron?: string | null
          budget?: string | null
          bulk_export_count?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          dynamisch_contract?: string | null
          email?: string | null
          hoeveel_ruimtes?: string | null
          huisnummer?: string | null
          id?: string
          is_assigned?: boolean | null
          koelen_verwarmen?: string | null
          koop_of_huur?: string | null
          land?: string | null
          lat?: number | null
          lead_cost?: number | null
          lng?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_leadgen_id?: string | null
          naam_klant?: string
          notities?: string | null
          phone_valid?: boolean | null
          plaatsnaam?: string | null
          postcode?: string | null
          provincie?: string | null
          quality_score?: number | null
          reden_thuisbatterij?: string | null
          status?: string | null
          stroomverbruik?: string | null
          telefoonnummer?: string | null
          type_airco?: string | null
          updated_at?: string | null
          wervingsdatum?: string | null
          wervingsdatum_unknown?: boolean
          zakelijk?: string | null
          zonnepanelen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_fk"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_test_events: {
        Row: {
          consumed: boolean | null
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          consumed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          consumed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "live_test_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_spend: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_name: string | null
          adset_id: string
          adset_name: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number
          cpl: number | null
          date: string
          id: string
          impressions: number
          leads_count: number
          spend: number
          synced_at: string | null
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_name?: string | null
          adset_id: string
          adset_name?: string | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number
          cpl?: number | null
          date: string
          id?: string
          impressions?: number
          leads_count?: number
          spend?: number
          synced_at?: string | null
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_name?: string | null
          adset_id?: string
          adset_name?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          cpl?: number | null
          date?: string
          id?: string
          impressions?: number
          leads_count?: number
          spend?: number
          synced_at?: string | null
        }
        Relationships: []
      }
      meta_targeting_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          query: string
          result: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          query: string
          result: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          query?: string
          result?: Json
        }
        Relationships: []
      }
      migration_log: {
        Row: {
          id: number
          migration: string
          payload: Json
          ran_at: string
        }
        Insert: {
          id?: number
          migration: string
          payload: Json
          ran_at?: string
        }
        Update: {
          id?: number
          migration?: string
          payload?: Json
          ran_at?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          customer_id: string | null
          expires_at: string
          id: string
          portal_user_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          expires_at: string
          id?: string
          portal_user_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          portal_user_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_tokens_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_activity_log: {
        Row: {
          action: string
          created_at: string | null
          customer_id: string
          details: Json | null
          id: string
          portal_user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          customer_id: string
          details?: Json | null
          id?: string
          portal_user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          customer_id?: string
          details?: Json | null
          id?: string
          portal_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_activity_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_user_activity_log_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          assignment_rules: Json | null
          created_at: string | null
          customer_id: string
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_seen_at: string | null
          login_count: number | null
          name: string
          password_hash: string
          permissions: string[] | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          assignment_rules?: Json | null
          created_at?: string | null
          customer_id: string
          email: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          name: string
          password_hash: string
          permissions?: string[] | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          assignment_rules?: Json | null
          created_at?: string | null
          customer_id?: string
          email?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          name?: string
          password_hash?: string
          permissions?: string[] | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_activities: {
        Row: {
          admin_user_id: string | null
          body: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          prospect_id: string
          title: string
          type: string
        }
        Insert: {
          admin_user_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prospect_id: string
          title: string
          type: string
        }
        Update: {
          admin_user_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prospect_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_activities_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_imports: {
        Row: {
          admin_id: string | null
          assignment_admin_ids: string[] | null
          assignment_strategy: string | null
          column_mapping: Json | null
          created_at: string | null
          default_branches: string[] | null
          duplicate_rows: number | null
          error_rows: number | null
          errors: Json | null
          filename: string | null
          format: string | null
          id: string
          imported_rows: number | null
          skipped_rows: number | null
          total_rows: number | null
        }
        Insert: {
          admin_id?: string | null
          assignment_admin_ids?: string[] | null
          assignment_strategy?: string | null
          column_mapping?: Json | null
          created_at?: string | null
          default_branches?: string[] | null
          duplicate_rows?: number | null
          error_rows?: number | null
          errors?: Json | null
          filename?: string | null
          format?: string | null
          id?: string
          imported_rows?: number | null
          skipped_rows?: number | null
          total_rows?: number | null
        }
        Update: {
          admin_id?: string | null
          assignment_admin_ids?: string[] | null
          assignment_strategy?: string | null
          column_mapping?: Json | null
          created_at?: string | null
          default_branches?: string[] | null
          duplicate_rows?: number | null
          error_rows?: number | null
          errors?: Json | null
          filename?: string | null
          format?: string | null
          id?: string
          imported_rows?: number | null
          skipped_rows?: number | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_imports_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_tasks: {
        Row: {
          assigned_to_admin_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by_admin_id: string | null
          description: string | null
          due_at: string | null
          id: string
          prospect_id: string
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_admin_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          prospect_id: string
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_admin_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          prospect_id?: string
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_tasks_assigned_to_admin_id_fkey"
            columns: ["assigned_to_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_tasks_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          account_manager_id: string | null
          address: string | null
          assigned_at: string | null
          branches: string[] | null
          city: string | null
          company_name: string
          company_size: string | null
          contact_person: string | null
          converted_at: string | null
          converted_to_customer_id: string | null
          country: string | null
          created_at: string | null
          created_by_admin_id: string | null
          email: string | null
          id: string
          kvk_nummer: string | null
          last_contacted_at: string | null
          lost_reason: string | null
          next_action_at: string | null
          notes: string | null
          phone: string | null
          phone_digits: string | null
          postcode: string | null
          source: string | null
          source_metadata: Json | null
          status: string
          status_changed_at: string | null
          updated_at: string | null
          vat_id: string | null
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          assigned_at?: string | null
          branches?: string[] | null
          city?: string | null
          company_name: string
          company_size?: string | null
          contact_person?: string | null
          converted_at?: string | null
          converted_to_customer_id?: string | null
          country?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email?: string | null
          id?: string
          kvk_nummer?: string | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_digits?: string | null
          postcode?: string | null
          source?: string | null
          source_metadata?: Json | null
          status?: string
          status_changed_at?: string | null
          updated_at?: string | null
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          assigned_at?: string | null
          branches?: string[] | null
          city?: string | null
          company_name?: string
          company_size?: string | null
          contact_person?: string | null
          converted_at?: string | null
          converted_to_customer_id?: string | null
          country?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email?: string | null
          id?: string
          kvk_nummer?: string | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_digits?: string | null
          postcode?: string | null
          source?: string | null
          source_metadata?: Json | null
          status?: string
          status_changed_at?: string | null
          updated_at?: string | null
          vat_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_converted_to_customer_id_fkey"
            columns: ["converted_to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          customer_id: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          customer_id: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          customer_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number | null
          key: string
          window_start: string | null
        }
        Insert: {
          count?: number | null
          key: string
          window_start?: string | null
        }
        Update: {
          count?: number | null
          key?: string
          window_start?: string | null
        }
        Relationships: []
      }
      team_calendar_event_participants: {
        Row: {
          added_at: string
          admin_user_id: string
          event_id: string
        }
        Insert: {
          added_at?: string
          admin_user_id: string
          event_id: string
        }
        Update: {
          added_at?: string
          admin_user_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_calendar_event_participants_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_calendar_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "team_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_calendar_events: {
        Row: {
          all_day: boolean
          confirmation_email_log_id: string | null
          confirmation_sent_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          ends_at: string
          event_type: string
          id: string
          location: string | null
          meeting_invite_email_log_id: string | null
          meeting_invite_sent_at: string | null
          meeting_url: string | null
          prospect_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          confirmation_email_log_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          ends_at: string
          event_type: string
          id?: string
          location?: string | null
          meeting_invite_email_log_id?: string | null
          meeting_invite_sent_at?: string | null
          meeting_url?: string | null
          prospect_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          confirmation_email_log_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          location?: string | null
          meeting_invite_email_log_id?: string | null
          meeting_invite_sent_at?: string | null
          meeting_url?: string | null
          prospect_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_calendar_events_confirmation_email_log_id_fkey"
            columns: ["confirmation_email_log_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_calendar_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_calendar_events_meeting_invite_email_log_id_fkey"
            columns: ["meeting_invite_email_log_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_calendar_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_keys: {
        Row: {
          branch: string
          created_at: string | null
          customer_id: string | null
          form_id: string | null
          id: string
          is_active: boolean | null
          key: string
          label: string
          last_used_at: string | null
          request_count: number | null
        }
        Insert: {
          branch: string
          created_at?: string | null
          customer_id?: string | null
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          last_used_at?: string | null
          request_count?: number | null
        }
        Update: {
          branch?: string
          created_at?: string | null
          customer_id?: string | null
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          last_used_at?: string | null
          request_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_keys_branch_fk"
            columns: ["branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "webhook_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_assignments_by_customer: {
        Args: { customer_ids: string[] }
        Returns: {
          bulk_count: number
          customer_id: string
          total_count: number
        }[]
      }
      decrement_bulk_export_count: {
        Args: { lead_ids: string[] }
        Returns: undefined
      }
      delete_branch_cascade: { Args: { p_slug: string }; Returns: undefined }
      get_lead_facets: {
        Args: {
          p_assignment?: string
          p_branches?: string[]
          p_bulk_status?: string
          p_customers?: string[]
          p_date_from?: string
          p_date_to?: string
          p_exclude_customers?: string[]
          p_include_unknown_date?: boolean
          p_phone_valid?: string
          p_provinces?: string[]
          p_search?: string
          p_sources?: string[]
          p_statuses?: string[]
        }
        Returns: Json
      }
      increment_bulk_export_count: {
        Args: { lead_ids: string[] }
        Returns: undefined
      }
      last_n_completed_amsterdam_days: {
        Args: { n: number }
        Returns: string[]
      }
      live_revenue_stats: { Args: never; Returns: Json }
      nextval_invoice: { Args: never; Returns: number }
      period_profit_stats: { Args: never; Returns: Json }
      prospect_ids_by_phone_digits: {
        Args: { digits: string; p_am_id?: string }
        Returns: string[]
      }
      refresh_batch_delivery_daily: {
        Args: { p_days?: number }
        Returns: undefined
      }
      refresh_prospect_next_action: {
        Args: { p_prospect_id: string }
        Returns: undefined
      }
      reserve_branch_budget: {
        Args: { p_amount_cents: number; p_branch: string }
        Returns: Json
      }
      reserve_openai_budget: {
        Args: { p_amount_cents: number; p_branch: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
