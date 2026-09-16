import apiClient from './api';
import { SystemStatus, DashboardSummary } from '../types';

export async function getSystemHealth(): Promise<SystemStatus[]> {
  const { data } = await apiClient.get<SystemStatus[]>('/api/system-health');
  return data;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/api/dashboard/summary');
  return data;
}
