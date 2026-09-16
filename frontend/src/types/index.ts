// ── Camera ───────────────────────────────────────────────────────────────────

export type CameraAdapterType =
  | 'webrtc' | 'mobile' | 'rtsp' | 'usb' | 'drone'
  | 'ip_camera' | 'cctv' | 'laptop_webcam' | 'browser' | 'phone';

export interface Camera {
  id: number;
  camera_code: string;
  name: string;
  location: string;
  /** OFFLINE | CONNECTING | ONLINE | RECONNECTING | ERROR */
  status: string;
  stream_url: string | null;
  is_monitoring: boolean;
  source_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface CameraHealth {
  camera_id: number;
  status: string;
  error_reason: string | null;
  fps: number;
  resolution: string;
  last_frame_at: number | null;
  dropped_frames: number;
  reconnect_count: number;
  ai_processing: boolean;
  people_detected: number;
  faces_recognized: number;
  frame_count: number;
  worker_id: string | null;
  message?: string;  // set when not_running
}

// ── Incident ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: number;
  incident_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  camera_id: number | null;
  location: string;
  status: string;
  description: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface IncidentCreate {
  incident_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  location: string;
  description?: string;
  camera_id?: number;
  detected_at: string;
}

// ── Alert ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  incident_id: number;
  alert_type: string;
  recipient: string;
  severity: string;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
}

// ── System ───────────────────────────────────────────────────────────────────

export interface SystemStatus {
  id: number;
  service_name: string;
  status: string;
  last_updated: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  cameras_online_count: number;
  cameras_offline: number;
  total_cameras: number;
  monitoring_active: boolean;
  detections_today: number;
  active_incident_count: number;
  critical_count: number;
  warning_count: number;
  alert_count: number;
  average_ai_confidence: number;
  recent_incidents: Incident[];
  system_health: SystemStatus[];
}

// ── Empty / initial state ────────────────────────────────────────────────────

export const EMPTY_SUMMARY: DashboardSummary = {
  cameras_online_count: 0,
  cameras_offline: 0,
  total_cameras: 0,
  monitoring_active: false,
  detections_today: 0,
  active_incident_count: 0,
  critical_count: 0,
  warning_count: 0,
  alert_count: 0,
  average_ai_confidence: 0,
  recent_incidents: [],
  system_health: [],
};
