/**
 * AlertsPage — white + golden-yellow theme.
 * Shows real persisted alerts only. No fake data.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle, Clock, Video, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert } from '../../types';
import apiClient from '../../services/api';
import { getCameras } from '../../services/cameraService';

async function getAlerts(): Promise<Alert[]> {
  const { data } = await apiClient.get<Alert[]>('/api/alerts');
  return data;
}

async function acknowledgeAlert(id: number): Promise<void> {
  await apiClient.patch(`/api/alerts/${id}/acknowledge`);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: 'rgba(220,38,38,0.08)',  color: '#DC2626', border: 'rgba(220,38,38,0.3)'  },
  HIGH:     { bg: 'rgba(217,119,6,0.08)',  color: '#D97706', border: 'rgba(217,119,6,0.35)' },
  MEDIUM:   { bg: 'rgba(234,179,8,0.10)',  color: '#92400E', border: 'rgba(234,179,8,0.4)'  },
  LOW:      { bg: 'rgba(107,114,128,0.08)',color: '#6B7280', border: 'rgba(107,114,128,0.3)'},
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [connectedCameras, setConnectedCameras] = useState(0);
  const [backendError, setBackendError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setBackendError(false);
    try {
      const [a, cams] = await Promise.all([getAlerts(), getCameras()]);
      setAlerts(a);
      setConnectedCameras(cams.filter(c => c.status === 'ONLINE').length);
    } catch {
      setBackendError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAck = async (id: number) => {
    setBusy(id);
    try {
      await acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch { /* ignore */ }
    setBusy(null);
  };

  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className="p-6 flex flex-col gap-6" style={{ background: '#F9FAFB', color: '#1F2937' }}>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <Bell size={18} style={{ color: '#DC2626' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Alerts</h1>
          <p className="text-xs text-gray-400">Security alerts from AI detections</p>
        </div>
        {activeCount > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(220,38,38,0.10)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}>
            {activeCount} active
          </span>
        )}
        <button
          onClick={loadData}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150"
          style={{ border: '1.5px solid rgba(234,179,8,0.4)', color: '#92400E', background: 'rgba(234,179,8,0.05)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.05)'; }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Backend error */}
      {backendError && (
        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
          style={{ background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626' }}>
          <AlertCircle size={14} />
          Backend unreachable — cannot load alerts.
        </div>
      )}

      {/* No camera notice */}
      {!loading && !backendError && connectedCameras === 0 && (
        <div className="flex items-start gap-3 text-sm rounded-xl px-4 py-3"
          style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Video size={16} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p className="font-semibold text-gray-700">No camera is connected. Monitoring has not started.</p>
            <p className="text-xs text-gray-400 mt-0.5">
              No new alerts are being generated. Alerts are only created from real detection events.
              {alerts.length > 0 && ` Showing ${alerts.length} historical alert${alerts.length !== 1 ? 's' : ''} from previous sessions.`}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full animate-spin"
            style={{ border: '2px solid rgba(234,179,8,0.2)', borderTop: '2px solid #EAB308' }} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl"
          style={{ background: '#FFFFFF', border: '1.5px solid rgba(234,179,8,0.3)' }}>
          <CheckCircle size={40} style={{ color: '#16A34A', opacity: 0.5 }} />
          <p className="text-gray-600 font-semibold">No alerts</p>
          <p className="text-gray-400 text-xs text-center max-w-xs">
            {connectedCameras === 0
              ? 'No camera is connected. Connect a camera to begin monitoring.'
              : 'Alerts are generated automatically from AI detections.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {connectedCameras === 0 && alerts.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-gray-400 px-1">
              Historical — from previous sessions
            </div>
          )}
          {alerts.map(alert => {
            const sev = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE['LOW'];
            return (
              <div key={alert.id}
                className="bg-white rounded-xl px-4 py-3 flex items-center gap-4"
                style={{ border: '1.5px solid rgba(234,179,8,0.25)', boxShadow: '0 1px 4px rgba(234,179,8,0.08)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">{alert.alert_type}</span>
                    {/* Severity badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                      {alert.severity}
                    </span>
                    {/* Status badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={alert.status === 'ACTIVE'
                        ? { background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }
                        : { background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)' }}>
                      {alert.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    <Clock size={10} />
                    <span>{formatTime(alert.created_at)}</span>
                    <span>· Incident #{alert.incident_id}</span>
                  </div>
                </div>
                {alert.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={busy === alert.id}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg disabled:opacity-40 transition-all duration-150"
                    style={{ border: '1.5px solid rgba(234,179,8,0.4)', color: '#92400E', background: 'rgba(234,179,8,0.05)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.05)'; }}
                  >
                    {busy === alert.id ? 'Working…' : 'Acknowledge'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
