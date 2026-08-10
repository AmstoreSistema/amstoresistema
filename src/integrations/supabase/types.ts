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
      accounts: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          kind: string
          status: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity: string
          entity_id: string | null
          id: string
          user_email: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
        }
        Relationships: []
      }
      cashback_entries: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          id: string
          kind: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          cashback_balance: number
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          cashback_balance?: number
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          cashback_balance?: number
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          sale_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          sku: string | null
          supplier: string | null
          type: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          sku?: string | null
          supplier?: string | null
          type?: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          sku?: string | null
          supplier?: string | null
          type?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_materials: {
        Row: {
          id: string
          material_id: string | null
          product_id: string | null
          quantity: number
        }
        Insert: {
          id?: string
          material_id?: string | null
          product_id?: string | null
          quantity: number
        }
        Update: {
          id?: string
          material_id?: string | null
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          priority: string | null
          product_id: string | null
          quantity: number
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          product_id?: string | null
          quantity: number
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          product_id?: string | null
          quantity?: number
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost_price: number
          created_at: string | null
          current_stock: number | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          production_time_hours: number | null
          sale_price: number | null
          sku: string | null
          updated_at: string | null
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean
          category?: string
          cost_price?: number
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          production_time_hours?: number | null
          sale_price?: number | null
          sku?: string | null
          updated_at?: string | null
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          cost_price?: number
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          production_time_hours?: number | null
          sale_price?: number | null
          sku?: string | null
          updated_at?: string | null
          wholesale_price?: number | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          discount_percent: number
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          discount_percent?: number
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          discount_percent?: number
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          notes: string | null
          quantity: number
          received_at: string | null
          status: string
          supplier: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          quantity?: number
          received_at?: string | null
          status?: string
          supplier?: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          quantity?: number
          received_at?: string | null
          status?: string
          supplier?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_id: string | null
          created_at: string | null
          discount: number
          id: string
          is_debt: boolean | null
          notes: string | null
          paid_amount: number
          payment_method: string
          status: string | null
          total_amount: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          discount?: number
          id?: string
          is_debt?: boolean | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          status?: string | null
          total_amount: number
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          discount?: number
          id?: string
          is_debt?: boolean | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
