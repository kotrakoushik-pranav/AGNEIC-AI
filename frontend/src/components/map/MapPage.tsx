/**
 * MapPage.tsx — Full-page GPS / Live Map view for Aegis AI.
 * White + golden-yellow theme.
 */
import { MapPin, Camera, AlertTriangle, Navigation, Info } from 'lucide-react';
import { useState, useCallback } from 'react';
import { LiveMap } from '../dashboard/LiveMap';
import type { Camera as CameraType, Incident } from '../../types';
import type { SystemLocation } from '../../services/locationService';
import { DEMO_LOCATION } from '../../services/locationService';

interface Props {
  cameras: CameraType[];
  incidents: Incident[];
}

export function MapPage({ cameras, incidents }: Props) {
  const [location, setLocation] = useState<SystemLocation>(DEMO_LOCATION);

  const handleLocationResolved = useCallback((loc: SystemLocation) => {
    setLocation(loc);
  }, []);

  const onlineCameras   = cameras.filter(c => c.status === 'ONLINE').length;
  const activeIncidents = incidents.filter(i => i.status === 'ACTIVE' || i.status === 'ACKNOWLEDGED').length;
  const criticalCount   = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;
  const isDemo = location.source !== 'gps';

  return (
    <div className="p-6 flex flex-col gap-5" style={{ background: '#F9FAFB' }}>

      {/* Title */}
      <div className="flex items-center gap-3">
        <MapPin size={20} style={{ color: '#EAB308' }} />
        <h1 className="text-lg font-bold tracking-widest uppercase text-gray-800">GPS / Live Map</h1>
        {isDemo && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(234,179,8,0.10)', color: '#92400E', border: '1px solid rgba(234,179,8,0.35)' }}>
            Demo Mode
          </span>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Current Location */}
        <InfoCard icon={<Navigation size={12} style={{ color: '#EAB308' }} />} label="Current Location">
          <p className="text-gray-800 font-semibold text-sm">{location.label}</p>
          <p className="text-gray-400 text-[11px]">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
          <p className={`text-[10px] mt-0.5 font-semibold ${isDemo ? 'text-amber-600' : 'text-green-600'}`}>
            {isDemo ? '⚠ Demo coordinates' : '📍 Live GPS'}
          </p>
        </InfoCard>

        {/* Connected Cameras */}
        <InfoCard icon={<Camera size={12} style={{ color: '#EAB308' }} />} label="Connected Cameras">
          <p className="text-gray-800 font-bold text-2xl">{onlineCameras}</p>
          <p className="text-gray-400 text-[11px]">of {cameras.length} total</p>
        </InfoCard>

        {/* Active Incidents */}
        <InfoCard
          icon={<AlertTriangle size={12} style={{ color: criticalCount > 0 ? '#DC2626' : '#EAB308' }} />}
          label="Active Incidents"
        >
          <p className="font-bold text-2xl" style={{ color: activeIncidents > 0 ? '#DC2626' : '#1F2937' }}>
            {activeIncidents}
          </p>
          {criticalCount > 0 && <p className="text-[11px] font-semibold" style={{ color: '#DC2626' }}>{criticalCount} Critical</p>}
        </InfoCard>

        {/* Coordinates */}
        <InfoCard icon={<Info size={12} style={{ color: '#EAB308' }} />} label="Coordinates">
          <p className="text-gray-800 font-semibold text-sm">{location.latitude.toFixed(4)}° N</p>
          <p className="text-gray-800 font-semibold text-sm">{location.longitude.toFixed(4)}° E</p>
        </InfoCard>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
        style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Interactive Map</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <LegendItem color="#16A34A" label="Online camera"    shape="square" />
            <LegendItem color="#D97706" label="Connecting"       shape="square" />
            <LegendItem color="#DC2626" label="Offline / Error"  shape="square" />
            <LegendItem color="#EAB308" label="System location"  shape="circle" />
            <LegendItem color="#DC2626" label="Critical incident" shape="circle" />
            <LegendItem color="#D97706" label="Medium incident"   shape="circle" />
          </div>
        </div>

        <LiveMap cameras={cameras} incidents={incidents} height="500px" onLocationResolved={handleLocationResolved} />

        <p className="text-[10px] text-gray-400 text-center">
          Camera positions are approximate (demo offsets). Click any marker for details.
          {isDemo && ' · GPS permission denied — using demo coordinates.'}
        </p>
      </div>

      {/* Camera list */}
      {cameras.length > 0 && (
        <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
          style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Mapped Cameras</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map(cam => (
              <div key={cam.id}
                className="flex items-center gap-3 rounded-lg p-2.5"
                style={{ border: '1px solid rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.03)' }}>
                <span className="text-lg">📹</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 text-sm font-medium truncate">{cam.name}</p>
                  <p className="text-gray-400 text-[11px] truncate">{cam.location || '—'}</p>
                </div>
                <StatusDot status={cam.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {cameras.length === 0 && (
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3"
          style={{ border: '1.5px solid rgba(234,179,8,0.3)' }}>
          <Camera size={32} style={{ color: '#EAB308', opacity: 0.4 }} />
          <p className="text-gray-500 font-semibold text-sm">No cameras registered</p>
          <p className="text-gray-400 text-xs text-center max-w-xs">
            Register and connect a camera to see it on the map.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-1"
      style={{ border: '1.5px solid rgba(234,179,8,0.4)', boxShadow: '0 2px 8px rgba(234,179,8,0.08)' }}>
      <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase tracking-widest">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function LegendItem({ color, label, shape }: { color: string; label: string; shape: 'circle' | 'square' }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
      <span style={{ display: 'inline-block', width: 10, height: 10, background: color,
        borderRadius: shape === 'circle' ? '50%' : '2px', opacity: 0.9, flexShrink: 0 }} />
      {label}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'ONLINE' ? '#16A34A'
    : (status === 'CONNECTING' || status === 'RECONNECTING') ? '#D97706'
    : '#DC2626';
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'block' }} />
      <span className="text-[9px] text-gray-400">{status}</span>
    </span>
  );
}
