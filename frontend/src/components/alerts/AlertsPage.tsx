import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle, Clock, Video } from 'lucide-react';
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
    <div className="p-6 flex flex-col gap-6 text-[#e6edf3]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-900/20 flex items-center justify-center">
          <Bell size={18} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Alerts</h1>
          <p className="text-xs text-[#8b949e]">Security alerts from AI detections</p>
        </div>
        {activeCount > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-red-900/30 border border-red-700/50 text-red-400 text-xs font-bold">
            {activeCount} active
          </span>
        )}
        <button onClick={loadData}
          className="ml-auto px-3 py-1 text-[11px] font-semibold rounded-full border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* Backend error */}
      {backendError && (
        <div className="flex items-center gap-2 text-sm bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-4 py-3">
          <Bell size={14} />
          Backend unreachable — cannot load alerts.
        </div>
      )}

      {/* No camera connected notice */}
      {!loading && !backendError && connectedCameras === 0 && (
        <div className="flex items-start gap-3 text-sm bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3">
          <Video size={16} className="text-[#8b949e] mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-[#8b949e]">No camera is connected. Monitoring has not started.</p>
            <p className="text-xs text-[#484f58] mt-0.5">
              No new alerts are being generated. Alerts are only created from real detection events.
              {alerts.length > 0 && ` Showing ${alerts.length} historical alert${alerts.length !== 1 ? 's' : ''} from previous sessions.`}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-xs text-[#484f58] text-center py-12">Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={40} className="text-green-400 opacity-40" />
          <p className="text-[#8b949e] font-semibold">No alerts</p>
          <p className="text-[#484f58] text-xs text-center max-w-xs">
            {connectedCameras === 0
              ? 'No camera is connected. Connect a camera to begin monitoring.'
              : 'Alerts are generated automatically from AI detections.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {connectedCameras === 0 && alerts.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-[#484f58] px-1">
              Historical — from previous sessions
            </div>
          )}
          {alerts.map(alert => (
            <div key={alert.id}
              className="bg-[#0d1117] border border-[#21262d] rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[#e6edf3]">{alert.alert_type}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    alert.severity === 'CRITICAL' ? 'bg-red-900/20 text-red-400 border-red-700/40' :
                    alert.severity === 'HIGH' ? 'bg-orange-900/20 text-orange-400 border-orange-700/40' :
                    alert.severity === 'MEDIUM' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-700/40' :
                    'bg-gray-900/20 text-gray-400 border-gray-700/40'
                  }`}>{alert.severity}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    alert.status === 'ACTIVE'
                      ? 'bg-red-900/20 text-red-400 border-red-700/40'
                      : 'bg-green-900/20 text-green-400 border-green-700/40'
                  }`}>{alert.status}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#484f58]">
                  <Clock size={10} />
                  <span>{formatTime(alert.created_at)}</span>
                  <span>· Incident #{alert.incident_id}</span>
                </div>
              </div>
              {alert.status === 'ACTIVE' && (
                <button onClick={() => handleAck(alert.id)} disabled={busy === alert.id}
                  className="px-3 py-1.5 text-[11px] font-semibold border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] rounded-lg disabled:opacity-40 transition-colors">
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
