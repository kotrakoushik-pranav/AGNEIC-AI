import apiClient from './api';
import { Incident, IncidentCreate } from '../types';

export async function getIncidents(): Promise<Incident[]> {
  const { data } = await apiClient.get<Incident[]>('/api/incidents');
  return data;
}

export async function getIncidentById(id: number): Promise<Incident> {
  const { data } = await apiClient.get<Incident>(`/api/incidents/${id}`);
  return data;
}

export async function createIncident(payload: IncidentCreate): Promise<Incident> {
  const { data } = await apiClient.post<Incident>('/api/incidents', payload);
  return data;
}

export async function acknowledgeIncident(id: number): Promise<Incident> {
  const { data } = await apiClient.patch<Incident>(`/api/incidents/${id}/acknowledge`);
  return data;
}

export async function resolveIncident(id: number): Promise<Incident> {
  const { data } = await apiClient.patch<Incident>(`/api/incidents/${id}/resolve`);
  return data;
}
