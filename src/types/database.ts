export type Json =
  | string
  | number
  | boolean
  | null
  | {[key: string]: Json | undefined}
  | Json[];

export type AppRole = "ADMIN" | "FORKLIFT_DRIVER" | "OFFICE" | "PRODUCTION";

export type StackLevel = "GROUND" | "LEVEL_1" | "LEVEL_2";

export type ModuleStatus = "AVAILABLE" | "RENTED";

export type ModuleTypeCode = "6x3" | "3x3";

export type PhotoCategory =
  | "GENERAL"
  | "TECHNICAL"
  | "DAMAGE"
  | "BEFORE_DEPARTURE"
  | "RETURN";

export type DamageReportStatus = "DRAFT" | "SUBMITTED";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: AppRole;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: AppRole;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: AppRole;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      module_types: {
        Row: {
          id: string;
          code: ModuleTypeCode;
          type_number: string | null;
          length_m: number;
          width_m: number;
          name: string;
          notes: string | null;
          drawing_storage_path: string | null;
          drawing_mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: ModuleTypeCode;
          type_number?: string | null;
          length_m: number;
          width_m: number;
          name: string;
          notes?: string | null;
          drawing_storage_path?: string | null;
          drawing_mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: ModuleTypeCode;
          type_number?: string | null;
          length_m?: number;
          width_m?: number;
          name?: string;
          notes?: string | null;
          drawing_storage_path?: string | null;
          drawing_mime_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      yard_blocks: {
        Row: {
          id: string;
          code: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      yard_rows: {
        Row: {
          id: string;
          block_id: string;
          code: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          code: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          code?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "yard_rows_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "yard_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      yard_positions: {
        Row: {
          id: string;
          row_id: string;
          code: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          row_id: string;
          code: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          row_id?: string;
          code?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "yard_positions_row_id_fkey";
            columns: ["row_id"];
            isOneToOne: false;
            referencedRelation: "yard_rows";
            referencedColumns: ["id"];
          },
        ];
      };
      yard_slots: {
        Row: {
          id: string;
          block_id: string;
          row_id: string;
          position_id: string;
          level: StackLevel;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          row_id: string;
          position_id: string;
          level: StackLevel;
          created_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          row_id?: string;
          position_id?: string;
          level?: StackLevel;
          created_at?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          module_number: string;
          module_type_id: string;
          status: ModuleStatus;
          rented_to_project: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_number: string;
          module_type_id: string;
          status?: ModuleStatus;
          rented_to_project?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_number?: string;
          module_type_id?: string;
          status?: ModuleStatus;
          rented_to_project?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modules_module_type_id_fkey";
            columns: ["module_type_id"];
            isOneToOne: false;
            referencedRelation: "module_types";
            referencedColumns: ["id"];
          },
        ];
      };
      module_locations: {
        Row: {
          module_id: string;
          slot_id: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          module_id: string;
          slot_id: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          module_id?: string;
          slot_id?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "module_locations_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: true;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "module_locations_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: true;
            referencedRelation: "yard_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      module_movements: {
        Row: {
          id: string;
          module_id: string;
          from_slot_id: string | null;
          to_slot_id: string | null;
          moved_by: string | null;
          moved_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          from_slot_id?: string | null;
          to_slot_id?: string | null;
          moved_by?: string | null;
          moved_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          module_id?: string;
          from_slot_id?: string | null;
          to_slot_id?: string | null;
          moved_by?: string | null;
          moved_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      module_photos: {
        Row: {
          id: string;
          module_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          byte_size: number | null;
          caption: string | null;
          category: PhotoCategory;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          byte_size?: number | null;
          caption?: string | null;
          category?: PhotoCategory;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string | null;
          byte_size?: number | null;
          caption?: string | null;
          category?: PhotoCategory;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value_json: Json | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value_json?: Json | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value_json?: Json | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment_kinds: {
        Row: {
          id: string;
          code: string;
          sort_order: number;
          icon_storage_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          sort_order?: number;
          icon_storage_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          sort_order?: number;
          icon_storage_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      module_type_equipment: {
        Row: {
          module_type_id: string;
          equipment_kind_id: string;
          quantity: number | null;
          notes: string | null;
        };
        Insert: {
          module_type_id: string;
          equipment_kind_id: string;
          quantity?: number | null;
          notes?: string | null;
        };
        Update: {
          module_type_id?: string;
          equipment_kind_id?: string;
          quantity?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      damage_reports: {
        Row: {
          id: string;
          module_id: string;
          reported_by: string | null;
          reported_at: string;
          status: DamageReportStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          reported_by?: string | null;
          reported_at?: string;
          status?: DamageReportStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          reported_by?: string | null;
          reported_at?: string;
          status?: DamageReportStatus;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      damage_report_photos: {
        Row: {
          report_id: string;
          photo_id: string;
        };
        Insert: {
          report_id: string;
          photo_id: string;
        };
        Update: {
          report_id?: string;
          photo_id?: string;
        };
        Relationships: [];
      };
      air_conditioning_units: {
        Row: {
          id: string;
          module_id: string;
          brand: string;
          serial_number: string;
          internal_number: string;
          last_maintenance_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          brand: string;
          serial_number: string;
          internal_number: string;
          last_maintenance_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          brand?: string;
          serial_number?: string;
          internal_number?: string;
          last_maintenance_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      module_location_view: {
        Row: {
          module_id: string | null;
          module_number: string | null;
          status: ModuleStatus | null;
          rented_to_project: string | null;
          module_type_code: string | null;
          module_type_number: string | null;
          length_m: number | null;
          width_m: number | null;
          block_code: string | null;
          row_code: string | null;
          position_code: string | null;
          level: StackLevel | null;
          slot_id: string | null;
          located_at: string | null;
        };
        Relationships: [];
      };
      module_last_movement_view: {
        Row: {
          module_id: string | null;
          moved_at: string | null;
          moved_by: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: AppRole;
      };
      has_role: {
        Args: {roles: AppRole[]};
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      assign_first_free_stack_slot: {
        Args: {
          p_module_id: string;
          p_position_id: string;
          p_preferred_level?: StackLevel | null;
        };
        Returns: Json;
      };
      max_stack_levels_for_block: {
        Args: {p_code: string};
        Returns: number;
      };
    };
    Enums: {
      app_role: AppRole;
      stack_level: StackLevel;
      module_status: ModuleStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
