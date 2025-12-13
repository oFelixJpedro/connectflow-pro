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
      companies: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["company_plan"] | null
          settings: Json | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["company_plan"] | null
          settings?: Json | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"] | null
          settings?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      internal_chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
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
          id: string
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
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
      tags: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
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
      create_internal_chat_room: {
        Args: { p_name?: string; p_type: string }
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
      is_admin_or_owner: { Args: never; Returns: boolean }
      room_belongs_to_user_company: {
        Args: { room_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "supervisor" | "agent" | "viewer"
      company_plan: "free" | "starter" | "professional" | "enterprise"
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
      company_plan: ["free", "starter", "professional", "enterprise"],
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
