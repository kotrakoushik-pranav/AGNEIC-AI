import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Incident } from '../../types';
import { SeverityBadge } from '../shared/SeverityBadge';
import { StatusChip } from '../shared/StatusChip';
import { acknowledgeIncident, resolveIncident } from '../../services/incidentService';

interface Props {
  incidents: Incident[];
  onIncidentUpdated?: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export function IncidentsPanel({ incidents, onIncidentUpdated }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleAcknowledge(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setLoadingId(id);
    try { await acknowledgeIncident(id); onIncidentUpdated?.(); }
    catch { /* silent */ }
    finally { setLoadingId(null); }
  }

  async function handleResolve(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setLoadingId(id);
    try { await resolveIncident(id); onIncidentUpdated?.(); }
    catch { /* silent */ }
    finally { setLoadingId(null); }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Active Incidents
      </h2>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
      >
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
            <ShieldCheck size={32} style={{ color: '#EAB308', opacity: 0.5 }} />
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
              NO ACTIVE INCIDENTS — ALL MONITORED SYSTEMS NOMINAL
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'rgba(234,179,8,0.2)' }}>
            {incidents.map((incident) => {
              const isSelected = selectedId === incident.id;
              const isLoading = loadingId === incident.id;

              return (
                <li
                  key={incident.id}
                  onClick={() => setSelectedId((prev) => prev === incident.id ? null : incident.id)}
                  className="relative flex flex-col gap-3 px-4 py-3 cursor-pointer select-none transition-colors duration-150"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(90deg, rgba(234,179,8,0.07) 0%, rgba(250,204,21,0.03) 100%)'
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLLIElement).style.background = 'rgba(234,179,8,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLLIElement).style.background = 'transparent';
                  }}
                >
                  {/* Golden left border accent when selected */}
                  {isSelected && (
                    <span
                      className="absolute inset-y-0 left-0 w-0.5 rounded-full"
                      style={{ background: 'linear-gradient(180deg, #FACC15 0%, #D97706 100%)' }}
                    />
                  )}

                  {/* Row: title + badges */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {incident.incident_type}
                    </span>
                    <SeverityBadge severity={incident.severity} />
                    <StatusChip status={incident.status} />
                  </div>

                  {/* Row: meta */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>{incident.location}</span>
                    {incident.camera_id != null && (
                      <span className="font-mono">CAM-{String(incident.camera_id).padStart(2, '0')}</span>
                    )}
                    <span className="font-semibold" style={{ color: '#D97706' }}>
                      {Math.round(incident.confidence * 100)}% confidence
                    </span>
                    <span className="ml-auto tabular-nums text-gray-400">
                      {formatTimestamp(incident.detected_at)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  {isSelected && (
                    <div className="flex gap-2">
                      {incident.status === 'ACTIVE' && (
                        <button
                          disabled={isLoading}
                          onClick={(e) => handleAcknowledge(e, incident.id)}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: 'rgba(217,119,6,0.10)',
                            color: '#D97706',
                            border: '1px solid rgba(217,119,6,0.35)',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.18)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.10)';
                          }}
                        >
                          {isLoading ? 'Working…' : 'Acknowledge'}
                        </button>
                      )}
                      {(incident.status === 'ACTIVE' || incident.status === 'ACKNOWLEDGED') && (
                        <button
                          disabled={isLoading}
                          onClick={(e) => handleResolve(e, incident.id)}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: 'rgba(234,179,8,0.10)',
                            color: '#92400E',
                            border: '1px solid rgba(234,179,8,0.40)',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.20)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.10)';
                          }}
                        >
                          {isLoading ? 'Working…' : 'Resolve'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
