/**
 * supabaseService.ts — Direct Supabase queries for persistent storage.
 *
 * These functions read/write data directly via the Supabase JS client,
 * enabling multi-device sync and persistent history that survives backend restarts.
 *
 * The local FastAPI backend handles real-time AI processing and camera management.
 * Supabase stores the permanent historical record.
 */
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Tables = Database['public']['Tables'];
type IncidentRow = Tables['incidents']['Row'];
type AlertRow = Tables['alerts']['Row'];
type CameraRow = Tables['cameras']['Row'];
type PersonRow = Tables['persons']['Row'];
type DetectionRow = Tables['detections']['Row'];
type GpsRow = Tables['gps_locations']['Row'];

// Helper: cast table name to any so the Supabase generic inference doesn't block updates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ── Incidents ─────────────────────────────────────────────────

export async function getSupabaseIncidents(
  userId: string,
  status?: string,
  limit = 100,
): Promise<IncidentRow[]> {
  let query = sb
    .from('incidents')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] getIncidents error:', error.message);
    return [];
  }
  return (data ?? []) as IncidentRow[];
}

export async function acknowledgeSupabaseIncident(incidentId: string): Promise<boolean> {
  const { error } = await sb
    .from('incidents')
    .update({ status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() })
    .eq('id', incidentId);
  return !error;
}

export async function resolveSupabaseIncident(incidentId: string): Promise<boolean> {
  const { error } = await sb
    .from('incidents')
    .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
    .eq('id', incidentId);
  return !error;
}

// ── Alerts ────────────────────────────────────────────────────

export async function getSupabaseAlerts(
  userId: string,
  acknowledged?: boolean,
  limit = 100,
): Promise<AlertRow[]> {
  let query = sb
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (acknowledged !== undefined) query = query.eq('acknowledged', acknowledged);

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] getAlerts error:', error.message);
    return [];
  }
  return (data ?? []) as AlertRow[];
}

export async function acknowledgeSupabaseAlert(alertId: string): Promise<boolean> {
  const { error } = await sb
    .from('alerts')
    .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);
  return !error;
}

// ── Cameras ───────────────────────────────────────────────────

export async function getSupabaseCameras(userId: string): Promise<CameraRow[]> {
  const { data, error } = await sb
    .from('cameras')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Supabase] getCameras error:', error.message);
    return [];
  }
  return (data ?? []) as CameraRow[];
}

export async function registerSupabaseCamera(
  userId: string,
  deviceId: string,
  name: string,
  location?: string,
): Promise<CameraRow | null> {
  const { data, error } = await sb
    .from('cameras')
    .insert({
      user_id: userId,
      device_id: deviceId,
      name,
      location: location ?? null,
      connection_status: 'OFFLINE',
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] registerCamera error:', error.message);
    return null;
  }
  return data as CameraRow;
}

export async function updateSupabaseCameraStatus(
  cameraId: string,
  status: string,
): Promise<boolean> {
  const payload: Record<string, string> = { connection_status: status };
  if (status === 'CONNECTED') payload.last_seen = new Date().toISOString();

  const { error } = await sb
    .from('cameras')
    .update(payload)
    .eq('id', cameraId);
  return !error;
}

// ── Persons ───────────────────────────────────────────────────

export async function getSupabasePersons(userId: string): Promise<PersonRow[]> {
  const { data, error } = await sb
    .from('persons')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Supabase] getPersons error:', error.message);
    return [];
  }
  return (data ?? []) as PersonRow[];
}

// ── Detections ────────────────────────────────────────────────

export async function getSupabaseDetections(
  userId: string,
  limit = 50,
): Promise<DetectionRow[]> {
  const { data, error } = await sb
    .from('detections')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] getDetections error:', error.message);
    return [];
  }
  return (data ?? []) as DetectionRow[];
}

export async function getDetectionsToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await sb
    .from('detections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('timestamp', today.toISOString());

  if (error) return 0;
  return count ?? 0;
}

// ── GPS Locations ─────────────────────────────────────────────

export async function getSupabaseGpsHistory(
  userId: string,
  limit = 100,
): Promise<GpsRow[]> {
  const { data, error } = await sb
    .from('gps_locations')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] getGps error:', error.message);
    return [];
  }
  return (data ?? []) as GpsRow[];
}

export async function insertGpsLocation(
  userId: string,
  latitude: number,
  longitude: number,
  accuracy?: number,
  cameraId?: string,
): Promise<boolean> {
  const { error } = await sb.from('gps_locations').insert({
    user_id: userId,
    camera_id: cameraId ?? null,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
  });
  return !error;
}

// ── Dashboard stats ───────────────────────────────────────────

export async function getSupabaseDashboardStats(userId: string) {
  const { data, error } = await sb
    .from('dashboard_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[Supabase] getDashboardStats error:', error.message);
    return null;
  }
  return data;
}
