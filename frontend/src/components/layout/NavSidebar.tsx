import { useRef, useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  AlertTriangle,
  Bell,
  BarChart3,
  UserCheck,
  Activity,
  Settings,
  Shield,
  MapPin,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',          icon: <LayoutDashboard size={18} /> },
  { id: 'cameras',    label: 'Live Cameras',        icon: <Camera size={18} /> },
  { id: 'incidents',  label: 'Incidents',           icon: <AlertTriangle size={18} /> },
  { id: 'alerts',     label: 'Alerts',              icon: <Bell size={18} /> },
  { id: 'map',        label: 'GPS / Live Map',      icon: <MapPin size={18} /> },
  { id: 'analytics',  label: 'Analytics',           icon: <BarChart3 size={18} /> },
  { id: 'identity',   label: 'Authorized Identity', icon: <UserCheck size={18} /> },
  { id: 'health',     label: 'System Health',       icon: <Activity size={18} /> },
  { id: 'settings',   label: 'Settings',            icon: <Settings size={18} /> },
];

interface Props {
  activeNav: string;
  onNavChange: (nav: string) => void;
}

export function NavSidebar({ activeNav, onNavChange }: Props) {
  // Track which item is currently mid-pluck animation
  const [pluckingId, setPluckingId] = useState<string | null>(null);
  const pluckTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function handleNavClick(id: string) {
    onNavChange(id);

    // Trigger pluck animation — clear any existing timer for this item first
    if (pluckTimers.current[id]) clearTimeout(pluckTimers.current[id]);
    setPluckingId(id);
    pluckTimers.current[id] = setTimeout(() => {
      setPluckingId(null);
    }, 600); // matches animation duration
  }

  return (
    <aside
      className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col bg-white"
      style={{
        borderRight: '2px solid #EAB308',
        boxShadow: '2px 0 12px rgba(234,179,8,0.10)',
      }}
    >
      {/* ── Logo area ── */}
      <div
        className="flex flex-col items-start px-4 pt-5 pb-4"
        style={{ borderBottom: '1.5px solid rgba(234,179,8,0.35)' }}
      >
        <div className="flex items-center gap-2">
          <Shield size={20} className="flex-shrink-0" style={{ color: '#EAB308' }} />
          <span
            className="font-bold text-base tracking-widest leading-none"
            style={{ color: '#EAB308' }}
          >
            AEGIS AI
          </span>
        </div>
        <span className="mt-1 ml-7 text-[10px] tracking-widest uppercase leading-none text-gray-400 font-medium">
          Intelligent Response
        </span>

        {/* System Online badge */}
        <div className="mt-3 ml-7 flex items-center gap-1.5">
          <span
            className="block w-2 h-2 rounded-full flex-shrink-0 system-pulse"
            style={{ backgroundColor: '#16A34A', boxShadow: '0 0 0 0 rgba(22,163,74,0.4)' }}
          />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#16A34A' }}>
            System Online
          </span>
        </div>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          const isPlucking = pluckingId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm',
                'transition-all duration-150 relative overflow-hidden',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400',
                isActive
                  ? 'font-semibold'
                  : 'font-normal hover:bg-yellow-50',
                isPlucking ? 'nav-pluck' : '',
              ].join(' ')}
              style={
                isActive
                  ? {
                      borderLeft: '3px solid #EAB308',
                      color: '#1F2937',
                      background:
                        'linear-gradient(90deg, rgba(234,179,8,0.13) 0%, rgba(250,204,21,0.06) 100%)',
                      boxShadow: 'inset 0 0 0 0 rgba(250,204,21,0)',
                    }
                  : {
                      borderLeft: '3px solid transparent',
                      color: '#4B5563',
                    }
              }
            >
              {/* Shimmer layer for active item */}
              {isActive && (
                <span
                  className="absolute inset-0 pointer-events-none nav-active-shimmer"
                  aria-hidden
                />
              )}

              {/* Gold glow burst on click */}
              {isPlucking && (
                <span
                  className="absolute inset-0 pointer-events-none rounded"
                  style={{
                    background:
                      'radial-gradient(ellipse at left center, rgba(250,204,21,0.28) 0%, transparent 70%)',
                    animation: 'goldGlowPulse 0.6s ease-out forwards',
                  }}
                  aria-hidden
                />
              )}

              <span
                className="relative z-10 transition-colors duration-150"
                style={{ color: isActive ? '#D97706' : '#6B7280' }}
              >
                {item.icon}
              </span>
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer line ── */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1.5px solid rgba(234,179,8,0.25)' }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)',
            color: '#1F2937',
          }}
        >
          OP
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-semibold text-gray-700">Operator</span>
          <span className="text-[10px] text-gray-400">Admin</span>
        </div>
      </div>
    </aside>
  );
}
