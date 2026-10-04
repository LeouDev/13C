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
  public: {
    Tables: {
      app_errors: {
        Row: {
          created_at: string
          digest: string | null
          id: number
          message: string
          method: string | null
          notified_at: string | null
          path: string | null
          route: string | null
        }
        Insert: {
          created_at?: string
          digest?: string | null
          id?: never
          message: string
          method?: string | null
          notified_at?: string | null
          path?: string | null
          route?: string | null
        }
        Update: {
          created_at?: string
          digest?: string | null
          id?: never
          message?: string
          method?: string | null
          notified_at?: string | null
          path?: string | null
          route?: string | null
        }
        Relationships: []
      }
      assistant_usage: {
        Row: {
          count: number
          day: string
          key: string
        }
        Insert: {
          count?: number
          day?: string
          key: string
        }
        Update: {
          count?: number
          day?: string
          key?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_transitions: {
        Row: {
          actor: string
          from_status: Database["public"]["Enums"]["booking_status"]
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor: string
          from_status: Database["public"]["Enums"]["booking_status"]
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor?: string
          from_status?: Database["public"]["Enums"]["booking_status"]
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: []
      }
      bookings: {
        Row: {
          approved_at: string | null
          base_amount: number
          business_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          daily_rate: number
          delivery: boolean
          delivery_fee: number
          discount: number
          driver_fee: number
          drivers_count: number
          excess_km_fee: number | null
          id: string
          mileage_limit_km: number | null
          notes: string | null
          other_fees: number
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          period: unknown
          picked_up_at: string | null
          pickup_at: string
          pickup_location: string
          reference: string
          rental_days: number
          renter_id: string
          return_at: string
          return_location: string
          returned_at: string | null
          security_deposit: number
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          vehicle_id: string
          with_driver: boolean
        }
        Insert: {
          approved_at?: string | null
          base_amount: number
          business_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          daily_rate: number
          delivery?: boolean
          delivery_fee?: number
          discount?: number
          driver_fee?: number
          drivers_count?: number
          excess_km_fee?: number | null
          id?: string
          mileage_limit_km?: number | null
          notes?: string | null
          other_fees?: number
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          period?: unknown
          picked_up_at?: string | null
          pickup_at: string
          pickup_location: string
          reference?: string
          rental_days: number
          renter_id: string
          return_at: string
          return_location: string
          returned_at?: string | null
          security_deposit?: number
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at?: string
          vehicle_id: string
          with_driver?: boolean
        }
        Update: {
          approved_at?: string | null
          base_amount?: number
          business_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          daily_rate?: number
          delivery?: boolean
          delivery_fee?: number
          discount?: number
          driver_fee?: number
          drivers_count?: number
          excess_km_fee?: number | null
          id?: string
          mileage_limit_km?: number | null
          notes?: string | null
          other_fees?: number
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          period?: unknown
          picked_up_at?: string | null
          pickup_at?: string
          pickup_location?: string
          reference?: string
          rental_days?: number
          renter_id?: string
          return_at?: string
          return_location?: string
          returned_at?: string | null
          security_deposit?: number
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          vehicle_id?: string
          with_driver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_storefronts: {
        Row: {
          about: string | null
          accent_color: string
          business_hours: Json
          business_id: string
          cover_path: string | null
          created_at: string
          custom_domain: string | null
          delivery_areas: string[]
          faqs: Json
          featured_vehicle_ids: string[]
          hidden_sections: string[]
          is_published: boolean
          pickup_locations: string[]
          policies: Json
          published_at: string | null
          social_links: Json
          subdomain: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          accent_color?: string
          business_hours?: Json
          business_id: string
          cover_path?: string | null
          created_at?: string
          custom_domain?: string | null
          delivery_areas?: string[]
          faqs?: Json
          featured_vehicle_ids?: string[]
          hidden_sections?: string[]
          is_published?: boolean
          pickup_locations?: string[]
          policies?: Json
          published_at?: string | null
          social_links?: Json
          subdomain?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          accent_color?: string
          business_hours?: Json
          business_id?: string
          cover_path?: string | null
          created_at?: string
          custom_domain?: string | null
          delivery_areas?: string[]
          faqs?: Json
          featured_vehicle_ids?: string[]
          hidden_sections?: string[]
          is_published?: boolean
          pickup_locations?: string[]
          policies?: Json
          published_at?: string | null
          social_links?: Json
          subdomain?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_storefronts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_verifications: {
        Row: {
          business_id: string
          created_at: string
          decision: Database["public"]["Enums"]["business_status"] | null
          documents: Json
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_by: string
          submitter_note: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          decision?: Database["public"]["Enums"]["business_status"] | null
          documents?: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by: string
          submitter_note?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["business_status"] | null
          documents?: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string
          submitter_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_verifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verifications_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          city: string
          contract_terms: Json
          created_at: string
          deleted_at: string | null
          description: string | null
          email: string | null
          id: string
          logo_path: string | null
          name: string
          owner_id: string
          phone: string | null
          province: string
          registration_number: string | null
          registration_type: string | null
          representative_name: string | null
          representative_title: string | null
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          status_note: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          city: string
          contract_terms?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          name: string
          owner_id: string
          phone?: string | null
          province?: string
          registration_number?: string | null
          registration_type?: string | null
          representative_name?: string | null
          representative_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          status_note?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          contract_terms?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          province?: string
          registration_number?: string | null
          registration_type?: string | null
          representative_name?: string | null
          representative_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          status_note?: string | null
          updated_at?: string
          verified_at?: string | null
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
      contract_signatures: {
        Row: {
          booking_id: string
          content_hash: string
          contract_version_id: string
          id: string
          ip_address: unknown
          signature_data: string | null
          signature_type: Database["public"]["Enums"]["signature_type"]
          signed_at: string
          signer_email: string | null
          signer_id: string
          signer_name: string
          signer_role: Database["public"]["Enums"]["signer_role"]
          user_agent: string | null
        }
        Insert: {
          booking_id: string
          content_hash: string
          contract_version_id: string
          id?: string
          ip_address?: unknown
          signature_data?: string | null
          signature_type: Database["public"]["Enums"]["signature_type"]
          signed_at?: string
          signer_email?: string | null
          signer_id: string
          signer_name: string
          signer_role: Database["public"]["Enums"]["signer_role"]
          user_agent?: string | null
        }
        Update: {
          booking_id?: string
          content_hash?: string
          contract_version_id?: string
          id?: string
          ip_address?: unknown
          signature_data?: string | null
          signature_type?: Database["public"]["Enums"]["signature_type"]
          signed_at?: string
          signer_email?: string | null
          signer_id?: string
          signer_name?: string
          signer_role?: Database["public"]["Enums"]["signer_role"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sections: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sections: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sections?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          booking_id: string
          content_hash: string
          contract_id: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          pdf_path: string | null
          pdf_sha256: string | null
          sections: Json
          sent_at: string | null
          sent_by: string | null
          sent_to_email: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          version: number
          viewed_at: string | null
          viewed_ip: unknown
          viewed_user_agent: string | null
        }
        Insert: {
          booking_id: string
          content_hash: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          data: Json
          id?: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          sections: Json
          sent_at?: string | null
          sent_by?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          version: number
          viewed_at?: string | null
          viewed_ip?: unknown
          viewed_user_agent?: string | null
        }
        Update: {
          booking_id?: string
          content_hash?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          sections?: Json
          sent_at?: string | null
          sent_by?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          version?: number
          viewed_at?: string | null
          viewed_ip?: unknown
          viewed_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          booking_id: string
          business_id: string
          created_at: string
          current_version: number
          id: string
          renter_id: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          business_id: string
          created_at?: string
          current_version?: number
          id?: string
          renter_id: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          business_id?: string
          created_at?: string
          current_version?: number
          id?: string
          renter_id?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          business_id: string
          business_last_read_at: string | null
          business_replied: boolean
          created_at: string
          customer_id: string
          customer_last_read_at: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          last_sender_role:
            | Database["public"]["Enums"]["message_sender_role"]
            | null
          vehicle_id: string | null
        }
        Insert: {
          business_id: string
          business_last_read_at?: string | null
          business_replied?: boolean
          created_at?: string
          customer_id: string
          customer_last_read_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_role?:
            | Database["public"]["Enums"]["message_sender_role"]
            | null
          vehicle_id?: string | null
        }
        Update: {
          business_id?: string
          business_last_read_at?: string | null
          business_replied?: boolean
          created_at?: string
          customer_id?: string
          customer_last_read_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_role?:
            | Database["public"]["Enums"]["message_sender_role"]
            | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["driver_document_type"]
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["driver_document_type"]
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["driver_document_type"]
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_reminders: {
        Row: {
          due: string
          item: string
          sent_at: string
          stage: string
          vehicle_id: string
        }
        Insert: {
          due: string
          item: string
          sent_at?: string
          stage: string
          vehicle_id: string
        }
        Update: {
          due?: string
          item?: string
          sent_at?: string
          stage?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_devices: {
        Row: {
          business_id: string
          created_at: string
          external_id: string
          id: string
          integration_id: string
          label: string | null
          last_seen_at: string | null
          status: string
          vehicle_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          external_id: string
          id?: string
          integration_id: string
          label?: string | null
          last_seen_at?: string | null
          status?: string
          vehicle_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          external_id?: string
          id?: string
          integration_id?: string
          label?: string | null
          last_seen_at?: string | null
          status?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_devices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "gps_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_events: {
        Row: {
          booking_id: string | null
          business_id: string
          created_at: string
          device_id: string
          event_type: string
          id: number
          lat: number | null
          lng: number | null
          payload: Json
          recorded_at: string
          speed_kph: number | null
          vehicle_id: string | null
        }
        Insert: {
          booking_id?: string | null
          business_id: string
          created_at?: string
          device_id: string
          event_type: string
          id?: never
          lat?: number | null
          lng?: number | null
          payload?: Json
          recorded_at: string
          speed_kph?: number | null
          vehicle_id?: string | null
        }
        Update: {
          booking_id?: string | null
          business_id?: string
          created_at?: string
          device_id?: string
          event_type?: string
          id?: never
          lat?: number | null
          lng?: number | null
          payload?: Json
          recorded_at?: string
          speed_kph?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "gps_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_integrations: {
        Row: {
          business_id: string
          created_at: string
          id: string
          provider: string
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          provider: string
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          provider?: string
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          booking_id: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["message_sender_role"]
        }
        Insert: {
          body: string
          booking_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["message_sender_role"]
        }
        Update: {
          body?: string
          booking_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["message_sender_role"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          business_id: string | null
          created_at: string
          email_attempts: number
          email_error: string | null
          email_locked_until: string | null
          emailed_at: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          business_id?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_locked_until?: string | null
          emailed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          business_id?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_locked_until?: string | null
          emailed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          business_id: string
          created_at: string
          id: number
          vehicle_id: string | null
          viewed_on: string
          viewer_hash: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: never
          vehicle_id?: string | null
          viewed_on?: string
          viewer_hash: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: never
          vehicle_id?: string | null
          viewed_on?: string
          viewer_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_views_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          business_id: string
          created_at: string
          id: string
          instructions: string | null
          is_enabled: boolean
          method: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          business_id: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          method: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          business_id?: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          method?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          business_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method_type"]
          note: string | null
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          business_id: string
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method_type"]
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          business_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method_type"]
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
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
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          deletion_requested_at: string | null
          email: string | null
          full_name: string
          id: string
          is_admin: boolean
          is_suspended: boolean
          marketing_opt_in: boolean
          phone: string | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_admin?: boolean
          is_suspended?: boolean
          marketing_opt_in?: boolean
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_admin?: boolean
          is_suspended?: boolean
          marketing_opt_in?: boolean
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      renters: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          kyc_note: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          legal_name: string | null
          license_expiry: string | null
          license_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          kyc_note?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          legal_name?: string | null
          license_expiry?: string | null
          license_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          kyc_note?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          legal_name?: string | null
          license_expiry?: string | null
          license_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          business_id: string
          business_rating: number | null
          business_response: string | null
          comment: string | null
          created_at: string
          id: string
          is_hidden: boolean
          rating: number
          renter_id: string
          responded_at: string | null
          updated_at: string
          vehicle_id: string
          vehicle_rating: number | null
        }
        Insert: {
          booking_id: string
          business_id: string
          business_rating?: number | null
          business_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating: number
          renter_id: string
          responded_at?: string | null
          updated_at?: string
          vehicle_id: string
          vehicle_rating?: number | null
        }
        Update: {
          booking_id?: string
          business_id?: string
          business_rating?: number | null
          business_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating?: number
          renter_id?: string
          responded_at?: string | null
          updated_at?: string
          vehicle_id?: string
          vehicle_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_centavos: number
          amount_paid_centavos: number | null
          business_id: string
          checkout_session_id: string | null
          created_at: string
          created_by: string | null
          id: string
          livemode: boolean | null
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string
        }
        Insert: {
          amount_centavos: number
          amount_paid_centavos?: number | null
          business_id: string
          checkout_session_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          livemode?: boolean | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status?: string
        }
        Update: {
          amount_centavos?: number
          amount_paid_centavos?: number | null
          business_id?: string
          checkout_session_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          livemode?: boolean | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          created_at: string
          current_period_end: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_blocked_dates: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          note: string | null
          period: unknown
          reason: Database["public"]["Enums"]["block_reason"]
          starts_at: string
          vehicle_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          note?: string | null
          period?: unknown
          reason?: Database["public"]["Enums"]["block_reason"]
          starts_at: string
          vehicle_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          note?: string | null
          period?: unknown
          reason?: Database["public"]["Enums"]["block_reason"]
          starts_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_blocked_dates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_blocked_dates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_categories: {
        Row: {
          created_at: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      vehicle_fleet: {
        Row: {
          business_id: string
          insurance_expires_on: string | null
          next_service_km: number | null
          next_service_on: string | null
          odometer_km: number | null
          registration_expires_on: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          business_id: string
          insurance_expires_on?: string | null
          next_service_km?: number | null
          next_service_on?: string | null
          odometer_km?: number | null
          registration_expires_on?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          business_id?: string
          insurance_expires_on?: string | null
          next_service_km?: number | null
          next_service_on?: string | null
          odometer_km?: number | null
          registration_expires_on?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fleet_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fleet_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_images: {
        Row: {
          business_id: string
          created_at: string
          height: number | null
          id: string
          position: number
          storage_path: string
          vehicle_id: string
          width: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          storage_path: string
          vehicle_id: string
          width?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          storage_path?: string
          vehicle_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_pricing: {
        Row: {
          currency: string
          daily_rate: number
          delivery_fee: number
          driver_fee_per_day: number
          excess_km_fee: number | null
          mileage_limit_km: number | null
          monthly_rate: number | null
          security_deposit: number
          updated_at: string
          vehicle_id: string
          weekly_rate: number | null
        }
        Insert: {
          currency?: string
          daily_rate: number
          delivery_fee?: number
          driver_fee_per_day?: number
          excess_km_fee?: number | null
          mileage_limit_km?: number | null
          monthly_rate?: number | null
          security_deposit?: number
          updated_at?: string
          vehicle_id: string
          weekly_rate?: number | null
        }
        Update: {
          currency?: string
          daily_rate?: number
          delivery_fee?: number
          driver_fee_per_day?: number
          excess_km_fee?: number | null
          mileage_limit_km?: number | null
          monthly_rate?: number | null
          security_deposit?: number
          updated_at?: string
          vehicle_id?: string
          weekly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_pricing_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_service_logs: {
        Row: {
          business_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          odometer_km: number | null
          serviced_on: string
          vehicle_id: string
        }
        Insert: {
          business_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string | null
          odometer_km?: number | null
          serviced_on: string
          vehicle_id: string
        }
        Update: {
          business_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          odometer_km?: number | null
          serviced_on?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_service_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_service_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_service_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          business_id: string
          category_slug: string
          city: string
          color: string | null
          created_at: string
          deleted_at: string | null
          delivery_available: boolean
          description: string | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          make: string
          min_rental_days: number
          model: string
          pickup_location: string | null
          plate_number: string | null
          search: unknown
          seats: number
          self_drive: boolean
          slug: string
          status: Database["public"]["Enums"]["vehicle_status"]
          transmission: Database["public"]["Enums"]["transmission_type"]
          updated_at: string
          variant: string | null
          with_driver: boolean
          year: number
        }
        Insert: {
          business_id: string
          category_slug: string
          city: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_available?: boolean
          description?: string | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make: string
          min_rental_days?: number
          model: string
          pickup_location?: string | null
          plate_number?: string | null
          search?: unknown
          seats: number
          self_drive?: boolean
          slug: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          transmission: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          variant?: string | null
          with_driver?: boolean
          year: number
        }
        Update: {
          business_id?: string
          category_slug?: string
          city?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_available?: boolean
          description?: string | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make?: string
          min_rental_days?: number
          model?: string
          pickup_location?: string | null
          plate_number?: string | null
          search?: unknown
          seats?: number
          self_drive?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          transmission?: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          variant?: string | null
          with_driver?: boolean
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_booking_proposal: {
        Args: {
          p_booking_id: string
          p_payment_method: Database["public"]["Enums"]["payment_method_type"]
        }
        Returns: undefined
      }
      add_business_member: {
        Args: {
          p_business_id: string
          p_email: string
          p_role: Database["public"]["Enums"]["business_role"]
        }
        Returns: undefined
      }
      admin_anonymize_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_overview: { Args: never; Returns: Json }
      admin_resolve_report: {
        Args: {
          p_note?: string
          p_report_id: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      admin_review_business: {
        Args: {
          p_business_id: string
          p_decision: Database["public"]["Enums"]["business_status"]
          p_note?: string
        }
        Returns: undefined
      }
      admin_save_contract_template: {
        Args: { p_name: string; p_sections: Json }
        Returns: string
      }
      admin_set_kyc_status: {
        Args: {
          p_note?: string
          p_status: Database["public"]["Enums"]["kyc_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_plan: {
        Args: {
          p_business_id: string
          p_plan: Database["public"]["Enums"]["subscription_plan"]
          p_status?: Database["public"]["Enums"]["subscription_status"]
        }
        Returns: undefined
      }
      admin_set_review_hidden: {
        Args: { p_hidden: boolean; p_review_id: string }
        Returns: undefined
      }
      admin_set_user_suspended: {
        Args: { p_suspended: boolean; p_user_id: string }
        Returns: undefined
      }
      apply_booking_status: {
        Args: {
          p_actor: string
          p_booking_id: string
          p_note?: string
          p_to: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      apply_subscription_payment: {
        Args: {
          p_amount: number
          p_checkout_session_id: string
          p_livemode: boolean
          p_method: string
          p_payment_id: string
        }
        Returns: string
      }
      archive_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      assert_renter_ready: { Args: { p_user: string }; Returns: undefined }
      assistant_allow: {
        Args: { p_key: string; p_limit: number }
        Returns: boolean
      }
      attach_contract_pdf: {
        Args: { p_path: string; p_sha256: string; p_version_id: string }
        Returns: undefined
      }
      blocking_statuses: {
        Args: never
        Returns: Database["public"]["Enums"]["booking_status"][]
      }
      business_analytics: {
        Args: { p_business_id: string; p_days?: number }
        Returns: Json
      }
      business_analytics_advanced: {
        Args: { p_business_id: string; p_days?: number }
        Returns: Json
      }
      business_plan_active: { Args: { p_business: string }; Returns: boolean }
      business_public_stats: {
        Args: { p_ids: string[] }
        Returns: {
          business_id: string
          completed_rentals: number
          rating: number
          response_minutes: number
          review_count: number
          vehicle_count: number
        }[]
      }
      can_view_renter_documents: {
        Args: { p_renter: string }
        Returns: boolean
      }
      claim_notification_emails: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          business_id: string
          email: string
          full_name: string
          id: string
          link: string
          title: string
          type: string
          user_id: string
        }[]
      }
      contract_vars: { Args: { p_booking_id: string }; Returns: Json }
      create_review: {
        Args: {
          p_booking_id: string
          p_business_rating: number
          p_comment: string
          p_rating: number
          p_vehicle_rating: number
        }
        Returns: string
      }
      create_subscription_checkout: {
        Args: {
          p_actor_id: string
          p_business_id: string
          p_plan: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: string
      }
      expire_stale_bookings: { Args: never; Returns: number }
      fmt_date: { Args: { p: string }; Returns: string }
      fmt_money: { Args: { p: number }; Returns: string }
      fmt_ts: { Args: { p: string }; Returns: string }
      generate_booking_reference: { Args: never; Returns: string }
      generate_contract: {
        Args: { p_actor: string; p_booking_id: string }
        Returns: string
      }
      get_public_payment_methods: {
        Args: { p_business_id: string }
        Returns: Database["public"]["Enums"]["payment_method_type"][]
      }
      has_business_role: {
        Args: {
          p_business: string
          p_min?: Database["public"]["Enums"]["business_role"]
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_booking_party: { Args: { p_booking: string }; Returns: boolean }
      is_business_public: { Args: { p_business: string }; Returns: boolean }
      is_deliverable_email: { Args: { p: string }; Returns: boolean }
      is_reserved_slug: { Args: { p: string }; Returns: boolean }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      is_vehicle_available: {
        Args: {
          p_from: string
          p_ignore_booking?: string
          p_to: string
          p_vehicle_id: string
        }
        Returns: boolean
      }
      label_enum: { Args: { p: string }; Returns: string }
      log_audit: {
        Args: {
          p_action: string
          p_actor?: string
          p_business?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      mark_contract_viewed: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      member_has_role: {
        Args: {
          p_business: string
          p_min?: Database["public"]["Enums"]["business_role"]
          p_user: string
        }
        Returns: boolean
      }
      notification_email_due: { Args: { p_id: string }; Returns: boolean }
      notify_admins: {
        Args: {
          p_body: string
          p_link: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      notify_business: {
        Args: {
          p_body: string
          p_business: string
          p_link: string
          p_min?: Database["public"]["Enums"]["business_role"]
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_body: string
          p_business?: string
          p_link: string
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      plan_price_centavos: {
        Args: { p: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      plan_vehicle_limit: {
        Args: { p: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      post_system_message: {
        Args: {
          p_body: string
          p_booking_id?: string
          p_conversation_id: string
        }
        Returns: undefined
      }
      propose_booking: {
        Args: {
          p_conversation_id: string
          p_delivery?: boolean
          p_notes?: string
          p_pickup_at: string
          p_pickup_location: string
          p_return_at: string
          p_return_location: string
          p_vehicle_id: string
          p_with_driver?: boolean
        }
        Returns: string
      }
      public_reviews: {
        Args: { p_business_id: string; p_limit?: number; p_vehicle_id?: string }
        Returns: {
          business_rating: number
          business_response: string
          comment: string
          created_at: string
          id: string
          rating: number
          responded_at: string
          reviewer_name: string
          vehicle_name: string
          vehicle_rating: number
        }[]
      }
      quote_booking: {
        Args: {
          p_delivery?: boolean
          p_pickup_at: string
          p_return_at: string
          p_vehicle_id: string
          p_with_driver?: boolean
        }
        Returns: Json
      }
      record_contract_view: {
        Args: {
          p_actor_id: string
          p_contract_id: string
          p_ip: unknown
          p_user_agent: string
        }
        Returns: undefined
      }
      regenerate_contract: { Args: { p_booking_id: string }; Returns: string }
      register_business: {
        Args: {
          p_address?: string
          p_city: string
          p_description?: string
          p_email?: string
          p_name: string
          p_phone?: string
          p_province?: string
          p_registration_number?: string
          p_registration_type?: string
          p_representative_name?: string
          p_representative_title?: string
          p_slug: string
        }
        Returns: string
      }
      remove_business_member: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: undefined
      }
      render_template: {
        Args: { p_text: string; p_vars: Json }
        Returns: string
      }
      request_account_deletion: { Args: never; Returns: undefined }
      request_booking: {
        Args: {
          p_delivery?: boolean
          p_drivers_count?: number
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method_type"]
          p_pickup_at: string
          p_pickup_location: string
          p_return_at: string
          p_return_location: string
          p_vehicle_id: string
          p_with_driver?: boolean
        }
        Returns: string
      }
      request_email_dispatch: { Args: never; Returns: undefined }
      respond_to_review: {
        Args: { p_response: string; p_review_id: string }
        Returns: undefined
      }
      role_rank: {
        Args: { p: Database["public"]["Enums"]["business_role"] }
        Returns: number
      }
      save_contract_terms: {
        Args: { p_business_id: string; p_terms: Json }
        Returns: undefined
      }
      save_vehicle: {
        Args: {
          p_business_id: string
          p_pricing: Json
          p_vehicle: Json
          p_vehicle_id: string
        }
        Returns: string
      }
      search_vehicles: {
        Args: {
          p_business_id?: string
          p_category?: string
          p_cities?: string[]
          p_delivery?: boolean
          p_end?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_min_rating?: number
          p_min_seats?: number
          p_offset?: number
          p_q?: string
          p_self_drive?: boolean
          p_sort?: string
          p_start?: string
          p_transmission?: Database["public"]["Enums"]["transmission_type"]
          p_with_driver?: boolean
        }
        Returns: {
          accent_color: string
          business_id: string
          business_logo_path: string
          business_name: string
          business_slug: string
          category_slug: string
          city: string
          created_at: string
          daily_rate: number
          delivery_available: boolean
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          image_path: string
          make: string
          model: string
          rating: number
          review_count: number
          seats: number
          self_drive: boolean
          slug: string
          total_count: number
          transmission: Database["public"]["Enums"]["transmission_type"]
          variant: string
          weekly_rate: number
          with_driver: boolean
          year: number
        }[]
      }
      send_contract: {
        Args: {
          p_actor_id: string
          p_contract_id: string
          p_ip: unknown
          p_signature_data: string
          p_signature_type: Database["public"]["Enums"]["signature_type"]
          p_signer_name: string
          p_user_agent: string
        }
        Returns: undefined
      }
      send_error_summary: { Args: { p_user_id?: string }; Returns: number }
      send_fleet_reminders: {
        Args: { p_business_id?: string }
        Returns: number
      }
      send_rental_reminders: { Args: never; Returns: number }
      send_trial_reminders: { Args: never; Returns: number }
      set_storefront_published: {
        Args: { p_business_id: string; p_publish: boolean }
        Returns: undefined
      }
      sign_contract: {
        Args: {
          p_actor_id: string
          p_agreed: boolean
          p_content_hash: string
          p_ip: unknown
          p_signature_data: string
          p_signature_type: Database["public"]["Enums"]["signature_type"]
          p_signer_name: string
          p_user_agent: string
          p_version_id: string
        }
        Returns: undefined
      }
      slugify: { Args: { p: string }; Returns: string }
      start_conversation: {
        Args: { p_body: string; p_business_id: string; p_vehicle_id: string }
        Returns: string
      }
      submit_business_verification: {
        Args: { p_business_id: string; p_documents: Json; p_note?: string }
        Returns: undefined
      }
      subscription_is_active: { Args: { p_business: string }; Returns: boolean }
      track_view: {
        Args: {
          p_business_id: string
          p_vehicle_id: string
          p_viewer_hash: string
        }
        Returns: undefined
      }
      transition_booking: {
        Args: {
          p_booking_id: string
          p_note?: string
          p_to: Database["public"]["Enums"]["booking_status"]
        }
        Returns: Database["public"]["Enums"]["booking_status"]
      }
      trial_days: { Args: never; Returns: number }
      try_uuid: { Args: { p: string }; Returns: string }
      update_booking_terms: {
        Args: {
          p_booking_id: string
          p_discount?: number
          p_other_fees?: number
          p_pickup_at: string
          p_pickup_location: string
          p_return_at: string
          p_return_location: string
          p_security_deposit?: number
        }
        Returns: undefined
      }
      vehicle_unavailable_ranges: {
        Args: { p_from: string; p_to: string; p_vehicle_id: string }
        Returns: {
          ends_at: string
          kind: string
          starts_at: string
        }[]
      }
    }
    Enums: {
      block_reason: "BLOCKED" | "MAINTENANCE"
      booking_status:
        | "INQUIRY"
        | "NEGOTIATING"
        | "BOOKING_REQUESTED"
        | "PENDING_OWNER_APPROVAL"
        | "APPROVED"
        | "CONTRACT_DRAFT"
        | "CONTRACT_SENT"
        | "AWAITING_SIGNATURE"
        | "SIGNED"
        | "CONFIRMED"
        | "ACTIVE"
        | "RETURNED"
        | "COMPLETED"
        | "CANCELLED"
        | "REJECTED"
        | "EXPIRED"
      business_role: "OWNER" | "MANAGER" | "STAFF"
      business_status:
        | "DRAFT"
        | "PENDING"
        | "UNDER_REVIEW"
        | "CHANGES_REQUESTED"
        | "VERIFIED"
        | "REJECTED"
        | "SUSPENDED"
      contract_status: "DRAFT" | "SENT" | "SIGNED" | "SUPERSEDED" | "CANCELLED"
      driver_document_type:
        | "DRIVERS_LICENSE_FRONT"
        | "DRIVERS_LICENSE_BACK"
        | "GOVERNMENT_ID"
      fuel_type: "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC"
      kyc_status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED"
      message_sender_role: "CUSTOMER" | "BUSINESS" | "SYSTEM"
      payment_method_type:
        | "CASH"
        | "GCASH"
        | "MAYA"
        | "BANK_TRANSFER"
        | "CARD"
        | "OTHER"
      payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PAYMENT_ON_PICKUP"
      report_status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"
      signature_type: "TYPED" | "DRAWN"
      signer_role: "RENTER" | "PROVIDER"
      subscription_plan: "FREE" | "PRO" | "BUSINESS"
      subscription_status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED"
      transmission_type: "AUTOMATIC" | "MANUAL"
      vehicle_status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "UNAVAILABLE"
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
      block_reason: ["BLOCKED", "MAINTENANCE"],
      booking_status: [
        "INQUIRY",
        "NEGOTIATING",
        "BOOKING_REQUESTED",
        "PENDING_OWNER_APPROVAL",
        "APPROVED",
        "CONTRACT_DRAFT",
        "CONTRACT_SENT",
        "AWAITING_SIGNATURE",
        "SIGNED",
        "CONFIRMED",
        "ACTIVE",
        "RETURNED",
        "COMPLETED",
        "CANCELLED",
        "REJECTED",
        "EXPIRED",
      ],
      business_role: ["OWNER", "MANAGER", "STAFF"],
      business_status: [
        "DRAFT",
        "PENDING",
        "UNDER_REVIEW",
        "CHANGES_REQUESTED",
        "VERIFIED",
        "REJECTED",
        "SUSPENDED",
      ],
      contract_status: ["DRAFT", "SENT", "SIGNED", "SUPERSEDED", "CANCELLED"],
      driver_document_type: [
        "DRIVERS_LICENSE_FRONT",
        "DRIVERS_LICENSE_BACK",
        "GOVERNMENT_ID",
      ],
      fuel_type: ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"],
      kyc_status: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"],
      message_sender_role: ["CUSTOMER", "BUSINESS", "SYSTEM"],
      payment_method_type: [
        "CASH",
        "GCASH",
        "MAYA",
        "BANK_TRANSFER",
        "CARD",
        "OTHER",
      ],
      payment_status: ["UNPAID", "PARTIALLY_PAID", "PAID", "PAYMENT_ON_PICKUP"],
      report_status: ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"],
      signature_type: ["TYPED", "DRAWN"],
      signer_role: ["RENTER", "PROVIDER"],
      subscription_plan: ["FREE", "PRO", "BUSINESS"],
      subscription_status: ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"],
      transmission_type: ["AUTOMATIC", "MANUAL"],
      vehicle_status: ["ACTIVE", "INACTIVE", "MAINTENANCE", "UNAVAILABLE"],
    },
  },
} as const
