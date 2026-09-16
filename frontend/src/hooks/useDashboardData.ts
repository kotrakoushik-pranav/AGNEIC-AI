/**
 * useDashboardData — fetches real data from the backend.
 *
 * - Polls every 15s for dashboard summary, cameras, incidents, system health.
 * - Subscribes to WebSocket for real-time camera_status, incident_created,
 *   alert_created, detection, camera_session_update, webrtc_signal events.
 * - NO mock data fallback in the real data path.
 * - On backend error: shows empty state (0s), not fake numbers.
 * - Unmount guard: state setters are no-ops after component unmounts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardSummary, Camera, Incident, SystemStatus, EMPTY_SUMMARY } from '../types';
import { getDashboardSummary, getSystemHealth } from '../services/systemService';
import { getCameras } from '../services/cameraService';
import { getIncidents } from '../services/incidentService';

const WS_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/ws';

export interface DashboardState {
  summary: DashboardSummary;
  cameras: Camera[];
  incidents: Incident[];
  systemHealth: SystemStatus[];
  loading: boolean;
  error: boolean;
  backendOnline: boolean;
  wsConnected: boolean;
  refetch: () => void;
}

export function useDashboardData(): DashboardState {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Track mount state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [sum, cams, incs, health] = await Promise.all([
        getDashboardSummary(),
        getCameras(),
        getIncidents(),
        getSystemHealth(),
      ]);
      // Guard: don't update state if unmounted
      if (!mountedRef.current) return;
      setSummary(sum);
      setCameras(cams);
      setIncidents(incs.filter(i => i.status === 'ACTIVE'));
      setSystemHealth(health);
      setLoading(false);
      setError(false);
      setBackendOnline(true);
    } catch {
      if (!mountedRef.current) return;
      setLoading(false);
      setError(true);
      setBackendOnline(false);
      // Reset all live data to zero — do NOT keep stale numbers on screen.
      // The dashboard must show 0 when the backend is unreachable.
      setSummary(EMPTY_SUMMARY);
      setCameras([]);
      setIncidents([]);
      setSystemHealth([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so the WS message handler always calls the latest fetchData
  // without needing to recreate the WebSocket connection.
  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  // ── WebSocket real-time updates ────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; data: unknown };

          if (msg.type === 'camera_status') {
            const d = msg.data as { camera_id: number; status: string; is_monitoring: boolean };
            setCameras(prev => prev.map(c =>
              c.id === d.camera_id
                ? { ...c, status: d.status, is_monitoring: d.is_monitoring ?? c.is_monitoring }
                : c
            ));
            // Refresh summary to update online count
            getDashboardSummary().then(s => {
              if (mountedRef.current) setSummary(s);
            }).catch(() => {});
          }

          if (msg.type === 'incident_created') {
            const inc = msg.data as Incident;
            setIncidents(prev => [inc, ...prev].slice(0, 100));
            setSummary(prev => ({
              ...prev,
              active_incident_count: prev.active_incident_count + 1,
              critical_count: inc.severity === 'CRITICAL'
                ? prev.critical_count + 1 : prev.critical_count,
            }));
          }

          if (msg.type === 'incident_updated') {
            const d = msg.data as { id: number; status: string };
            setIncidents(prev =>
              d.status !== 'ACTIVE'
                ? prev.filter(i => i.id !== d.id)
                : prev
            );
            getDashboardSummary().then(s => {
              if (mountedRef.current) setSummary(s);
            }).catch(() => {});
          }

          if (msg.type === 'detection') {
            setSummary(prev => ({
              ...prev,
              detections_today: prev.detections_today + 1,
            }));
          }

          if (msg.type === 'alert_created') {
            setSummary(prev => ({
              ...prev,
              alert_count: prev.alert_count + 1,
            }));
          }

          if (msg.type === 'camera_session_update') {
            const d = msg.data as {
              session_id: string;
              camera_id: number;
              status: 'WAITING' | 'CONNECTING' | 'ONLINE' | 'OFFLINE';
              device_ip?: string;
              device_name?: string;
              stream_type?: string;
            };
            // Immediately reflect the session status on the camera card
            setCameras(prev => prev.map(c =>
              c.id === d.camera_id ? { ...c, status: d.status } : c
            ));
            // On ONLINE or OFFLINE, do a full refetch to sync summary counts
            // (cameras_online_count, is_monitoring, etc.) from DB truth
            if (d.status === 'ONLINE' || d.status === 'OFFLINE') {
              fetchDataRef.current();
            }
          }

          if (msg.type === 'webrtc_signal') {
            // Dashboard uses frame-push mode — log only, no RTCPeerConnection needed
            const d = msg.data as { session_id?: string; type?: string };
            console.debug('[WS] webrtc_signal', d.session_id, d.type);
          }

        } catch { /* malformed message — ignore */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) setWsConnected(false);
        // Attempt reconnect after 5s only if still mounted
        setTimeout(() => {
          if (mountedRef.current) connectWs();
        }, 5000);
      };
      ws.onerror = () => { ws.close(); };
      ws.onopen = () => {
        if (mountedRef.current) setWsConnected(true);
      };

    } catch { /* WS unavailable */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
    connectWs();

    pollRef.current = setInterval(() => {
      if (mountedRef.current) fetchDataRef.current();
    }, 15_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchData, connectWs]);

  return {
    summary,
    cameras,
    incidents,
    systemHealth,
    loading,
    error,
    backendOnline,
    wsConnected,
    refetch: fetchData,
  };
}
