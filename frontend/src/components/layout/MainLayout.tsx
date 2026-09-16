import { NavSidebar } from './NavSidebar';
import { TopHeader } from './TopHeader';
import { ErrorBanner } from '../shared/ErrorBanner';
import { Incident } from '../../types';

interface Props {
  children: React.ReactNode;
  error: boolean;
  activeCameras?: number;
  activeIncidents?: number;
  criticalCount?: number;
  incidents?: Incident[];
  activePage?: string;
  onPageChange?: (page: string) => void;
}

export function MainLayout({
  children,
  error,
  activeCameras = 0,
  activeIncidents = 0,
  criticalCount = 0,
  incidents = [],
  activePage = 'dashboard',
  onPageChange,
}: Props) {
  return (
    <div className="min-h-screen" style={{ background: '#F9FAFB', color: '#1F2937' }}>
      <NavSidebar activeNav={activePage} onNavChange={onPageChange ?? (() => {})} />

      <div className="ml-56 flex flex-col min-h-screen">
        <TopHeader
          activeCameras={activeCameras}
          activeIncidents={activeIncidents}
          criticalCount={criticalCount}
          incidents={incidents}
        />
        <ErrorBanner visible={error} />
        <main className="flex-1 pt-14 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
