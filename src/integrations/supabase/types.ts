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
          session_token_hash: string | null
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          session_token_hash?: string | null
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          session_token_hash?: string | null
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
          session_id: string | null
          wallet_index: number
          wallet_state: string
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
          session_id?: string | null
          wallet_index: number
          wallet_state?: string
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
          session_id?: string | null
          wallet_index?: number
          wallet_state?: string
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
      session_reconciliation: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          master_balance_after: number
          master_balance_before: number
          reconciliation_status: string
          session_id: string
          total_lamports_buy_amount: number
          total_lamports_fees: number
          total_lamports_funded: number
          total_lamports_lost: number
          total_lamports_recovered: number
          total_wallets_failed: number
          total_wallets_funded: number
          total_wallets_succeeded: number
          total_wallets_used: number
          unexplained_loss_lamports: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          master_balance_after?: number
          master_balance_before?: number
          reconciliation_status?: string
          session_id: string
          total_lamports_buy_amount?: number
          total_lamports_fees?: number
          total_lamports_funded?: number
          total_lamports_lost?: number
          total_lamports_recovered?: number
          total_wallets_failed?: number
          total_wallets_funded?: number
          total_wallets_succeeded?: number
          total_wallets_used?: number
          unexplained_loss_lamports?: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          master_balance_after?: number
          master_balance_before?: number
          reconciliation_status?: string
          session_id?: string
          total_lamports_buy_amount?: number
          total_lamports_fees?: number
          total_lamports_funded?: number
          total_lamports_lost?: number
          total_lamports_recovered?: number
          total_wallets_failed?: number
          total_wallets_funded?: number
          total_wallets_succeeded?: number
          total_wallets_used?: number
          unexplained_loss_lamports?: number
        }
        Relationships: []
      }
      trade_attempt_logs: {
        Row: {
          attempt_no: number
          classification: string
          created_at: string
          error_text: string | null
          fee_charged_lamports: number
          final_wallet_state: string | null
          id: number
          lamports_drained_back: number
          lamports_funded: number
          metadata: Json | null
          onchain_confirmed: boolean
          provider_used: string | null
          rpc_submitted: boolean
          session_id: string
          sol_amount: number | null
          stage: string
          tx_signature: string | null
          wallet_address: string
          wallet_index: number
        }
        Insert: {
          attempt_no?: number
          classification: string
          created_at?: string
          error_text?: string | null
          fee_charged_lamports?: number
          final_wallet_state?: string | null
          id?: number
          lamports_drained_back?: number
          lamports_funded?: number
          metadata?: Json | null
          onchain_confirmed?: boolean
          provider_used?: string | null
          rpc_submitted?: boolean
          session_id: string
          sol_amount?: number | null
          stage: string
          tx_signature?: string | null
          wallet_address: string
          wallet_index: number
        }
        Update: {
          attempt_no?: number
          classification?: string
          created_at?: string
          error_text?: string | null
          fee_charged_lamports?: number
          final_wallet_state?: string | null
          id?: number
          lamports_drained_back?: number
          lamports_funded?: number
          metadata?: Json | null
          onchain_confirmed?: boolean
          provider_used?: string | null
          rpc_submitted?: boolean
          session_id?: string
          sol_amount?: number | null
          stage?: string
          tx_signature?: string | null
          wallet_address?: string
          wallet_index?: number
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
      volume_bot_sessions: {
        Row: {
          completed_trades: number
          created_at: string
          current_wallet_index: number
          duration_minutes: number | null
          errors: string[] | null
          id: string
          last_trade_at: string | null
          max_sol_per_trade: number | null
          min_sol_per_trade: number | null
          status: string
          token_address: string
          token_type: string
          total_fees_lost: number
          total_sol: number
          total_trades: number
          total_volume: number
          updated_at: string
          wallet_start_index: number | null
        }
        Insert: {
          completed_trades?: number
          created_at?: string
          current_wallet_index?: number
          duration_minutes?: number | null
          errors?: string[] | null
          id?: string
          last_trade_at?: string | null
          max_sol_per_trade?: number | null
          min_sol_per_trade?: number | null
          status?: string
          token_address: string
          token_type?: string
          total_fees_lost?: number
          total_sol?: number
          total_trades?: number
          total_volume?: number
          updated_at?: string
          wallet_start_index?: number | null
        }
        Update: {
          completed_trades?: number
          created_at?: string
          current_wallet_index?: number
          duration_minutes?: number | null
          errors?: string[] | null
          id?: string
          last_trade_at?: string | null
          max_sol_per_trade?: number | null
          min_sol_per_trade?: number | null
          status?: string
          token_address?: string
          token_type?: string
          total_fees_lost?: number
          total_sol?: number
          total_trades?: number
          total_volume?: number
          updated_at?: string
          wallet_start_index?: number | null
        }
        Relationships: []
      }
      wallet_audit_log: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          new_state: string
          previous_state: string | null
          session_id: string | null
          sol_amount: number | null
          token_amount: number | null
          token_mint: string | null
          tx_signature: string | null
          wallet_address: string
          wallet_index: number
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_state: string
          previous_state?: string | null
          session_id?: string | null
          sol_amount?: number | null
          token_amount?: number | null
          token_mint?: string | null
          tx_signature?: string | null
          wallet_address: string
          wallet_index: number
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_state?: string
          previous_state?: string | null
          session_id?: string | null
          sol_amount?: number | null
          token_amount?: number | null
          token_mint?: string | null
          tx_signature?: string | null
          wallet_address?: string
          wallet_index?: number
        }
        Relationships: []
      }
      wallet_holdings: {
        Row: {
          buy_tx_signature: string | null
          created_at: string
          drain_tx_signature: string | null
          drained_at: string | null
          error_message: string | null
          fees_paid: number | null
          fund_tx_signature: string | null
          id: string
          sell_tx_signature: string | null
          session_id: string | null
          sol_recovered: number | null
          sol_spent: number | null
          sold_at: string | null
          status: string
          token_amount: number | null
          token_mint: string
          updated_at: string
          wallet_address: string
          wallet_id: string | null
          wallet_index: number
        }
        Insert: {
          buy_tx_signature?: string | null
          created_at?: string
          drain_tx_signature?: string | null
          drained_at?: string | null
          error_message?: string | null
          fees_paid?: number | null
          fund_tx_signature?: string | null
          id?: string
          sell_tx_signature?: string | null
          session_id?: string | null
          sol_recovered?: number | null
          sol_spent?: number | null
          sold_at?: string | null
          status?: string
          token_amount?: number | null
          token_mint: string
          updated_at?: string
          wallet_address: string
          wallet_id?: string | null
          wallet_index: number
        }
        Update: {
          buy_tx_signature?: string | null
          created_at?: string
          drain_tx_signature?: string | null
          drained_at?: string | null
          error_message?: string | null
          fees_paid?: number | null
          fund_tx_signature?: string | null
          id?: string
          sell_tx_signature?: string | null
          session_id?: string | null
          sol_recovered?: number | null
          sol_spent?: number | null
          sold_at?: string | null
          status?: string
          token_amount?: number | null
          token_mint?: string
          updated_at?: string
          wallet_address?: string
          wallet_id?: string | null
          wallet_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_holdings_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "admin_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      whale_station_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_state: string | null
          previous_state: string | null
          session_id: string | null
          sol_amount: number | null
          token_amount: number | null
          token_mint: string | null
          tx_signature: string | null
          wallet_address: string | null
          wallet_index: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          session_id?: string | null
          sol_amount?: number | null
          token_amount?: number | null
          token_mint?: string | null
          tx_signature?: string | null
          wallet_address?: string | null
          wallet_index?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          session_id?: string | null
          sol_amount?: number | null
          token_amount?: number | null
          token_mint?: string | null
          tx_signature?: string | null
          wallet_address?: string | null
          wallet_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whale_station_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whale_station_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whale_station_holdings: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          sell_tx_signature: string | null
          status: string
          token_amount: number | null
          token_decimals: number | null
          token_mint: string
          updated_at: string
          wallet_address: string
          wallet_index: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          sell_tx_signature?: string | null
          status?: string
          token_amount?: number | null
          token_decimals?: number | null
          token_mint: string
          updated_at?: string
          wallet_address: string
          wallet_index: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          sell_tx_signature?: string | null
          status?: string
          token_amount?: number | null
          token_decimals?: number | null
          token_mint?: string
          updated_at?: string
          wallet_address?: string
          wallet_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "whale_station_holdings_wallet_index_fkey"
            columns: ["wallet_index"]
            isOneToOne: false
            referencedRelation: "whale_station_wallets"
            referencedColumns: ["wallet_index"]
          },
        ]
      }
      whale_station_sessions: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          master_balance_after: number | null
          master_balance_before: number | null
          mints_sold: number | null
          reconciliation_data: Json | null
          reconciliation_status: string | null
          status: string
          total_drained: number | null
          total_fees_paid: number | null
          total_funded: number | null
          total_sol_received: number | null
          wallets_processed: number | null
          wallets_total: number | null
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          master_balance_after?: number | null
          master_balance_before?: number | null
          mints_sold?: number | null
          reconciliation_data?: Json | null
          reconciliation_status?: string | null
          status?: string
          total_drained?: number | null
          total_fees_paid?: number | null
          total_funded?: number | null
          total_sol_received?: number | null
          wallets_processed?: number | null
          wallets_total?: number | null
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          master_balance_after?: number | null
          master_balance_before?: number | null
          mints_sold?: number | null
          reconciliation_data?: Json | null
          reconciliation_status?: string | null
          status?: string
          total_drained?: number | null
          total_fees_paid?: number | null
          total_funded?: number | null
          total_sol_received?: number | null
          wallets_processed?: number | null
          wallets_total?: number | null
        }
        Relationships: []
      }
      whale_station_wallets: {
        Row: {
          cached_sol_balance: number | null
          created_at: string
          encrypted_private_key: string
          id: string
          is_whale_master: boolean
          last_scan_at: string | null
          last_sell_proceeds: number | null
          lock_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          public_key: string
          retained_sol_source: string | null
          retention_mode: string | null
          updated_at: string
          wallet_index: number
          wallet_state: string
        }
        Insert: {
          cached_sol_balance?: number | null
          created_at?: string
          encrypted_private_key: string
          id?: string
          is_whale_master?: boolean
          last_scan_at?: string | null
          last_sell_proceeds?: number | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          public_key: string
          retained_sol_source?: string | null
          retention_mode?: string | null
          updated_at?: string
          wallet_index: number
          wallet_state?: string
        }
        Update: {
          cached_sol_balance?: number | null
          created_at?: string
          encrypted_private_key?: string
          id?: string
          is_whale_master?: boolean
          last_scan_at?: string | null
          last_sell_proceeds?: number | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          public_key?: string
          retained_sol_source?: string | null
          retention_mode?: string | null
          updated_at?: string
          wallet_index?: number
          wallet_state?: string
        }
        Relationships: []
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
