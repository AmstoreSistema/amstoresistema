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
      financial_accounts: {
        Row: {
          account_number: string | null
          active: boolean
          agency: string | null
          bank_name: string | null
          color: string | null
          created_at: string | null
          created_by_id: string | null
          current_balance: number
          id: string
          initial_balance: number
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string | null
          created_by_id?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string | null
          created_by_id?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      material_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      material_cuts: {
        Row: {
          created_at: string | null
          height: number
          id: string
          material_id: string
          name: string
          rotation: number | null
          status: string | null
          width: number
          x: number | null
          y: number | null
        }
        Insert: {
          created_at?: string | null
          height: number
          id?: string
          material_id: string
          name: string
          rotation?: number | null
          status?: string | null
          width: number
          x?: number | null
          y?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number
          id?: string
          material_id?: string
          name?: string
          rotation?: number | null
          status?: string | null
          width?: number
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_cuts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_variations: {
        Row: {
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          material_id: string
          name: string
          notes: string | null
          specification: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          material_id: string
          name: string
          notes?: string | null
          specification?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          material_id?: string
          name?: string
          notes?: string | null
          specification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_variations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          color: string | null
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          description: string | null
          height: number | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          sku: string | null
          specification: string | null
          supplier: string | null
          thickness: number | null
          type: string
          unit: string
          updated_at: string | null
          width: number | null
        }
        Insert: {
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          sku?: string | null
          specification?: string | null
          supplier?: string | null
          thickness?: number | null
          type?: string
          unit: string
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          sku?: string | null
          specification?: string | null
          supplier?: string | null
          thickness?: number | null
          type?: string
          unit?: string
          updated_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      product_materials: {
        Row: {
          allows_scrap: boolean
          created_at: string
          id: string
          material_cut_id: string | null
          material_id: string | null
          material_name: string | null
          material_type: string | null
          material_variation_id: string | null
          notes: string | null
          product_id: string | null
          quantity: number
          stage: string | null
          total_cost: number
          unit: string | null
          unit_cost: number
          updated_at: string
          validated: boolean
          validated_at: string | null
          variation_name: string | null
        }
        Insert: {
          allows_scrap?: boolean
          created_at?: string
          id?: string
          material_cut_id?: string | null
          material_id?: string | null
          material_name?: string | null
          material_type?: string | null
          material_variation_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity: number
          stage?: string | null
          total_cost?: number
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          variation_name?: string | null
        }
        Update: {
          allows_scrap?: boolean
          created_at?: string
          id?: string
          material_cut_id?: string | null
          material_id?: string | null
          material_name?: string | null
          material_type?: string | null
          material_variation_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          stage?: string | null
          total_cost?: number
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_material_cut_id_fkey"
            columns: ["material_cut_id"]
            isOneToOne: false
            referencedRelation: "material_cuts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_material_variation_id_fkey"
            columns: ["material_variation_id"]
            isOneToOne: false
            referencedRelation: "material_variations"
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
          codigo_ordem: string | null
          completed_at: string | null
          created_at: string | null
          created_by_id: string | null
          data_prevista: string | null
          id: string
          is_sample: boolean | null
          materiais_baixados: boolean | null
          notes: string | null
          plano_corte_id: string | null
          priority: string | null
          product_id: string | null
          produto_nome: string | null
          qualidade_inspecionada: boolean | null
          quantity: number
          started_at: string | null
          status: string | null
        }
        Insert: {
          codigo_ordem?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_id?: string | null
          data_prevista?: string | null
          id?: string
          is_sample?: boolean | null
          materiais_baixados?: boolean | null
          notes?: string | null
          plano_corte_id?: string | null
          priority?: string | null
          product_id?: string | null
          produto_nome?: string | null
          qualidade_inspecionada?: boolean | null
          quantity: number
          started_at?: string | null
          status?: string | null
        }
        Update: {
          codigo_ordem?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_id?: string | null
          data_prevista?: string | null
          id?: string
          is_sample?: boolean | null
          materiais_baixados?: boolean | null
          notes?: string | null
          plano_corte_id?: string | null
          priority?: string | null
          product_id?: string | null
          produto_nome?: string | null
          qualidade_inspecionada?: boolean | null
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
          color: string | null
          cost_price: number
          created_at: string | null
          current_stock: number | null
          description: string | null
          id: string
          image_url: string | null
          labor_cost: number
          min_stock: number
          name: string
          overhead_cost: number
          production_time_hours: number | null
          retail_margin: number
          sale_price: number | null
          sku: string | null
          updated_at: string | null
          wholesale_margin: number
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean
          category?: string
          color?: string | null
          cost_price?: number
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          labor_cost?: number
          min_stock?: number
          name: string
          overhead_cost?: number
          production_time_hours?: number | null
          retail_margin?: number
          sale_price?: number | null
          sku?: string | null
          updated_at?: string | null
          wholesale_margin?: number
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          color?: string | null
          cost_price?: number
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          labor_cost?: number
          min_stock?: number
          name?: string
          overhead_cost?: number
          production_time_hours?: number | null
          retail_margin?: number
          sale_price?: number | null
          sku?: string | null
          updated_at?: string | null
          wholesale_margin?: number
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
      sale_installments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          remaining_amount: number | null
          sale_id: string
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          remaining_amount?: number | null
          sale_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          remaining_amount?: number | null
          sale_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount: number | null
          id: string
          numeracao: string | null
          product_id: string | null
          quantity: number
          sale_id: string | null
          stock_snapshot: Json | null
          unit_price: number
        }
        Insert: {
          discount?: number | null
          id?: string
          numeracao?: string | null
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          stock_snapshot?: Json | null
          unit_price: number
        }
        Update: {
          discount?: number | null
          id?: string
          numeracao?: string | null
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          stock_snapshot?: Json | null
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
      sale_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_method: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_method: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashback_earned: number | null
          cashback_used: number | null
          client_id: string | null
          created_at: string | null
          discount: number
          due_date: string | null
          financial_account_id: string | null
          id: string
          installments_count: number | null
          is_debt: boolean | null
          notes: string | null
          paid_amount: number
          payment_method: string
          protection_method: string | null
          sale_code: string | null
          sale_type: string | null
          seller_id: string | null
          status: string | null
          total_amount: number
        }
        Insert: {
          cashback_earned?: number | null
          cashback_used?: number | null
          client_id?: string | null
          created_at?: string | null
          discount?: number
          due_date?: string | null
          financial_account_id?: string | null
          id?: string
          installments_count?: number | null
          is_debt?: boolean | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          protection_method?: string | null
          sale_code?: string | null
          sale_type?: string | null
          seller_id?: string | null
          status?: string | null
          total_amount: number
        }
        Update: {
          cashback_earned?: number | null
          cashback_used?: number | null
          client_id?: string | null
          created_at?: string | null
          discount?: number
          due_date?: string | null
          financial_account_id?: string | null
          id?: string
          installments_count?: number | null
          is_debt?: boolean | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          protection_method?: string | null
          sale_code?: string | null
          sale_type?: string | null
          seller_id?: string | null
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
          {
            foreignKeyName: "sales_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_products: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_entrada: string | null
          id: string
          localizacao: string | null
          lote: string | null
          numeracoes: Json | null
          ordem_producao_id: string | null
          preco_custo: number | null
          preco_venda: number | null
          produto_id: string | null
          produto_nome: string
          quantidade_disponivel: number | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_entrada?: string | null
          id?: string
          localizacao?: string | null
          lote?: string | null
          numeracoes?: Json | null
          ordem_producao_id?: string | null
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          produto_nome: string
          quantidade_disponivel?: number | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_entrada?: string | null
          id?: string
          localizacao?: string | null
          lote?: string | null
          numeracoes?: Json | null
          ordem_producao_id?: string | null
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          produto_nome?: string
          quantidade_disponivel?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_products_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_products_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_method: string | null
          purchase_id: string | null
          sale_id: string | null
          status: string | null
          supplier_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          purchase_id?: string | null
          sale_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          purchase_id?: string | null
          sale_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          abbreviation: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_complete_sale: { Args: { p_sale_id: string }; Returns: undefined }
      check_sale_installments_alerts: { Args: never; Returns: undefined }
      complete_production_order: { Args: { _order_id: string }; Returns: Json }
      create_complete_sale:
        | {
            Args: {
              p_cashback_earned: number
              p_cashback_used: number
              p_client_id: string
              p_discount: number
              p_is_debt: boolean
              p_items: Json
              p_notes: string
              p_paid_amount: number
              p_payment_method: string
              p_total_amount: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cashback_earned: number
              p_cashback_used: number
              p_client_id: string
              p_discount: number
              p_installments?: Json
              p_is_debt: boolean
              p_items: Json
              p_notes: string
              p_paid_amount: number
              p_payment_method: string
              p_total_amount: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cashback_earned: number
              p_cashback_used: number
              p_client_id: string
              p_discount: number
              p_financial_account_id?: string
              p_installments?: Json
              p_is_debt: boolean
              p_items: Json
              p_notes: string
              p_paid_amount: number
              p_payment_method: string
              p_protection_method?: string
              p_sale_code?: string
              p_sale_type?: string
              p_total_amount: number
            }
            Returns: string
          }
      delete_production_order: { Args: { _order_id: string }; Returns: Json }
      pay_sale_installment: {
        Args: {
          p_amount: number
          p_installment_id: string
          p_payment_method: string
        }
        Returns: undefined
      }
      start_production_order: { Args: { _order_id: string }; Returns: Json }
      transfer_between_accounts: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_dest_id: string
          p_origin_id: string
        }
        Returns: undefined
      }
      update_sale_installments: {
        Args: { p_installments: Json; p_sale_id: string }
        Returns: undefined
      }
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
