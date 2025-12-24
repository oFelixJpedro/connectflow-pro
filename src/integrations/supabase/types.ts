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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_behavior_alerts: {
        Row: {
          agent_id: string
          ai_confidence: number | null
          alert_type: string
          company_id: string
          contact_id: string
          conversation_id: string
          created_at: string
          description: string
          detected_at: string
          id: string
          lead_was_rude: boolean | null
          message_excerpt: string | null
          message_id: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          title: string
        }
        Insert: {
          agent_id: string
          ai_confidence?: number | null
          alert_type: string
          company_id: string
          contact_id: string
          conversation_id: string
          created_at?: string
          description: string
          detected_at?: string
          id?: string
          lead_was_rude?: boolean | null
          message_excerpt?: string | null
          message_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          agent_id?: string
          ai_confidence?: number | null
          alert_type?: string
          company_id?: string
          contact_id?: string
          conversation_id?: string
          created_at?: string
          description?: string
          detected_at?: string
          id?: string
          lead_was_rude?: boolean | null
          message_excerpt?: string | null
          message_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_behavior_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_behavior_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_behavior_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_behavior_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_behavior_alerts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_behavior_alerts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_connections: {
        Row: {
          agent_id: string
          connection_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          agent_id: string
          connection_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          agent_id?: string
          connection_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_logs: {
        Row: {
          action_type: string
          agent_id: string | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_text: string | null
          metadata: Json | null
          output_text: string | null
          processing_time_ms: number | null
          tokens_used: number | null
        }
        Insert: {
          action_type: string
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_text?: string | null
          metadata?: Json | null
          output_text?: string | null
          processing_time_ms?: number | null
          tokens_used?: number | null
        }
        Update: {
          action_type?: string
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_text?: string | null
          metadata?: Json | null
          output_text?: string | null
          processing_time_ms?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_media: {
        Row: {
          agent_id: string
          created_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          media_content: string | null
          media_key: string
          media_type: string
          media_url: string | null
          mime_type: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_content?: string | null
          media_key: string
          media_type: string
          media_url?: string | null
          mime_type?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_content?: string | null
          media_key?: string
          media_type?: string
          media_url?: string | null
          mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_media_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_templates: {
        Row: {
          agent_type: string
          category: string | null
          company_info_template: Json | null
          created_at: string | null
          created_by: string | null
          default_delay_seconds: number | null
          default_speech_speed: number | null
          default_voice_name: string | null
          description: string | null
          faq_template: string | null
          id: string
          is_active: boolean | null
          name: string
          rules_template: string | null
          script_template: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          agent_type: string
          category?: string | null
          company_info_template?: Json | null
          created_at?: string | null
          created_by?: string | null
          default_delay_seconds?: number | null
          default_speech_speed?: number | null
          default_voice_name?: string | null
          description?: string | null
          faq_template?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rules_template?: string | null
          script_template?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          agent_type?: string
          category?: string | null
          company_info_template?: Json | null
          created_at?: string | null
          created_by?: string | null
          default_delay_seconds?: number | null
          default_speech_speed?: number | null
          default_voice_name?: string | null
          description?: string | null
          faq_template?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rules_template?: string | null
          script_template?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          activation_triggers: string[] | null
          agent_type: string
          audio_always_respond_audio: boolean | null
          audio_enabled: boolean | null
          audio_respond_with_audio: boolean | null
          audio_temperature: number | null
          company_id: string
          company_info: Json | null
          contract_link: string | null
          created_at: string | null
          created_by: string | null
          deactivate_on_human_message: string | null
          deactivate_temporary_minutes: number | null
          delay_seconds: number | null
          description: string | null
          disqualification_signs: string | null
          faq_content: string | null
          id: string
          is_primary: boolean | null
          language_code: string | null
          message_batch_seconds: number | null
          name: string
          parent_agent_id: string | null
          paused_until: string | null
          qualification_summary: string | null
          require_activation_trigger: boolean | null
          rules_content: string | null
          script_content: string | null
          specialty_keywords: string[] | null
          speech_speed: number | null
          split_message_delay_seconds: number | null
          split_response_enabled: boolean | null
          status: string | null
          temperature: number | null
          updated_at: string | null
          voice_name: string | null
        }
        Insert: {
          activation_triggers?: string[] | null
          agent_type: string
          audio_always_respond_audio?: boolean | null
          audio_enabled?: boolean | null
          audio_respond_with_audio?: boolean | null
          audio_temperature?: number | null
          company_id: string
          company_info?: Json | null
          contract_link?: string | null
          created_at?: string | null
          created_by?: string | null
          deactivate_on_human_message?: string | null
          deactivate_temporary_minutes?: number | null
          delay_seconds?: number | null
          description?: string | null
          disqualification_signs?: string | null
          faq_content?: string | null
          id?: string
          is_primary?: boolean | null
          language_code?: string | null
          message_batch_seconds?: number | null
          name: string
          parent_agent_id?: string | null
          paused_until?: string | null
          qualification_summary?: string | null
          require_activation_trigger?: boolean | null
          rules_content?: string | null
          script_content?: string | null
          specialty_keywords?: string[] | null
          speech_speed?: number | null
          split_message_delay_seconds?: number | null
          split_response_enabled?: boolean | null
          status?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice_name?: string | null
        }
        Update: {
          activation_triggers?: string[] | null
          agent_type?: string
          audio_always_respond_audio?: boolean | null
          audio_enabled?: boolean | null
          audio_respond_with_audio?: boolean | null
          audio_temperature?: number | null
          company_id?: string
          company_info?: Json | null
          contract_link?: string | null
          created_at?: string | null
          created_by?: string | null
          deactivate_on_human_message?: string | null
          deactivate_temporary_minutes?: number | null
          delay_seconds?: number | null
          description?: string | null
          disqualification_signs?: string | null
          faq_content?: string | null
          id?: string
          is_primary?: boolean | null
          language_code?: string | null
          message_batch_seconds?: number | null
          name?: string
          parent_agent_id?: string | null
          paused_until?: string | null
          qualification_summary?: string | null
          require_activation_trigger?: boolean | null
          rules_content?: string | null
          script_content?: string | null
          specialty_keywords?: string[] | null
          speech_speed?: number | null
          split_message_delay_seconds?: number | null
          split_response_enabled?: boolean | null
          status?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_states: {
        Row: {
          activated_at: string | null
          agent_id: string | null
          conversation_id: string
          created_at: string | null
          current_sub_agent_id: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          id: string
          last_response_at: string | null
          messages_processed: number | null
          metadata: Json | null
          paused_until: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          agent_id?: string | null
          conversation_id: string
          created_at?: string | null
          current_sub_agent_id?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          id?: string
          last_response_at?: string | null
          messages_processed?: number | null
          metadata?: Json | null
          paused_until?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          agent_id?: string | null
          conversation_id?: string
          created_at?: string | null
          current_sub_agent_id?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          id?: string
          last_response_at?: string | null
          messages_processed?: number | null
          metadata?: Json | null
          paused_until?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_states_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_states_current_sub_agent_id_fkey"
            columns: ["current_sub_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          company_id: string | null
          created_at: string | null
          estimated_cost: number | null
          function_name: string
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string
          output_tokens: number | null
          processing_time_ms: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          function_name: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model: string
          output_tokens?: number | null
          processing_time_ms?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string
          output_tokens?: number | null
          processing_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_summaries: {
        Row: {
          contact_id: string | null
          conversation_id: string
          created_at: string | null
          generated_by: string | null
          id: string
          media_analyzed: Json | null
          message_count: number
          summary: string
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          conversation_id: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          media_analyzed?: Json | null
          message_count?: number
          summary: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          media_analyzed?: Json | null
          message_count?: number
          summary?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_summaries_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_reports: {
        Row: {
          agents_analysis: Json | null
          anticipated_at: string | null
          anticipated_by: string | null
          average_score: number | null
          avg_response_time_minutes: number | null
          classification: string | null
          closed_deals: number | null
          company_id: string
          contacts_by_state: Json | null
          conversion_rate: number | null
          created_at: string | null
          criteria_scores: Json | null
          critical_issues: string[] | null
          deals_by_state: Json | null
          final_recommendation: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          insights: string[] | null
          is_anticipated: boolean | null
          media_statistics: Json | null
          negative_patterns: string[] | null
          pdf_url: string | null
          positive_patterns: string[] | null
          qualified_leads: number | null
          report_content: Json | null
          report_date: string
          strengths: string[] | null
          total_conversations: number | null
          total_leads: number | null
          weaknesses: string[] | null
          week_end: string
          week_start: string
        }
        Insert: {
          agents_analysis?: Json | null
          anticipated_at?: string | null
          anticipated_by?: string | null
          average_score?: number | null
          avg_response_time_minutes?: number | null
          classification?: string | null
          closed_deals?: number | null
          company_id: string
          contacts_by_state?: Json | null
          conversion_rate?: number | null
          created_at?: string | null
          criteria_scores?: Json | null
          critical_issues?: string[] | null
          deals_by_state?: Json | null
          final_recommendation?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: string[] | null
          is_anticipated?: boolean | null
          media_statistics?: Json | null
          negative_patterns?: string[] | null
          pdf_url?: string | null
          positive_patterns?: string[] | null
          qualified_leads?: number | null
          report_content?: Json | null
          report_date: string
          strengths?: string[] | null
          total_conversations?: number | null
          total_leads?: number | null
          weaknesses?: string[] | null
          week_end: string
          week_start: string
        }
        Update: {
          agents_analysis?: Json | null
          anticipated_at?: string | null
          anticipated_by?: string | null
          average_score?: number | null
          avg_response_time_minutes?: number | null
          classification?: string | null
          closed_deals?: number | null
          company_id?: string
          contacts_by_state?: Json | null
          conversion_rate?: number | null
          created_at?: string | null
          criteria_scores?: Json | null
          critical_issues?: string[] | null
          deals_by_state?: Json | null
          final_recommendation?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: string[] | null
          is_anticipated?: boolean | null
          media_statistics?: Json | null
          negative_patterns?: string[] | null
          pdf_url?: string | null
          positive_patterns?: string[] | null
          qualified_leads?: number | null
          report_content?: Json | null
          report_date?: string
          strengths?: string[] | null
          total_conversations?: number | null
          total_leads?: number | null
          weaknesses?: string[] | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          ai_optimization_settings: Json | null
          commercial_manager_enabled: boolean | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_ai_agents: number | null
          max_connections: number | null
          max_users: number | null
          name: string
          plan: Database["public"]["Enums"]["company_plan"] | null
          settings: Json | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_cache: Json | null
          subscription_cache_updated_at: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_optimization_settings?: Json | null
          commercial_manager_enabled?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_ai_agents?: number | null
          max_connections?: number | null
          max_users?: number | null
          name: string
          plan?: Database["public"]["Enums"]["company_plan"] | null
          settings?: Json | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cache?: Json | null
          subscription_cache_updated_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_optimization_settings?: Json | null
          commercial_manager_enabled?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_ai_agents?: number | null
          max_connections?: number | null
          max_users?: number | null
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"] | null
          settings?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cache?: Json | null
          subscription_cache_updated_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_live_dashboard: {
        Row: {
          active_conversations: number | null
          aggregated_insights: Json | null
          cold_leads: number | null
          company_id: string
          current_avg_response_time: number | null
          current_avg_sentiment: string | null
          hot_leads: number | null
          id: string
          insights_message_count: number | null
          last_insights_update: string | null
          last_reset_date: string | null
          today_contracts_closed: number | null
          today_leads_lost: number | null
          today_messages: number | null
          today_new_conversations: number | null
          top_objections: Json | null
          top_pain_points: Json | null
          updated_at: string | null
          warm_leads: number | null
        }
        Insert: {
          active_conversations?: number | null
          aggregated_insights?: Json | null
          cold_leads?: number | null
          company_id: string
          current_avg_response_time?: number | null
          current_avg_sentiment?: string | null
          hot_leads?: number | null
          id?: string
          insights_message_count?: number | null
          last_insights_update?: string | null
          last_reset_date?: string | null
          today_contracts_closed?: number | null
          today_leads_lost?: number | null
          today_messages?: number | null
          today_new_conversations?: number | null
          top_objections?: Json | null
          top_pain_points?: Json | null
          updated_at?: string | null
          warm_leads?: number | null
        }
        Update: {
          active_conversations?: number | null
          aggregated_insights?: Json | null
          cold_leads?: number | null
          company_id?: string
          current_avg_response_time?: number | null
          current_avg_sentiment?: string | null
          hot_leads?: number | null
          id?: string
          insights_message_count?: number | null
          last_insights_update?: string | null
          last_reset_date?: string | null
          today_contracts_closed?: number | null
          today_leads_lost?: number | null
          today_messages?: number | null
          today_new_conversations?: number | null
          top_objections?: Json | null
          top_pain_points?: Json | null
          updated_at?: string | null
          warm_leads?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_live_dashboard_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_users: {
        Row: {
          access_level: string
          connection_id: string
          created_at: string | null
          crm_access: boolean
          department_access_mode: string
          id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          connection_id: string
          created_at?: string | null
          crm_access?: boolean
          department_access_mode?: string
          id?: string
          user_id: string
        }
        Update: {
          access_level?: string
          connection_id?: string
          created_at?: string | null
          crm_access?: boolean
          department_access_mode?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_users_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_logs: {
        Row: {
          company_id: string
          contact_id: string | null
          contact_snapshot: Json
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          is_automatic: boolean | null
          performed_by: string | null
          performed_by_name: string | null
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          contact_snapshot?: Json
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          is_automatic?: boolean | null
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          contact_snapshot?: Json
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          is_automatic?: boolean | null
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          id: string
          last_interaction_at: string | null
          name: string | null
          name_manually_edited: boolean | null
          notes: string | null
          phone_number: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          name_manually_edited?: boolean | null
          notes?: string | null
          phone_number: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          name_manually_edited?: boolean | null
          notes?: string | null
          phone_number?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_evaluations: {
        Row: {
          agent_id: string | null
          ai_summary: string | null
          closing_score: number | null
          communication_score: number | null
          company_id: string
          conversation_id: string
          created_at: string | null
          evaluated_at: string | null
          humanization_score: number | null
          id: string
          improvements: string[] | null
          lead_interest_level: number | null
          lead_pain_points: string[] | null
          lead_qualification: string | null
          objection_handling_score: number | null
          objectivity_score: number | null
          overall_score: number | null
          response_time_score: number | null
          strengths: string[] | null
        }
        Insert: {
          agent_id?: string | null
          ai_summary?: string | null
          closing_score?: number | null
          communication_score?: number | null
          company_id: string
          conversation_id: string
          created_at?: string | null
          evaluated_at?: string | null
          humanization_score?: number | null
          id?: string
          improvements?: string[] | null
          lead_interest_level?: number | null
          lead_pain_points?: string[] | null
          lead_qualification?: string | null
          objection_handling_score?: number | null
          objectivity_score?: number | null
          overall_score?: number | null
          response_time_score?: number | null
          strengths?: string[] | null
        }
        Update: {
          agent_id?: string | null
          ai_summary?: string | null
          closing_score?: number | null
          communication_score?: number | null
          company_id?: string
          conversation_id?: string
          created_at?: string | null
          evaluated_at?: string | null
          humanization_score?: number | null
          id?: string
          improvements?: string[] | null
          lead_interest_level?: number | null
          lead_pain_points?: string[] | null
          lead_qualification?: string | null
          objection_handling_score?: number | null
          objectivity_score?: number | null
          overall_score?: number | null
          response_time_score?: number | null
          strengths?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_evaluations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          ai_insights: Json | null
          company_id: string
          conversation_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          ai_insights?: Json | null
          company_id: string
          conversation_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          ai_insights?: Json | null
          company_id?: string
          conversation_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_followers: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_followers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_history: {
        Row: {
          conversation_id: string
          created_at: string | null
          event_data: Json
          event_type: string
          id: string
          is_automatic: boolean | null
          performed_by: string | null
          performed_by_name: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          event_data?: Json
          event_type: string
          id?: string
          is_automatic?: boolean | null
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          is_automatic?: boolean | null
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_live_metrics: {
        Row: {
          agent_messages: number | null
          avg_response_time_seconds: number | null
          client_messages: number | null
          close_probability: number | null
          company_id: string
          conversation_id: string
          current_sentiment: string | null
          deal_signals: string[] | null
          engagement_score: number | null
          id: string
          interest_level: number | null
          last_activity_at: string | null
          lead_status: string | null
          lead_status_confidence: number | null
          objections_detected: string[] | null
          pain_points: string[] | null
          predicted_outcome: string | null
          total_messages: number | null
          updated_at: string | null
        }
        Insert: {
          agent_messages?: number | null
          avg_response_time_seconds?: number | null
          client_messages?: number | null
          close_probability?: number | null
          company_id: string
          conversation_id: string
          current_sentiment?: string | null
          deal_signals?: string[] | null
          engagement_score?: number | null
          id?: string
          interest_level?: number | null
          last_activity_at?: string | null
          lead_status?: string | null
          lead_status_confidence?: number | null
          objections_detected?: string[] | null
          pain_points?: string[] | null
          predicted_outcome?: string | null
          total_messages?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_messages?: number | null
          avg_response_time_seconds?: number | null
          client_messages?: number | null
          close_probability?: number | null
          company_id?: string
          conversation_id?: string
          current_sentiment?: string | null
          deal_signals?: string[] | null
          engagement_score?: number | null
          id?: string
          interest_level?: number | null
          last_activity_at?: string | null
          lead_status?: string | null
          lead_status_confidence?: number | null
          objections_detected?: string[] | null
          pain_points?: string[] | null
          predicted_outcome?: string | null
          total_messages?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_live_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_live_metrics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string | null
          channel: string | null
          closed_at: string | null
          company_id: string
          contact_id: string
          created_at: string | null
          department_id: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          metadata: Json | null
          priority: Database["public"]["Enums"]["conversation_priority"] | null
          status: Database["public"]["Enums"]["conversation_status"] | null
          tags: string[] | null
          unread_count: number | null
          updated_at: string | null
          whatsapp_connection_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          channel?: string | null
          closed_at?: string | null
          company_id: string
          contact_id: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["conversation_priority"] | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_connection_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          channel?: string | null
          closed_at?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["conversation_priority"] | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_user_access: {
        Row: {
          company_id: string
          created_at: string | null
          enabled: boolean
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_user_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_users: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          whatsapp_connection_id: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          whatsapp_connection_id: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          whatsapp_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["developer_audit_action"]
          created_at: string | null
          details: Json | null
          developer_id: string
          id: string
          ip_address: string | null
          target_company_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["developer_audit_action"]
          created_at?: string | null
          details?: Json | null
          developer_id: string
          id?: string
          ip_address?: string | null
          target_company_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["developer_audit_action"]
          created_at?: string | null
          details?: Json | null
          developer_id?: string
          id?: string
          ip_address?: string | null
          target_company_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_audit_logs_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_auth"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_audit_logs_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_auth: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_login: string | null
          password_hash: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          last_login?: string | null
          password_hash: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_login?: string | null
          password_hash?: string
        }
        Relationships: []
      }
      developer_permission_requests: {
        Row: {
          approver_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          request_type: Database["public"]["Enums"]["developer_permission_request_type"]
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["developer_permission_status"]
          target_company_id: string | null
          target_user_id: string | null
        }
        Insert: {
          approver_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          request_type: Database["public"]["Enums"]["developer_permission_request_type"]
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["developer_permission_status"]
          target_company_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          approver_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          request_type?: Database["public"]["Enums"]["developer_permission_request_type"]
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["developer_permission_status"]
          target_company_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_permission_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_permission_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "developer_auth"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_permission_requests_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_permission_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_jobs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          current_step: string | null
          error_message: string | null
          expires_at: string | null
          filters: Json
          id: string
          job_type: string
          progress: number | null
          requested_by: string | null
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          expires_at?: string | null
          filters?: Json
          id?: string
          job_type?: string
          progress?: number | null
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          expires_at?: string | null
          filters?: Json
          id?: string
          job_type?: string
          progress?: number | null
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          mentions: Json | null
          message_type: string
          room_id: string
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          mentions?: Json | null
          message_type?: string
          room_id: string
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          mentions?: Json | null
          message_type?: string
          room_id?: string
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_participants: {
        Row: {
          created_at: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_read_states: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_read_states_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_read_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_rooms: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_boards: {
        Row: {
          auto_add_new_contacts: boolean
          company_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          whatsapp_connection_id: string
        }
        Insert: {
          auto_add_new_contacts?: boolean
          company_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          whatsapp_connection_id: string
        }
        Update: {
          auto_add_new_contacts?: boolean
          company_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          whatsapp_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_boards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_boards_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_attachments: {
        Row: {
          card_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          card_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_checklist_items: {
        Row: {
          card_id: string
          completed: boolean
          created_at: string | null
          id: string
          position: number
          text: string
          updated_at: string | null
        }
        Insert: {
          card_id: string
          completed?: boolean
          created_at?: string | null
          id?: string
          position?: number
          text: string
          updated_at?: string | null
        }
        Update: {
          card_id?: string
          completed?: boolean
          created_at?: string | null
          id?: string
          position?: number
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_checklist_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_history: {
        Row: {
          action_type: string
          card_id: string
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          card_id: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          card_id?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_tags: {
        Row: {
          card_id: string
          color: string
          id: string
          name: string
        }
        Insert: {
          card_id: string
          color?: string
          id?: string
          name: string
        }
        Update: {
          card_id?: string
          color?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_tags_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          assigned_user_id: string | null
          column_id: string
          contact_id: string
          created_at: string | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["kanban_priority"]
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          column_id: string
          contact_id: string
          created_at?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["kanban_priority"]
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          column_id?: string
          contact_id?: string
          created_at?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["kanban_priority"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          board_id: string
          color: string
          created_at: string | null
          id: string
          name: string
          position: number
          updated_at: string | null
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string | null
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      media_analysis_cache: {
        Row: {
          analysis_result: Json | null
          company_id: string
          created_at: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          media_type: string
          url: string
          url_hash: string
        }
        Insert: {
          analysis_result?: Json | null
          company_id: string
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          media_type: string
          url: string
          url_hash: string
        }
        Update: {
          analysis_result?: Json | null
          company_id?: string
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          media_type?: string
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_analysis_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mention_notifications: {
        Row: {
          conversation_id: string | null
          created_at: string
          has_access: boolean
          id: string
          is_read: boolean
          mentioned_user_id: string
          mentioner_user_id: string
          message_id: string
          room_id: string | null
          source_type: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          has_access?: boolean
          id?: string
          is_read?: boolean
          mentioned_user_id: string
          mentioner_user_id: string
          message_id: string
          room_id?: string | null
          source_type: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          has_access?: boolean
          id?: string
          is_read?: boolean
          mentioned_user_id?: string
          mentioner_user_id?: string
          message_id?: string
          room_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mention_notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_notifications_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_notifications_mentioner_user_id_fkey"
            columns: ["mentioner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          company_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          reactor_id: string
          reactor_type: string
          updated_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          reactor_id: string
          reactor_type: string
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          reactor_id?: string
          reactor_type?: string
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          deleted_by_type: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          edit_count: number | null
          edited_at: string | null
          error_message: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_internal_note: boolean | null
          media_mime_type: string | null
          media_url: string | null
          mentions: Json | null
          message_type: Database["public"]["Enums"]["message_type"]
          metadata: Json | null
          original_content: string | null
          quoted_message_id: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: Database["public"]["Enums"]["message_status"] | null
          thumbnail_url: string | null
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          deleted_by_type?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          edit_count?: number | null
          edited_at?: string | null
          error_message?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_internal_note?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          mentions?: Json | null
          message_type: Database["public"]["Enums"]["message_type"]
          metadata?: Json | null
          original_content?: string | null
          quoted_message_id?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          deleted_by_type?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          edit_count?: number | null
          edited_at?: string | null
          error_message?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_internal_note?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          mentions?: Json | null
          message_type?: Database["public"]["Enums"]["message_type"]
          metadata?: Json | null
          original_content?: string | null
          quoted_message_id?: string | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          company_id: string
          created_at: string | null
          department_id: string | null
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          max_conversations: number | null
          metadata: Json | null
          needs_password_change: boolean
          signature: string | null
          signature_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          company_id: string
          created_at?: string | null
          department_id?: string | null
          email: string
          full_name: string
          id: string
          last_seen_at?: string | null
          max_conversations?: number | null
          metadata?: Json | null
          needs_password_change?: boolean
          signature?: string | null
          signature_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          company_id?: string
          created_at?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          max_conversations?: number | null
          metadata?: Json | null
          needs_password_change?: boolean
          signature?: string | null
          signature_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          category: string | null
          category_id: string | null
          company_id: string
          created_at: string | null
          created_by_user_id: string | null
          department_id: string | null
          id: string
          is_global: boolean | null
          media_type: string | null
          media_url: string | null
          message: string
          shortcut: string
          title: string
          updated_at: string | null
          use_count: number | null
          visibility_type: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id: string | null
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string | null
          created_by_user_id?: string | null
          department_id?: string | null
          id?: string
          is_global?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message: string
          shortcut: string
          title: string
          updated_at?: string | null
          use_count?: number | null
          visibility_type?: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by_user_id?: string | null
          department_id?: string | null
          id?: string
          is_global?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          shortcut?: string
          title?: string
          updated_at?: string | null
          use_count?: number | null
          visibility_type?: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "quick_reply_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_reply_categories: {
        Row: {
          company_id: string
          created_at: string | null
          created_by_user_id: string | null
          department_id: string | null
          id: string
          name: string
          updated_at: string | null
          visibility_type: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by_user_id?: string | null
          department_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
          visibility_type?: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by_user_id?: string | null
          department_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          visibility_type?: Database["public"]["Enums"]["quick_reply_visibility"]
          whatsapp_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_reply_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_categories_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_categories_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          contact_id: string
          content: string | null
          conversation_id: string | null
          created_at: string | null
          created_by: string
          error_message: string | null
          id: string
          media_file_name: string | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          scheduled_at: string
          sent_at: string | null
          sent_message_id: string | null
          status: string
          timezone: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          contact_id: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by: string
          error_message?: string | null
          id?: string
          media_file_name?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_at: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          timezone?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          contact_id?: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string
          error_message?: string | null
          id?: string
          media_file_name?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_at?: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          department_id: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          active_users: number | null
          ai_estimated_cost: number | null
          ai_input_tokens: number | null
          ai_output_tokens: number | null
          ai_requests: number | null
          company_id: string | null
          created_at: string | null
          db_rows_conversations: number | null
          db_rows_messages: number | null
          db_size_bytes: number | null
          id: string
          messages_received: number | null
          messages_sent: number | null
          metric_date: string
          storage_bytes: number | null
          storage_files_count: number | null
        }
        Insert: {
          active_users?: number | null
          ai_estimated_cost?: number | null
          ai_input_tokens?: number | null
          ai_output_tokens?: number | null
          ai_requests?: number | null
          company_id?: string | null
          created_at?: string | null
          db_rows_conversations?: number | null
          db_rows_messages?: number | null
          db_size_bytes?: number | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          metric_date: string
          storage_bytes?: number | null
          storage_files_count?: number | null
        }
        Update: {
          active_users?: number | null
          ai_estimated_cost?: number | null
          ai_input_tokens?: number | null
          ai_output_tokens?: number | null
          ai_requests?: number | null
          company_id?: string | null
          created_at?: string | null
          db_rows_conversations?: number | null
          db_rows_messages?: number | null
          db_size_bytes?: number | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          metric_date?: string
          storage_bytes?: number | null
          storage_files_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      whatsapp_connections: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          instance_token: string | null
          last_connected_at: string | null
          name: string
          phone_number: string
          qr_code: string | null
          receive_group_messages: boolean | null
          session_id: string
          settings: Json | null
          status: Database["public"]["Enums"]["connection_status"] | null
          uazapi_base_url: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_token?: string | null
          last_connected_at?: string | null
          name: string
          phone_number: string
          qr_code?: string | null
          receive_group_messages?: boolean | null
          session_id: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          uazapi_base_url?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_token?: string | null
          last_connected_at?: string | null
          name?: string
          phone_number?: string
          qr_code?: string | null
          receive_group_messages?: boolean | null
          session_id?: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          uazapi_base_url?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_access_column: {
        Args: { p_column_id: string }
        Returns: boolean
      }
      cleanup_expired_insights_jobs: { Args: never; Returns: number }
      cleanup_expired_media_cache: { Args: never; Returns: number }
      cleanup_old_conversation_events: { Args: never; Returns: number }
      create_internal_chat_room: {
        Args: { p_description?: string; p_name?: string; p_type: string }
        Returns: string
      }
      get_board_company_id: { Args: { board_id: string }; Returns: string }
      get_card_company_id: { Args: { card_id: string }; Returns: string }
      get_column_company_id: { Args: { p_column_id: string }; Returns: string }
      get_connection_company_id: {
        Args: { connection_id: string }
        Returns: string
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_crm_access: { Args: never; Returns: boolean }
      has_crm_access_for_connection: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_cache_hit: {
        Args: { p_company_id: string; p_url_hash: string }
        Returns: undefined
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      optimize_tables: { Args: never; Returns: undefined }
      reset_daily_dashboard_counters: { Args: never; Returns: undefined }
      room_belongs_to_user_company: {
        Args: { room_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "supervisor" | "agent" | "viewer"
      company_plan:
        | "free"
        | "starter"
        | "professional"
        | "enterprise"
        | "monthly"
        | "semiannual"
        | "annual"
        | "lifetime"
        | "trial"
      connection_status:
        | "connected"
        | "disconnected"
        | "qr_ready"
        | "connecting"
        | "error"
      conversation_priority: "low" | "normal" | "high" | "urgent"
      conversation_status:
        | "open"
        | "pending"
        | "in_progress"
        | "waiting"
        | "resolved"
        | "closed"
      developer_audit_action:
        | "login"
        | "view_company"
        | "view_user"
        | "edit_company"
        | "edit_user"
        | "access_user"
        | "reset_password"
        | "create_company"
        | "create_user"
        | "delete_company"
        | "delete_user"
      developer_permission_request_type:
        | "edit_company"
        | "edit_user"
        | "access_user"
        | "delete_company"
        | "delete_user"
      developer_permission_status:
        | "pending"
        | "approved"
        | "denied"
        | "cancelled"
        | "expired"
        | "used"
      kanban_priority: "low" | "medium" | "high" | "urgent"
      message_direction: "inbound" | "outbound"
      message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "document"
        | "location"
        | "contact"
        | "sticker"
      quick_reply_visibility: "all" | "personal" | "department" | "connection"
      sender_type: "user" | "contact" | "system" | "bot"
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
      app_role: ["owner", "admin", "supervisor", "agent", "viewer"],
      company_plan: [
        "free",
        "starter",
        "professional",
        "enterprise",
        "monthly",
        "semiannual",
        "annual",
        "lifetime",
        "trial",
      ],
      connection_status: [
        "connected",
        "disconnected",
        "qr_ready",
        "connecting",
        "error",
      ],
      conversation_priority: ["low", "normal", "high", "urgent"],
      conversation_status: [
        "open",
        "pending",
        "in_progress",
        "waiting",
        "resolved",
        "closed",
      ],
      developer_audit_action: [
        "login",
        "view_company",
        "view_user",
        "edit_company",
        "edit_user",
        "access_user",
        "reset_password",
        "create_company",
        "create_user",
        "delete_company",
        "delete_user",
      ],
      developer_permission_request_type: [
        "edit_company",
        "edit_user",
        "access_user",
        "delete_company",
        "delete_user",
      ],
      developer_permission_status: [
        "pending",
        "approved",
        "denied",
        "cancelled",
        "expired",
        "used",
      ],
      kanban_priority: ["low", "medium", "high", "urgent"],
      message_direction: ["inbound", "outbound"],
      message_status: ["pending", "sent", "delivered", "read", "failed"],
      message_type: [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "location",
        "contact",
        "sticker",
      ],
      quick_reply_visibility: ["all", "personal", "department", "connection"],
      sender_type: ["user", "contact", "system", "bot"],
    },
  },
} as const
