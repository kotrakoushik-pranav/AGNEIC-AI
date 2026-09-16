import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Video } from 'lucide-react';
import { Incident } from '../../types';
import { getIncidents, acknowledgeIncident, resolveIncident } from '../../services/incidentService';
import { getCameras } from '../../services/cameraService';
import { SeverityBadge } from '../shared/SeverityBadge';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [connectedCameras, setConnectedCameras] = useState(0);
  const [backendError, setBackendError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setBackendError(false);
    try {
      const [all, cams] = await Promise.all([getIncidents(), getCameras()]);
      setIncidents(all);
      setConnectedCameras(cams.filter(c => c.status === 'ONLINE').length);
    } catch {
      setBackendError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filter === 'ALL' ? incidents : incidents.filter(i => i.status === filter);
  const activeCount = incidents.filter(i => i.status === 'ACTIVE').length;
  const historicalCount = incidents.filter(i => i.status !== 'ACTIVE').length;

  const handleAck = async (id: number) => {
    setBusy(id);
    try {
      await acknowledgeIncident(id);
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'ACKNOWLEDGED' } : i));
    } catch { /* ignore */ }
    setBusy(null);
  };

  const handleResolve = async (id: number) => {
    setBusy(id);
    try {
      await resolveIncident(id);
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'RESOLVED' } : i));
    } catch { /* ignore */ }
    setBusy(null);
  };

  return (
    <div className="p-6 flex flex-col gap-6 text-[#e6edf3]">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-orange-900/20 flex items-center justify-center">
          <AlertTriangle size={18} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Incidents</h1>
          <p className="text-xs text-[#8b949e]">AI-detected security incidents</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                filter === f
                  ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]'
                  : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
              }`}>
              {f}
            </button>
          ))}
          <button onClick={loadData}
            className="px-3 py-1 text-[11px] font-semibold rounded-full border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Backend error */}
      {backendError && (
        <div className="flex items-center gap-2 text-sm bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-4 py-3">
          <AlertTriangle size={14} />
          Backend unreachable — cannot load incidents.
        </div>
      )}

      {/* Camera state notice when no cameras connected */}
      {!loading && !backendError && connectedCameras === 0 && (
        <div className="flex items-start gap-3 text-sm bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3">
          <Video size={16} className="text-[#8b949e] mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-[#8b949e]">No camera is currently connected.</p>
            <p className="text-xs text-[#484f58] mt-0.5">
              Live monitoring has not started. No new incidents are being generated.
              {historicalCount > 0 && ` Showing ${historicalCount} historical incident${historicalCount !== 1 ? 's' : ''} from previous sessions.`}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-xs text-[#484f58] text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={40} className="text-green-400 opacity-40" />
          <p className="text-[#8b949e] font-semibold">
            {filter === 'ACTIVE'
              ? connectedCameras > 0
                ? 'No active incidents'
                : 'No active incidents — no camera connected'
              : `No ${filter.toLowerCase()} incidents`}
          </p>
          {filter === 'ACTIVE' && connectedCameras === 0 && (
            <p className="text-[#484f58] text-xs text-center max-w-xs">
              Connect a camera to begin monitoring. Incidents are generated only from real camera detections.
            </p>
          )}
          {filter === 'ACTIVE' && connectedCameras > 0 && (
            <p className="text-[#484f58] text-xs">
              {connectedCameras} camera{connectedCameras !== 1 ? 's' : ''} monitoring. No threats detected.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Section header for non-active incidents when no camera is connected */}
          {filter !== 'ACTIVE' && connectedCameras === 0 && incidents.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-[#484f58] px-1">
              Historical — from previous sessions
            </div>
          )}
          {filtered.map(inc => (
            <div key={inc.id}
              className="bg-[#0d1117] border border-[#21262d] rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[#e6edf3]">{inc.incident_type}</span>
                  <SeverityBadge severity={inc.severity} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inc.status === 'ACTIVE' ? 'bg-red-900/20 text-red-400 border border-red-700/40' :
                    inc.status === 'ACKNOWLEDGED' ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/40' :
                    'bg-green-900/20 text-green-400 border border-green-700/40'
                  }`}>{inc.status}</span>
                  {/* Mark demo incidents clearly */}
                  {inc.description?.startsWith('[DEMO]') && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#21262d] text-[#484f58] border border-[#30363d]">
                      DEMO DATA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-[#484f58]">
                  <span>{inc.location}</span>
                  <span>·</span>
                  <span>{Math.round(inc.confidence * 100)}% confidence</span>
                  {inc.camera_id != null && (
                    <>
                      <span>·</span>
                      <span className="font-mono">CAM-{String(inc.camera_id).padStart(3, '0')}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {formatTime(inc.detected_at)}
                  </span>
                </div>
                {inc.description && !inc.description.startsWith('[DEMO]') && (
                  <p className="text-[11px] text-[#8b949e] mt-1">{inc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inc.status === 'ACTIVE' && (
                  <button onClick={() => handleAck(inc.id)} disabled={busy === inc.id}
                    className="px-3 py-1.5 text-[11px] font-semibold border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 rounded-lg disabled:opacity-40 transition-colors">
                    Acknowledge
                  </button>
                )}
                {(inc.status === 'ACTIVE' || inc.status === 'ACKNOWLEDGED') && (
                  <button onClick={() => handleResolve(inc.id)} disabled={busy === inc.id}
                    className="px-3 py-1.5 text-[11px] font-semibold border border-green-700/50 text-green-400 hover:bg-green-900/20 rounded-lg disabled:opacity-40 transition-colors">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live/Historical summary */}
      {!loading && !backendError && incidents.length > 0 && (
        <div className="text-[10px] text-[#484f58] text-center">
          {activeCount > 0 && `${activeCount} active · `}
          {historicalCount > 0 && `${historicalCount} historical · `}
          {connectedCameras} camera{connectedCameras !== 1 ? 's' : ''} connected
        </div>
      )}
    </div>
  );
}
