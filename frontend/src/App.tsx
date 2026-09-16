import { useEffect, useState } from 'react';
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
import { useDashboardData } from './hooks/useDashboardData';
import { getAllCameraHealth } from './services/cameraService';

function App() {
  const {
    loading, error, summary, cameras, incidents, systemHealth, refetch,
  } = useDashboardData();

  const [activePage, setActivePage] = useState('dashboard');
  const [autoQuickMobile, setAutoQuickMobile] = useState(false);

  // People-per-camera from real health data (not random)
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
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const activeCameras = cameras.filter(c => c.status === 'ONLINE').length;

  const renderPage = () => {
    switch (activePage) {
      case 'cameras':   return <CamerasPage autoQuickMobile={autoQuickMobile} onAutoQuickMobileDone={() => setAutoQuickMobile(false)} />;
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
                  onNavigateToCameras={() => { setActivePage('cameras'); setAutoQuickMobile(true); }}
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

export default App;
