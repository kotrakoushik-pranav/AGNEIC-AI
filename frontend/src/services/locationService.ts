/**
 * locationService.ts — fetches the system location from the backend.
 * Falls back to DEMO_LOCATION silently if the API is unreachable.
 */
import apiClient from './api';

export interface SystemLocation {
  latitude: number;
  longitude: number;
  label: string;
  source: 'gps' | 'demo' | string;
}

/** Demo / fallback location used when GPS and backend are both unavailable. */
export const DEMO_LOCATION: SystemLocation = {
  latitude: 17.3850,
  longitude: 78.4867,
  label: 'Hyderabad',
  source: 'demo',
};

export async function getSystemLocation(): Promise<SystemLocation> {
  try {
    const { data } = await apiClient.get<SystemLocation>('/api/location');
    return data;
  } catch {
    // Backend unreachable — return demo coords, never throw
    return DEMO_LOCATION;
  }
}
