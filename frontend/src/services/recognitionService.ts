import apiClient from './api';

export interface Person {
  id: number;
  name: string;
  reference_id: string | null;
  face_count: number;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface RecognitionEvent {
  id: number;
  person_id: number | null;
  person_name: string;
  camera_id: number | null;
  camera_name: string | null;
  similarity: number | null;
  result_status: 'RECOGNIZED' | 'UNKNOWN' | 'VERIFYING';
  bounding_box: string | null;
  face_crop_b64: string | null;
  detected_at: string;
  created_at: string;
}

export interface RecognitionStatus {
  engine: {
    model_status: string;
    error: string | null;
    threshold: number;
    detection_confidence: number;
    yunet_model: string;
    sface_model: string;
  };
  model_ready: boolean;
  registered_persons: number;
  registered_embeddings: number;
  sessions: Record<string, {
    active: boolean;
    faces_detected: number;
    recognized: number;
    unknown: number;
    current_faces: FaceResult[];
  }>;
}

export interface FaceResult {
  bbox: { x: number; y: number; w: number; h: number };
  person_id: number | null;
  person_name: string;
  similarity: number | null;
  status: 'RECOGNIZED' | 'UNKNOWN' | 'VERIFYING';
  face_crop_b64: string | null;
}

export interface FrameResponse {
  active: boolean;
  faces: FaceResult[];
  faces_detected: number;
  recognized: number;
  unknown: number;
  error?: string;
}

// ── Engine & session ────────────────────────────────────────────────────────

export async function getRecognitionStatus(): Promise<RecognitionStatus> {
  const { data } = await apiClient.get<RecognitionStatus>('/api/recognition/status');
  return data;
}

export async function startRecognition(cameraId: number | null, cameraName: string): Promise<void> {
  await apiClient.post('/api/recognition/start', { camera_id: cameraId, camera_name: cameraName });
}

export async function stopRecognition(cameraId: number | null): Promise<void> {
  await apiClient.post('/api/recognition/stop', { camera_id: cameraId });
}

export async function submitFrame(
  cameraId: number | null,
  cameraName: string,
  frameB64: string,
): Promise<FrameResponse> {
  const { data } = await apiClient.post<FrameResponse>('/api/recognition/frame', {
    camera_id: cameraId,
    camera_name: cameraName,
    frame: frameB64,
  });
  return data;
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getRecognitionEvents(limit = 100): Promise<RecognitionEvent[]> {
  const { data } = await apiClient.get<RecognitionEvent[]>('/api/recognition/events', {
    params: { limit },
  });
  return data;
}

export async function countEventsToday(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/api/recognition/events/count-today');
  return data.count;
}

// ── Persons ─────────────────────────────────────────────────────────────────

export async function getPersons(): Promise<Person[]> {
  const { data } = await apiClient.get<Person[]>('/api/persons');
  return data;
}

export async function createPerson(name: string, referenceId?: string): Promise<Person> {
  const { data } = await apiClient.post<Person>('/api/persons', {
    name,
    reference_id: referenceId ?? null,
  });
  return data;
}

export async function deletePerson(id: number): Promise<void> {
  await apiClient.delete(`/api/persons/${id}`);
}

export async function addFaceToPerson(personId: number, imageB64: string): Promise<{
  success: boolean;
  error: string | null;
  embedding_id: number | null;
}> {
  const { data } = await apiClient.post(`/api/persons/${personId}/faces`, {
    image: imageB64,
  });
  return data;
}
