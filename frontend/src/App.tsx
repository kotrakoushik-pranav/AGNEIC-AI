import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { MainLayout } from './components/layout/MainLayout';
import { StatCards } from './components/dashboard/StatCards';
import { CameraGrid } from './components/dashboard/CameraGrid';
import { IncidentsPanel } from './components/dashboard/IncidentsPanel';
import { IncidentTimeline } from './components/dashboard/IncidentTimeline';
import { SystemHealthPanel } from './components/dashboard/SystemHealthPanel';
import { FacilityMap } from './components/dashboard/FacilityMap';
import { FaceRecognitionPage } from './components/recognition/FaceRecognitionPage';
import { CamerasPage } from './components/cameras/CamerasPage';
import { IncidentsPage } from './components/incidents/IncidentsPage';
import { AlertsPage } from './components/alerts/AlertsPage';
import { MapPage } from './components/map/MapPage';
import { AuthPage } from './components/auth/AuthPage';
import { useDashboardData } from './hooks/useDashboardData';
import { getAllCameraHealth } from './services/cameraService';
import { useAuth } from './contexts/AuthContext';

// ── Loading spinner (shown while session is being restored) ──
function AuthLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 40%, #FFFFFF 100%)' }}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)', boxShadow: '0 8px 24px rgba(234,179,8,0.35)' }}
      >
        <Shield size={28} className="text-white" />
      </div>
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid rgba(234,179,8,0.2)', borderTop: '3px solid #EAB308' }} />
      <p className="text-sm text-gray-500 tracking-widest uppercase">Loading Aegis AI…</p>
    </div>
  );
}

// ── Main dashboard (only rendered when authenticated) ────────
function Dashboard() {
  const {
    loading, error, summary, cameras, incidents, systemHealth, refetch,
  } = useDashboardData();

  const [activePage, setActivePage] = useState('dashboard');
  const [autoQuickMobile, setAutoQuickMobile] = useState(false);
  const [peopleByCamera, setPeopleByCamera] = useState<Record<number, number>>({});

  useEffect(() => {
    const poll = async () => {
      try {
        const health = await getAllCameraHealth();
        const map: Record<number, number> = {};
        Object.entries(health).forEach(([camId, h]) => {
          map[Number(camId)] = h.people_detected ?? 0;
        });
        setPeopleByCamera(map);
      } catch { /* ignore — backend may be starting */ }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const activeCameras = cameras.filter(c => c.status === 'ONLINE').length;

  const renderPage = () => {
    switch (activePage) {
      case 'cameras':
        return (
          <CamerasPage
            autoQuickMobile={autoQuickMobile}
            onAutoQuickMobileDone={() => setAutoQuickMobile(false)}
          />
        );
      case 'incidents': return <IncidentsPage />;
      case 'alerts':    return <AlertsPage />;
      case 'identity':  return <FaceRecognitionPage />;
      case 'map':       return <MapPage cameras={cameras} incidents={incidents} />;
      case 'dashboard':
      default:
        return (
          <div className="p-6 flex flex-col gap-6">
            <StatCards summary={summary} loading={loading} />
            <div className="flex gap-6">
              <div className="flex flex-col gap-6 flex-[2] min-w-0">
                <CameraGrid
                  cameras={cameras}
                  peopleByCamera={peopleByCamera}
                  onNavigateToCameras={() => {
                    setActivePage('cameras');
                    setAutoQuickMobile(true);
                  }}
                />
                <IncidentsPanel incidents={incidents} onIncidentUpdated={refetch} />
              </div>
              <div className="flex flex-col gap-6 flex-[1] min-w-0">
                <IncidentTimeline incidents={incidents} />
                <SystemHealthPanel systemHealth={systemHealth} />
                <FacilityMap cameras={cameras} incidents={incidents} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <MainLayout
      error={error}
      activeCameras={activeCameras}
      activeIncidents={summary.active_incident_count}
      criticalCount={summary.critical_count}
      incidents={incidents}
      activePage={activePage}
      onPageChange={setActivePage}
    >
      {renderPage()}
    </MainLayout>
  );
}

// ── Root app — guards dashboard behind auth ─────────────────
function App() {
  const { session, loading, supabaseConfigured } = useAuth();

  // While restoring session from storage, show spinner
  if (loading) return <AuthLoading />;

  // If Supabase is not configured OR user is not logged in → show auth page
  // Exception: if Supabase is NOT configured, allow dashboard access for
  // local development without credentials
  if (supabaseConfigured && !session) {
    return <AuthPage />;
  }

  return <Dashboard />;
}

export default App;
