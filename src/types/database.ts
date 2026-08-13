export type Json =
  | string
  | number
  | boolean
  | null
  | {[key: string]: Json | undefined}
  | Json[];

export type AppRole = "admin" | "manager" | "operator" | "viewer";

export type ModuleStatus =
  | "available"
  | "reserved"
  | "on_site"
  | "maintenance"
  | "retired";

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
      yard_locations: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          serial_number: string;
          name: string | null;
          status: ModuleStatus;
          yard_location_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          serial_number: string;
          name?: string | null;
          status?: ModuleStatus;
          yard_location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          serial_number?: string;
          name?: string | null;
          status?: ModuleStatus;
          yard_location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modules_yard_location_id_fkey";
            columns: ["yard_location_id"];
            isOneToOne: false;
            referencedRelation: "yard_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      movements: {
        Row: {
          id: string;
          module_id: string;
          from_location_id: string | null;
          to_location_id: string | null;
          moved_by: string | null;
          moved_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          from_location_id?: string | null;
          to_location_id?: string | null;
          moved_by?: string | null;
          moved_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          module_id?: string;
          from_location_id?: string | null;
          to_location_id?: string | null;
          moved_by?: string | null;
          moved_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movements_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
      module_photos: {
        Row: {
          id: string;
          module_id: string;
          storage_path: string;
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          storage_path: string;
          caption?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          storage_path?: string;
          caption?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "module_photos_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
      air_conditioning: {
        Row: {
          id: string;
          module_id: string;
          brand: string | null;
          model: string | null;
          refrigerant: string | null;
          last_service_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          brand?: string | null;
          model?: string | null;
          refrigerant?: string | null;
          last_service_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          brand?: string | null;
          model?: string | null;
          refrigerant?: string | null;
          last_service_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "air_conditioning_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: AppRole;
      module_status: ModuleStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
