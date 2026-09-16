import apiClient from './api';
import { Camera, CameraHealth, CameraAdapterType } from '../types';

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getCameras(): Promise<Camera[]> {
  const { data } = await apiClient.get<Camera[]>('/api/cameras');
  return data;
}

export async function getCameraById(id: number): Promise<Camera> {
  const { data } = await apiClient.get<Camera>(`/api/cameras/${id}`);
  return data;
}

export interface CreateCameraPayload {
  name: string;
  location: string;
  source_index?: number;
}

export async function createCamera(payload: CreateCameraPayload): Promise<Camera> {
  const { data } = await apiClient.post<Camera>('/api/cameras', payload);
  return data;
}

export async function deleteCamera(id: number): Promise<void> {
  await apiClient.delete(`/api/cameras/${id}`);
}

// ── Connection control ───────────────────────────────────────────────────────

export interface ConnectPayload {
  adapter_type: CameraAdapterType | string;
  stream_url?: string;
  device_index?: number;
  enabled_detectors?: string[];
}

export async function connectCamera(id: number, payload: ConnectPayload): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/cameras/${id}/connect`, payload);
  return data;
}

export async function disconnectCamera(id: number): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/cameras/${id}/disconnect`);
  return data;
}

export async function reconnectCamera(id: number, payload: ConnectPayload): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/cameras/${id}/reconnect`, payload);
  return data;
}

export interface TestResult {
  success: boolean;
  message: string;
  camera_id: number;
}

export async function testCameraConnection(
  id: number,
  payload: { adapter_type: string; stream_url?: string; device_index?: number },
): Promise<TestResult> {
  const { data } = await apiClient.post<TestResult>(`/api/cameras/${id}/test`, payload);
  return data;
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function getCameraHealth(id: number): Promise<CameraHealth> {
  const { data } = await apiClient.get<CameraHealth>(`/api/cameras/${id}/health`);
  return data;
}

export async function getAllCameraHealth(): Promise<Record<string, CameraHealth>> {
  const { data } = await apiClient.get<Record<string, CameraHealth>>('/api/cameras/health/all');
  return data;
}

// ── Frame push ───────────────────────────────────────────────────────────────

export async function pushFrame(id: number, frameB64: string): Promise<void> {
  await apiClient.post(`/api/cameras/${id}/frame`, { frame: frameB64 });
}

// ── Snapshot (latest JPEG frame from worker) ─────────────────────────────────

/**
 * Returns the URL for the snapshot endpoint of a camera.
 * The caller is responsible for cache-busting (append ?t=Date.now()).
 */
export function getCameraSnapshotUrl(id: number): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000';
  return `${base}/api/cameras/${id}/snapshot`;
}
