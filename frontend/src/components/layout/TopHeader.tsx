import { useRef, useEffect, useState } from 'react';
import { Bell, Camera, AlertOctagon, LogOut } from 'lucide-react';
import { Incident } from '../../types';
import { SeverityBadge } from '../shared/SeverityBadge';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  activeCameras: number;
  activeIncidents: number;
  criticalCount?: number;
  incidents?: Incident[];
  onBellClick?: () => void;
  bellOpen?: boolean;
}

function isUnacknowledgedAlert(incident: Incident): boolean {
  return (
    (incident.status === 'ACTIVE' || incident.status === 'ACKNOWLEDGED') &&
    (incident.severity === 'CRITICAL' || incident.severity === 'HIGH')
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TopHeader({
  activeCameras,
  activeIncidents,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  criticalCount: _criticalCount,
  incidents = [],
  onBellClick,
  bellOpen: bellOpenProp,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = bellOpenProp !== undefined;
  const dropdownOpen = isControlled ? bellOpenProp : internalOpen;
  const containerRef = useRef<HTMLDivElement>(null);
  const { profile, signOut, supabaseConfigured, session } = useAuth();

  const userInitials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (session?.user?.email?.[0]?.toUpperCase() ?? 'OP');
  const userName = profile?.display_name ?? session?.user?.email?.split('@')[0] ?? 'Operator';
  const userRole = profile?.role ?? 'operator';

  const alertIncidents = incidents.filter(isUnacknowledgedAlert);
  const alertCount = alertIncidents.length;

  function handleBellClick() {
    if (isControlled && onBellClick) onBellClick();
    else setInternalOpen((prev) => !prev);
  }

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isControlled && onBellClick) onBellClick();
        else setInternalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, isControlled, onBellClick]);

  return (
    <header
      className="fixed top-0 left-56 right-0 z-20 flex h-14 items-center gap-4 bg-white px-5"
      style={{
        borderBottom: '2px solid #EAB308',
        boxShadow: '0 2px 12px rgba(234,179,8,0.12)',
      }}
    >
      {/* Left: title */}
      <span className="text-base font-bold text-gray-800 whitespace-nowrap tracking-wide">
        Emergency Command Center
      </span>

      {/* System status dot */}
      <div className="flex items-center gap-2 ml-3">
        <span
          className="block w-2.5 h-2.5 rounded-full flex-shrink-0 system-pulse"
          style={{ backgroundColor: '#16A34A' }}
        />
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#16A34A' }}>
          System Operational
        </span>
      </div>

      <div className="flex-1" />

      {/* Stat pills */}
      <div className="flex items-center gap-2">
        {/* Cameras pill */}
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider"
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1.5px solid rgba(234,179,8,0.4)',
            color: '#92400E',
          }}
        >
          <Camera size={12} style={{ color: '#EAB308' }} />
          {activeCameras} CAMERAS
        </span>

        {/* Incidents pill */}
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider transition-colors duration-150"
          style={
            activeIncidents > 0
              ? {
                  background: 'rgba(220,38,38,0.08)',
                  border: '1.5px solid rgba(220,38,38,0.45)',
                  color: '#DC2626',
                }
              : {
                  background: 'rgba(234,179,8,0.06)',
                  border: '1.5px solid rgba(234,179,8,0.3)',
                  color: '#78716C',
                }
          }
        >
          <AlertOctagon size={12} />
          {activeIncidents} INCIDENTS
        </span>
      </div>

      {/* Bell + avatar */}
      <div className="flex items-center gap-3 ml-1">
        <div ref={containerRef} className="relative">
          <button
            onClick={handleBellClick}
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className="relative p-1.5 rounded-lg transition-all duration-150 focus:outline-none"
            style={{
              color: alertCount > 0 ? '#D97706' : '#6B7280',
              background: dropdownOpen ? 'rgba(234,179,8,0.10)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.10)';
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen)
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <Bell size={18} />
            {alertCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white leading-none"
                style={{ background: '#DC2626' }}
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              role="dialog"
              aria-label="Active alerts"
              className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-30"
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #EAB308',
                boxShadow: '0 8px 32px rgba(234,179,8,0.20), 0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* Dropdown header */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  borderBottom: '1px solid rgba(234,179,8,0.3)',
                  background: 'linear-gradient(90deg, rgba(234,179,8,0.06) 0%, rgba(250,204,21,0.04) 100%)',
                }}
              >
                <span className="text-[11px] font-bold tracking-widest uppercase text-gray-500">
                  Active Alerts
                </span>
                {alertCount > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: '#DC2626' }}
                  >
                    {alertCount}
                  </span>
                )}
              </div>

              {alertCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
                  <Bell size={22} className="text-gray-300" />
                  <span className="text-gray-400 text-xs text-center">No active alerts</span>
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'rgba(234,179,8,0.2)' }}>
                  {alertIncidents.map((incident) => (
                    <li
                      key={incident.id}
                      className="flex flex-col gap-1.5 px-4 py-3 transition-colors duration-150"
                      style={{ cursor: 'default' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLLIElement).style.background = 'rgba(234,179,8,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLLIElement).style.background = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-800 text-[12px] font-semibold truncate flex-1">
                          {incident.incident_type}
                        </span>
                        <SeverityBadge severity={incident.severity} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400 text-[11px] truncate">{incident.location}</span>
                        <span className="text-gray-400 text-[10px] whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(incident.detected_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)',
              color: '#1F2937',
              boxShadow: '0 0 0 2px rgba(234,179,8,0.3)',
            }}
          >
            {userInitials}
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-gray-800 text-[11px] font-semibold">{userName}</span>
            <span className="text-gray-400 text-[10px] capitalize">{userRole}</span>
          </div>
        </div>

        {/* Logout button (only when auth is active) */}
        {supabaseConfigured && (
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="p-1.5 rounded-lg transition-all duration-150 text-gray-400 hover:text-red-500"
            style={{ marginLeft: '4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
