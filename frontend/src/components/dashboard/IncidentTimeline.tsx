import { Incident } from '../../types';

interface Props {
  incidents: Incident[];
}

type TimelineColor = 'critical' | 'gold' | 'success' | 'warning';

function severityToColor(severity: string): TimelineColor {
  switch (severity) {
    case 'CRITICAL': return 'critical';
    case 'HIGH':     return 'critical';
    case 'MEDIUM':   return 'warning';
    default:         return 'gold';
  }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

const DOT_STYLES: Record<TimelineColor, { bg: string; shadow: string }> = {
  critical: { bg: '#DC2626', shadow: '0 0 8px 2px rgba(220,38,38,0.45)' },
  gold:     { bg: '#FACC15', shadow: '0 0 8px 2px rgba(250,204,21,0.55)' },
  success:  { bg: '#16A34A', shadow: '0 0 8px 2px rgba(22,163,74,0.45)' },
  warning:  { bg: '#D97706', shadow: '0 0 8px 2px rgba(217,119,6,0.50)' },
};

function TimelineDot({ color, isFirst }: { color: TimelineColor; isFirst: boolean }) {
  const s = DOT_STYLES[color];
  const size = isFirst ? 16 : 10;
  return (
    <span
      className="inline-block rounded-full flex-shrink-0 mt-0.5"
      style={{
        width: size,
        height: size,
        backgroundColor: s.bg,
        boxShadow: s.shadow,
        outline: isFirst ? `2px solid rgba(255,255,255,0.8)` : 'none',
        outlineOffset: 2,
      }}
    />
  );
}

export function IncidentTimeline({ incidents }: Props) {
  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Incident Timeline
        </h3>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Recent Events</span>
      </div>

      {incidents.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No active incidents</p>
      ) : (
        <div className="flex flex-col gap-0">
          {incidents.slice(0, 5).map((inc, index) => {
            const isFirst = index === 0;
            const isLast  = index === Math.min(incidents.length, 5) - 1;
            const color   = severityToColor(inc.severity);
            return (
              <div key={inc.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <TimelineDot color={color} isFirst={isFirst} />
                  {!isLast && (
                    <div
                      className="w-px flex-1 mt-1 mb-1 min-h-[20px]"
                      style={{ background: 'linear-gradient(180deg, rgba(234,179,8,0.35) 0%, rgba(234,179,8,0.10) 100%)' }}
                    />
                  )}
                </div>
                <div className={`flex flex-col ${isLast ? 'pb-0' : 'pb-4'}`}>
                  <span
                    className="text-xs font-semibold leading-tight"
                    style={{ color: isFirst ? '#1F2937' : '#4B5563' }}
                  >
                    {inc.incident_type}
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                    {inc.location} · {Math.round(inc.confidence * 100)}% confidence
                  </span>
                  <span className="text-[10px] mt-1 font-mono" style={{ color: '#9CA3AF' }}>
                    {formatTimestamp(inc.detected_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
