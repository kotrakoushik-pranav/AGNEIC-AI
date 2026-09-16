/**
 * database.types.ts — TypeScript types generated from the Supabase schema.
 * Kept manually in sync with supabase/migrations/001_initial_schema.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: string;
          updated_at?: string;
        };
      };

      cameras: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          name: string;
          location: string | null;
          pairing_token: string | null;
          token_expires_at: string | null;
          connection_status: string;
          last_seen: string | null;
          ip_address: string | null;
          stream_url: string | null;
          is_monitoring: boolean;
          adapter_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          name: string;
          location?: string | null;
          pairing_token?: string | null;
          token_expires_at?: string | null;
          connection_status?: string;
          last_seen?: string | null;
          ip_address?: string | null;
          stream_url?: string | null;
          is_monitoring?: boolean;
          adapter_type?: string | null;
        };
        Update: {
          name?: string;
          location?: string | null;
          connection_status?: string;
          last_seen?: string | null;
          ip_address?: string | null;
          stream_url?: string | null;
          is_monitoring?: boolean;
          pairing_token?: string | null;
          token_expires_at?: string | null;
          adapter_type?: string | null;
          updated_at?: string;
        };
      };

      camera_sessions: {
        Row: {
          id: string;
          camera_id: string;
          connected_at: string;
          disconnected_at: string | null;
          status: string;
          error_message: string | null;
          device_name: string | null;
          device_ip: string | null;
          frames_received: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          camera_id: string;
          connected_at?: string;
          disconnected_at?: string | null;
          status?: string;
          error_message?: string | null;
          device_name?: string | null;
          device_ip?: string | null;
          frames_received?: number;
        };
        Update: {
          disconnected_at?: string | null;
          status?: string;
          error_message?: string | null;
          frames_received?: number;
        };
      };

      persons: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          reference_id: string | null;
          active: boolean;
          face_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          reference_id?: string | null;
          active?: boolean;
          face_count?: number;
        };
        Update: {
          name?: string;
          reference_id?: string | null;
          active?: boolean;
          face_count?: number;
          updated_at?: string;
        };
      };

      detections: {
        Row: {
          id: string;
          user_id: string;
          camera_id: string | null;
          person_id: string | null;
          detection_type: string;
          confidence: number;
          bounding_box: Json | null;
          latitude: number | null;
          longitude: number | null;
          metadata: Json | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          camera_id?: string | null;
          person_id?: string | null;
          detection_type: string;
          confidence: number;
          bounding_box?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          metadata?: Json | null;
          timestamp?: string;
        };
        Update: {
          confidence?: number;
          metadata?: Json | null;
        };
      };

      incidents: {
        Row: {
          id: string;
          user_id: string;
          camera_id: string | null;
          type: string;
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
          title: string;
          description: string | null;
          status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
          latitude: number | null;
          longitude: number | null;
          detected_at: string;
          acknowledged_at: string | null;
          resolved_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          camera_id?: string | null;
          type: string;
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
          title: string;
          description?: string | null;
          status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
          latitude?: number | null;
          longitude?: number | null;
          detected_at?: string;
          metadata?: Json | null;
        };
        Update: {
          status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          description?: string | null;
          updated_at?: string;
        };
      };

      alerts: {
        Row: {
          id: string;
          user_id: string;
          camera_id: string | null;
          incident_id: string | null;
          type: string;
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
          message: string;
          acknowledged: boolean;
          created_at: string;
          acknowledged_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          camera_id?: string | null;
          incident_id?: string | null;
          type: string;
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
          message: string;
          acknowledged?: boolean;
        };
        Update: {
          acknowledged?: boolean;
          acknowledged_at?: string | null;
        };
      };

      gps_locations: {
        Row: {
          id: string;
          user_id: string;
          camera_id: string | null;
          latitude: number;
          longitude: number;
          accuracy: number | null;
          altitude: number | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          camera_id?: string | null;
          latitude: number;
          longitude: number;
          accuracy?: number | null;
          altitude?: number | null;
          timestamp?: string;
        };
        Update: {
          accuracy?: number | null;
          altitude?: number | null;
        };
      };
    };

    Views: {
      dashboard_stats: {
        Row: {
          user_id: string;
          total_cameras: number;
          connected_cameras: number;
          open_incidents: number;
          critical_incidents: number;
          unacknowledged_alerts: number;
          registered_persons: number;
          detections_today: number;
          gps_records: number;
        };
      };
    };

    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
