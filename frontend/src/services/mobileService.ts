import apiClient from './api';

export interface ServerInfo {
  lan_ip: string;
  port: number;
  scheme: string;
  base_url: string;
  mobile_camera_url: string;
}

export interface NetworkInfo {
  lan_ip: string;
  port: number;
  scheme: string;
  base_url: string;
  /** Resolved mobile camera base URL using the LAN IP (not localhost). */
  mobile_camera_url: string;
}

export interface MobileSession {
  session_id: string;
  camera_id: number;
  camera_name: string;
  device_type: string;
  status: string;
  connect_url: string;
  qr_data: string;
  server_info: ServerInfo;
}

export interface SessionStatus {
  session_id: string;
  camera_id: number;
  camera_name: string;
  device_type: string;
  status: string;
  device_name: string | null;
  device_ip: string | null;
  frames_received: number;
  connection_error: string | null;
}

export interface CreateSessionPayload {
  camera_id: number;
  camera_name: string;
  device_type?: string;
}

// ── Network-info cache ────────────────────────────────────────────────────────

const NETWORK_INFO_TTL_MS = 60_000; // 60 seconds

let _networkInfoCache: NetworkInfo | null = null;
let _networkInfoCachedAt = 0;

/**
 * Fetches LAN IP, port, and protocol from `/api/network-info`.
 *
 * The result is cached for 60 seconds to avoid hammering the backend on every
 * QR render. The env var `VITE_API_LAN_URL` can override the auto-detected LAN
 * URL if the backend's detection returns an incorrect address (e.g. in VMs).
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  const now = Date.now();
  if (_networkInfoCache && now - _networkInfoCachedAt < NETWORK_INFO_TTL_MS) {
    return _networkInfoCache;
  }

  const { data } = await apiClient.get<NetworkInfo>('/api/network-info');
  _networkInfoCache = data;
  _networkInfoCachedAt = now;
  return data;
}

// ── Mobile / server-info ──────────────────────────────────────────────────────

export async function getServerInfo(): Promise<ServerInfo> {
  const { data } = await apiClient.get<ServerInfo>('/api/mobile/server-info');
  return data;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createMobileSession(payload: CreateSessionPayload): Promise<MobileSession> {
  const { data } = await apiClient.post<MobileSession>('/api/mobile/sessions', payload);
  return data;
}

export async function getMobileSession(sessionId: string): Promise<SessionStatus> {
  const { data } = await apiClient.get<SessionStatus>(`/api/mobile/sessions/${sessionId}`);
  return data;
}

export async function cancelMobileSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/mobile/sessions/${sessionId}`);
}

export async function listMobileSessions(): Promise<SessionStatus[]> {
  const { data } = await apiClient.get<SessionStatus[]>('/api/mobile/sessions');
  return data;
}

/**
 * Find the active session for a given camera ID, or null if none exists.
 * Uses the list endpoint and filters client-side (backend doesn't have a query param for this).
 */
export async function getSessionForCamera(cameraId: number): Promise<SessionStatus | null> {
  try {
    const sessions = await listMobileSessions();
    return sessions.find(s => s.camera_id === cameraId) ?? null;
  } catch {
    return null;
  }
}
