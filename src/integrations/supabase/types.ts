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
      admin_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      admin_wallets: {
        Row: {
          cached_balance: number | null
          created_at: string
          encrypted_private_key: string
          id: string
          is_master: boolean
          label: string | null
          last_balance_check: string | null
          network: string
          public_key: string
          wallet_index: number
          wallet_type: string
        }
        Insert: {
          cached_balance?: number | null
          created_at?: string
          encrypted_private_key: string
          id?: string
          is_master?: boolean
          label?: string | null
          last_balance_check?: string | null
          network?: string
          public_key: string
          wallet_index: number
          wallet_type?: string
        }
        Update: {
          cached_balance?: number | null
          created_at?: string
          encrypted_private_key?: string
          id?: string
          is_master?: boolean
          label?: string | null
          last_balance_check?: string | null
          network?: string
          public_key?: string
          wallet_index?: number
          wallet_type?: string
        }
        Relationships: []
      }
      bot_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          makers_count: number
          mode: string
          started_at: string | null
          status: string
          subscription_id: string | null
          token_address: string | null
          token_network: string | null
          token_symbol: string | null
          transactions_completed: number | null
          transactions_total: number | null
          updated_at: string
          user_email: string | null
          volume_generated: number | null
          wallet_address: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          makers_count?: number
          mode?: string
          started_at?: string | null
          status?: string
          subscription_id?: string | null
          token_address?: string | null
          token_network?: string | null
          token_symbol?: string | null
          transactions_completed?: number | null
          transactions_total?: number | null
          updated_at?: string
          user_email?: string | null
          volume_generated?: number | null
          wallet_address?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          makers_count?: number
          mode?: string
          started_at?: string | null
          status?: string
          subscription_id?: string | null
          token_address?: string | null
          token_network?: string | null
          token_symbol?: string | null
          transactions_completed?: number | null
          transactions_total?: number | null
          updated_at?: string
          user_email?: string | null
          volume_generated?: number | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_eur: number | null
          created_at: string
          id: string
          metadata: Json | null
          package_id: string | null
          plan_id: string | null
          status: string
          token_amount: number | null
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_email: string | null
          wallet_address: string | null
        }
        Insert: {
          amount_eur?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          package_id?: string | null
          plan_id?: string | null
          status?: string
          token_amount?: number | null
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_email?: string | null
          wallet_address?: string | null
        }
        Update: {
          amount_eur?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          package_id?: string | null
          plan_id?: string | null
          status?: string
          token_amount?: number | null
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_email?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          credits_remaining: number | null
          expires_at: string | null
          id: string
          last_payment_id: string | null
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_email: string | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_last_payment_id_fkey"
            columns: ["last_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
