/**
 * IncidentsPage — white + golden-yellow theme.
 * Shows real persisted incidents only. No fake data.
 * Demo incidents are clearly labelled.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Video, RefreshCw, AlertCircle } from 'lucide-react';
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

type Filter = 'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<Filter>('ACTIVE');
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

  const filterBtnStyle = (f: Filter) => f === filter
    ? { background: 'rgba(234,179,8,0.12)', color: '#92400E', border: '1.5px solid #EAB308' }
    : { background: 'transparent', color: '#6B7280', border: '1px solid #E5E7EB' };

  return (
    <div className="p-6 flex flex-col gap-6" style={{ background: '#F9FAFB', color: '#1F2937' }}>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <AlertTriangle size={18} style={{ color: '#D97706' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Incidents</h1>
          <p className="text-xs text-gray-400">AI-detected security incidents</p>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 text-[11px] font-semibold rounded-lg transition-all duration-150"
              style={filterBtnStyle(f)}>
              {f}
            </button>
          ))}
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150"
            style={{ border: '1.5px solid rgba(234,179,8,0.4)', color: '#92400E', background: 'rgba(234,179,8,0.05)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.05)'; }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Backend error */}
      {backendError && (
        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
          style={{ background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626' }}>
          <AlertCircle size={14} />
          Backend unreachable — cannot load incidents.
        </div>
      )}

      {/* No camera notice */}
      {!loading && !backendError && connectedCameras === 0 && (
        <div className="flex items-start gap-3 text-sm rounded-xl px-4 py-3"
          style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Video size={16} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p className="font-semibold text-gray-700">No camera is currently connected.</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Live monitoring has not started. No new incidents are being generated.
              {historicalCount > 0 && ` Showing ${historicalCount} historical incident${historicalCount !== 1 ? 's' : ''} from previous sessions.`}
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl"
          style={{ background: '#FFFFFF', border: '1.5px solid rgba(234,179,8,0.3)' }}>
          <CheckCircle size={40} style={{ color: '#16A34A', opacity: 0.5 }} />
          <p className="text-gray-600 font-semibold">
            {filter === 'ACTIVE'
              ? connectedCameras > 0 ? 'No active incidents' : 'No active incidents — no camera connected'
              : `No ${filter.toLowerCase()} incidents`}
          </p>
          {filter === 'ACTIVE' && connectedCameras === 0 && (
            <p className="text-gray-400 text-xs text-center max-w-xs">
              Connect a camera to begin monitoring. Incidents are generated only from real camera detections.
            </p>
          )}
          {filter === 'ACTIVE' && connectedCameras > 0 && (
            <p className="text-gray-400 text-xs">
              {connectedCameras} camera{connectedCameras !== 1 ? 's' : ''} monitoring. No threats detected.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filter !== 'ACTIVE' && connectedCameras === 0 && incidents.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-gray-400 px-1">
              Historical — from previous sessions
            </div>
          )}
          {filtered.map(inc => (
            <div key={inc.id}
              className="bg-white rounded-xl px-4 py-3 flex items-center gap-4 transition-all duration-150"
              style={{ border: '1.5px solid rgba(234,179,8,0.25)', boxShadow: '0 1px 4px rgba(234,179,8,0.08)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800">{inc.incident_type}</span>
                  <SeverityBadge severity={inc.severity} />
                  {/* Status chip */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={inc.status === 'ACTIVE'
                      ? { background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }
                      : inc.status === 'ACKNOWLEDGED'
                      ? { background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.3)' }
                      : { background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)' }}>
                    {inc.status}
                  </span>
                  {/* Demo label */}
                  {inc.description?.startsWith('[DEMO]') && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: 'rgba(234,179,8,0.10)', color: '#92400E', border: '1px solid rgba(234,179,8,0.3)' }}>
                      DEMO DATA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                  <span>{inc.location}</span>
                  <span>·</span>
                  <span>{Math.round(inc.confidence * 100)}% confidence</span>
                  {inc.camera_id != null && (
                    <><span>·</span><span className="font-mono">CAM-{String(inc.camera_id).padStart(3, '0')}</span></>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {formatTime(inc.detected_at)}</span>
                </div>
                {inc.description && !inc.description.startsWith('[DEMO]') && (
                  <p className="text-[11px] text-gray-500 mt-1">{inc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inc.status === 'ACTIVE' && (
                  <button onClick={() => handleAck(inc.id)} disabled={busy === inc.id}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg disabled:opacity-40 transition-all duration-150"
                    style={{ border: '1.5px solid rgba(217,119,6,0.4)', color: '#D97706', background: 'rgba(217,119,6,0.05)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.05)'; }}>
                    Acknowledge
                  </button>
                )}
                {(inc.status === 'ACTIVE' || inc.status === 'ACKNOWLEDGED') && (
                  <button onClick={() => handleResolve(inc.id)} disabled={busy === inc.id}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg disabled:opacity-40 transition-all duration-150"
                    style={{ border: '1.5px solid rgba(22,163,74,0.4)', color: '#16A34A', background: 'rgba(22,163,74,0.05)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,163,74,0.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,163,74,0.05)'; }}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && !backendError && incidents.length > 0 && (
        <div className="text-[10px] text-gray-400 text-center">
          {activeCount > 0 && `${activeCount} active · `}
          {historicalCount > 0 && `${historicalCount} historical · `}
          {connectedCameras} camera{connectedCameras !== 1 ? 's' : ''} connected
        </div>
      )}
    </div>
  );
}
