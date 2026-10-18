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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      appointment_items: {
        Row: {
          appointment_id: string
          bundle_id: string | null
          business_id: string
          created_at: string
          end_time: string
          id: string
          is_blocking: boolean
          price: number | null
          service_id: string | null
          sort_order: number
          start_time: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          bundle_id?: string | null
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          is_blocking?: boolean
          price?: number | null
          service_id?: string | null
          sort_order?: number
          start_time: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          bundle_id?: string | null
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_blocking?: boolean
          price?: number | null
          service_id?: string | null
          sort_order?: number
          start_time?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_walk_in: boolean
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_services: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          service_id: string
          sort_order: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          service_id: string
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_services_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          business_id: string
          category_id: string | null
          created_at: string
          custom_price: number | null
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean
          name: string
          online_booking_enabled: boolean
          portfolio_image_path: string | null
          portfolio_image_url: string | null
          pricing_mode: Database["public"]["Enums"]["bundle_pricing_mode"]
          schedule_type: Database["public"]["Enums"]["bundle_schedule_type"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          category_id?: string | null
          created_at?: string
          custom_price?: number | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name: string
          online_booking_enabled?: boolean
          portfolio_image_path?: string | null
          portfolio_image_url?: string | null
          pricing_mode?: Database["public"]["Enums"]["bundle_pricing_mode"]
          schedule_type?: Database["public"]["Enums"]["bundle_schedule_type"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_id?: string | null
          created_at?: string
          custom_price?: number | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name?: string
          online_booking_enabled?: boolean
          portfolio_image_path?: string | null
          portfolio_image_url?: string | null
          pricing_mode?: Database["public"]["Enums"]["bundle_pricing_mode"]
          schedule_type?: Database["public"]["Enums"]["bundle_schedule_type"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          booking_description: string | null
          booking_slug: string | null
          online_booking_enabled: boolean
          categories: Json
          country: string
          created_at: string
          currency: string
          heard_about_source: string | null
          id: string
          latitude: number | null
          location: Json | null
          longitude: number | null
          migration_source: string | null
          name: string
          other_category: string | null
          owner_id: string | null
          service_locations: Json
          setup_step: number
          team_size: string | null
          timezone: string | null
          website: string | null
        }
        Insert: {
          booking_description?: string | null
          booking_slug?: string | null
          online_booking_enabled?: boolean
          categories?: Json
          country?: string
          created_at?: string
          currency?: string
          heard_about_source?: string | null
          id?: string
          latitude?: number | null
          location?: Json | null
          longitude?: number | null
          migration_source?: string | null
          name: string
          other_category?: string | null
          owner_id?: string | null
          service_locations?: Json
          setup_step?: number
          team_size?: string | null
          timezone?: string | null
          website?: string | null
        }
        Update: {
          booking_description?: string | null
          booking_slug?: string | null
          online_booking_enabled?: boolean
          categories?: Json
          country?: string
          created_at?: string
          currency?: string
          heard_about_source?: string | null
          id?: string
          latitude?: number | null
          location?: Json | null
          longitude?: number | null
          migration_source?: string | null
          name?: string
          other_category?: string | null
          owner_id?: string | null
          service_locations?: Json
          setup_step?: number
          team_size?: string | null
          timezone?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_addresses: {
        Row: {
          address_name: string
          address_type: Database["public"]["Enums"]["client_address_type"]
          apartment_suite: string | null
          business_id: string
          city: string | null
          client_id: string
          country: string
          created_at: string
          district: string | null
          id: string
          postcode: string | null
          region: string | null
          street_address: string
          updated_at: string
        }
        Insert: {
          address_name?: string
          address_type?: Database["public"]["Enums"]["client_address_type"]
          apartment_suite?: string | null
          business_id: string
          city?: string | null
          client_id: string
          country: string
          created_at?: string
          district?: string | null
          id?: string
          postcode?: string | null
          region?: string | null
          street_address: string
          updated_at?: string
        }
        Update: {
          address_name?: string
          address_type?: Database["public"]["Enums"]["client_address_type"]
          apartment_suite?: string | null
          business_id?: string
          city?: string | null
          client_id?: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          postcode?: string | null
          region?: string | null
          street_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tag_assignments: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tag_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "client_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          additional_email: string | null
          additional_phone: string | null
          additional_phone_country_code: string | null
          avatar_color: string
          avatar_path: string | null
          avatar_url: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          business_id: string
          client_source: string
          country: string | null
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          notes: string | null
          occupation: string | null
          phone: string | null
          phone_country_code: string | null
          preferred_language: string | null
          pronouns: string | null
          referred_by_client_id: string | null
          updated_at: string
        }
        Insert: {
          additional_email?: string | null
          additional_phone?: string | null
          additional_phone_country_code?: string | null
          avatar_color?: string
          avatar_path?: string | null
          avatar_url?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          business_id: string
          client_source?: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          phone_country_code?: string | null
          preferred_language?: string | null
          pronouns?: string | null
          referred_by_client_id?: string | null
          updated_at?: string
        }
        Update: {
          additional_email?: string | null
          additional_phone?: string | null
          additional_phone_country_code?: string | null
          avatar_color?: string
          avatar_path?: string | null
          avatar_url?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          business_id?: string
          client_source?: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          phone_country_code?: string | null
          preferred_language?: string | null
          pronouns?: string | null
          referred_by_client_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_client_id_fkey"
            columns: ["referred_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_example: boolean
          job_title: string | null
          last_name: string | null
          phone: string | null
          profile_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_example?: boolean
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          profile_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_example?: boolean
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarded_at: string | null
          phone: string | null
          timezone: string | null
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded_at?: string | null
          phone?: string | null
          timezone?: string | null
          user_type?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
          phone?: string | null
          timezone?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          appointment_item_id: string | null
          business_id: string
          created_at: string
          description: string
          id: string
          price: number
          quantity: number
          sale_id: string
          service_id: string | null
          sort_order: number
        }
        Insert: {
          appointment_item_id?: string | null
          business_id: string
          created_at?: string
          description: string
          id?: string
          price?: number
          quantity?: number
          sale_id: string
          service_id?: string | null
          sort_order?: number
        }
        Update: {
          appointment_item_id?: string | null
          business_id?: string
          created_at?: string
          description?: string
          id?: string
          price?: number
          quantity?: number
          sale_id?: string
          service_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_appointment_item_id_fkey"
            columns: ["appointment_item_id"]
            isOneToOne: false
            referencedRelation: "appointment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          appointment_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_walk_in: boolean
          notes: string | null
          payment_method: string
          sale_date: string
          status: string
          team_member_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          payment_method?: string
          sale_date?: string
          status?: string
          team_member_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          payment_method?: string
          sale_date?: string
          status?: string
          team_member_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          business_id: string
          color: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_portfolio_images: {
        Row: {
          business_id: string
          created_at: string
          draft_id: string | null
          id: string
          image_url: string
          is_primary: boolean
          service_id: string | null
          storage_path: string
        }
        Insert: {
          business_id: string
          created_at?: string
          draft_id?: string | null
          id?: string
          image_url: string
          is_primary?: boolean
          service_id?: string | null
          storage_path: string
        }
        Update: {
          business_id?: string
          created_at?: string
          draft_id?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean
          service_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_portfolio_images_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_portfolio_images_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_team_members: {
        Row: {
          created_at: string
          service_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          service_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          service_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_team_members_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_members_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          online_booking_enabled: boolean
          business_id: string
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          duration_segments: Json
          id: string
          is_archived: boolean
          name: string
          price: number | null
          pricing_type: string
          sort_order: number
          treatment_type: string | null
        }
        Insert: {
          online_booking_enabled?: boolean
          business_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          duration_segments?: Json
          id?: string
          is_archived?: boolean
          name: string
          price?: number | null
          pricing_type?: string
          sort_order?: number
          treatment_type?: string | null
        }
        Update: {
          online_booking_enabled?: boolean
          business_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          duration_segments?: Json
          id?: string
          is_archived?: boolean
          name?: string
          price?: number | null
          pricing_type?: string
          sort_order?: number
          treatment_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          additional_phone: string | null
          additional_phone_country_code: string | null
          avatar_color: string
          avatar_path: string | null
          avatar_url: string | null
          birthday: string | null
          business_id: string
          calendar_color: string
          country: string | null
          created_at: string
          email: string | null
          employment_type: string | null
          end_date: string | null
          external_team_member_id: string | null
          first_name: string
          gender: string | null
          id: string
          initials: string | null
          invite_status: Database["public"]["Enums"]["team_invite_status"]
          invite_token: string | null
          is_active: boolean
          job_title: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          phone_country_code: string | null
          pronouns: string | null
          role_id: string | null
          start_date: string | null
          user_id: string | null
        }
        Insert: {
          additional_phone?: string | null
          additional_phone_country_code?: string | null
          avatar_color?: string
          avatar_path?: string | null
          avatar_url?: string | null
          birthday?: string | null
          business_id: string
          calendar_color?: string
          country?: string | null
          created_at?: string
          email?: string | null
          employment_type?: string | null
          end_date?: string | null
          external_team_member_id?: string | null
          first_name: string
          gender?: string | null
          id?: string
          initials?: string | null
          invite_status?: Database["public"]["Enums"]["team_invite_status"]
          invite_token?: string | null
          is_active?: boolean
          job_title?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_country_code?: string | null
          pronouns?: string | null
          role_id?: string | null
          start_date?: string | null
          user_id?: string | null
        }
        Update: {
          additional_phone?: string | null
          additional_phone_country_code?: string | null
          avatar_color?: string
          avatar_path?: string | null
          avatar_url?: string | null
          birthday?: string | null
          business_id?: string
          calendar_color?: string
          country?: string | null
          created_at?: string
          email?: string | null
          employment_type?: string | null
          end_date?: string | null
          external_team_member_id?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          initials?: string | null
          invite_status?: Database["public"]["Enums"]["team_invite_status"]
          invite_token?: string | null
          is_active?: boolean
          job_title?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_country_code?: string | null
          pronouns?: string | null
          role_id?: string | null
          start_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          permissions: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          permissions?: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_booking: {
        Args: { p_slug: string; p_items: Json; p_start: string; p_client: Json; p_notes?: string | null }
        Returns: Json
      }
      get_booking_busy: {
        Args: { p_slug: string; p_from: string; p_to: string }
        Returns: { team_member_id: string; start_time: string; end_time: string }[]
      }
      get_booking_page: {
        Args: { p_slug: string }
        Returns: Json
      }
    }
    Enums: {
      bundle_pricing_mode:
        | "service_pricing"
        | "custom"
        | "percentage_discount"
        | "free"
      bundle_schedule_type: "sequence" | "parallel"
      client_address_type: "home" | "work" | "other"
      team_invite_status: "not_invited" | "invited" | "active"
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
  public: {
    Enums: {
      bundle_pricing_mode: [
        "service_pricing",
        "custom",
        "percentage_discount",
        "free",
      ],
      bundle_schedule_type: ["sequence", "parallel"],
      client_address_type: ["home", "work", "other"],
      team_invite_status: ["not_invited", "invited", "active"],
    },
  },
} as const
