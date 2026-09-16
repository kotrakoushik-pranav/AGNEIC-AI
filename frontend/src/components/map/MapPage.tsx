/**
 * MapPage.tsx — Full-page GPS / Live Map view for Aegis AI.
 *
 * Shows:
 *  • Info panel: current location, camera count, incident count
 *  • Full-height interactive Leaflet map
 *  • Legend for camera and incident markers
 *  • "Demo mode" notice when real GPS is unavailable
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

  const onlineCameras  = cameras.filter((c) => c.status === 'ONLINE').length;
  const activeIncidents = incidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'ACKNOWLEDGED',
  ).length;
  const criticalCount = incidents.filter(
    (i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED',
  ).length;

  const isDemo = location.source !== 'gps';

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <MapPin size={20} className="text-accent" />
        <h1 className="text-lg font-bold tracking-widest uppercase text-text-primary">
          GPS / Live Map
        </h1>
        {isDemo && (
          <span className="ml-auto text-[11px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
            Demo Mode
          </span>
        )}
      </div>

      {/* ── Info row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

        {/* Current Location */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px] uppercase tracking-widest">
            <Navigation size={12} className="text-accent" />
            Current Location
          </div>
          <p className="text-text-primary font-semibold text-sm">{location.label}</p>
          <p className="text-muted text-[11px]">
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </p>
          <p className={`text-[10px] mt-0.5 ${isDemo ? 'text-yellow-400' : 'text-green-400'}`}>
            {isDemo ? '⚠ Demo coordinates' : '📍 Live GPS'}
          </p>
        </div>

        {/* Connected Cameras */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px] uppercase tracking-widest">
            <Camera size={12} className="text-accent" />
            Connected Cameras
          </div>
          <p className="text-text-primary font-semibold text-2xl">{onlineCameras}</p>
          <p className="text-muted text-[11px]">of {cameras.length} total</p>
        </div>

        {/* Active Incidents */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px] uppercase tracking-widest">
            <AlertTriangle size={12} className={criticalCount > 0 ? 'text-red-400' : 'text-accent'} />
            Active Incidents
          </div>
          <p className={`font-semibold text-2xl ${activeIncidents > 0 ? 'text-red-400' : 'text-text-primary'}`}>
            {activeIncidents}
          </p>
          {criticalCount > 0 && (
            <p className="text-[11px] text-red-400">{criticalCount} Critical</p>
          )}
        </div>

        {/* Coordinates */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px] uppercase tracking-widest">
            <Info size={12} className="text-accent" />
            Coordinates
          </div>
          <p className="text-text-primary font-semibold text-sm">
            {location.latitude.toFixed(4)}° N
          </p>
          <p className="text-text-primary font-semibold text-sm">
            {location.longitude.toFixed(4)}° E
          </p>
        </div>
      </div>

      {/* ── Map + legend ─────────────────────────────────────────────────── */}
      <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Interactive Map
          </h2>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            <LegendItem color="#3fb950" label="Online camera" shape="square" />
            <LegendItem color="#d29922" label="Connecting" shape="square" />
            <LegendItem color="#f85149" label="Offline / Error" shape="square" />
            <LegendItem color="#00c8ff" label="System location" shape="circle" />
            <LegendItem color="#f85149" label="Critical incident" shape="circle" />
            <LegendItem color="#d29922" label="Medium incident" shape="circle" />
          </div>
        </div>

        {/* Map */}
        <LiveMap
          cameras={cameras}
          incidents={incidents}
          height="500px"
          onLocationResolved={handleLocationResolved}
        />

        {/* Footer note */}
        <p className="text-[10px] text-muted text-center">
          Camera positions are approximate (demo offsets). Click any marker for details.
          {isDemo && ' · GPS permission denied — using demo coordinates.'}
        </p>
      </div>

      {/* ── Camera list ──────────────────────────────────────────────────── */}
      {cameras.length > 0 && (
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Mapped Cameras
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map((cam) => (
              <div
                key={cam.id}
                className="flex items-center gap-3 border border-border rounded p-2.5"
              >
                <span className="text-lg">📹</span>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium truncate">{cam.name}</p>
                  <p className="text-muted text-[11px] truncate">{cam.location || '—'}</p>
                </div>
                <StatusDot status={cam.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function LegendItem({
  color,
  label,
  shape,
}: {
  color: string;
  label: string;
  shape: 'circle' | 'square';
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          background: color,
          borderRadius: shape === 'circle' ? '50%' : '2px',
          opacity: 0.9,
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ONLINE'                       ? 'bg-green-500' :
    status === 'CONNECTING' || status === 'RECONNECTING' ? 'bg-yellow-500' :
    'bg-red-500';
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
      <span className="text-[9px] text-muted">{status}</span>
    </span>
  );
}
