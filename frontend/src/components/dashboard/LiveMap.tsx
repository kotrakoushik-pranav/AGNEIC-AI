/**
 * LiveMap.tsx — Leaflet-powered live map for the Aegis AI dashboard.
 *
 * • System location marker  (real GPS → backend demo → hardcoded fallback)
 * • Camera markers          (offset near centre, icon colour = connection status)
 * • Incident markers        (circle, colour = severity, live-updated via props)
 *
 * NEVER throws — every code path is wrapped so a map failure cannot crash the
 * dashboard. When Leaflet itself fails, a graceful fallback card is shown.
 */

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Camera, Incident } from '../../types';
import { getSystemLocation, DEMO_LOCATION, SystemLocation } from '../../services/locationService';

// ── Fix Leaflet default icon broken by Vite / webpack ────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Deterministic camera offset (spread within ~500 m radius) ─────────────────
function cameraOffset(id: number): { lat: number; lng: number } {
  const angle = (id * 137.5) % 360;          // golden-angle spread
  const radius = 0.002 + (id % 5) * 0.001;   // 0.002–0.006 °  ≈ 220–660 m
  return {
    lat: radius * Math.cos((angle * Math.PI) / 180),
    lng: radius * Math.sin((angle * Math.PI) / 180),
  };
}

// ── Camera icon (📹 emoji + coloured status dot) ──────────────────────────────
function makeCameraIcon(status: string): L.DivIcon {
  const dot =
    status === 'ONLINE'                      ? '#3fb950' :
    status === 'CONNECTING'                  ? '#d29922' :
    status === 'RECONNECTING'                ? '#d29922' :
    status === 'ERROR' || status === 'OFFLINE' ? '#f85149' :
    '#8b949e';

  return L.divIcon({
    className: '',
    html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));position:relative;">
      📹
      <span style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;
        border-radius:50%;background:${dot};border:1.5px solid #0d1117;"></span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// ── Incident severity → colour ─────────────────────────────────────────────────
function incidentColour(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#f85149';
    case 'HIGH':     return '#ff7b72';
    case 'MEDIUM':   return '#d29922';
    default:         return '#e3b341';
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface LiveMapProps {
  cameras: Camera[];
  incidents: Incident[];
  /** Extra CSS classes added to the outer wrapper div. */
  className?: string;
  /** Height of the Leaflet map div. Default: '280px'. */
  height?: string;
  /** Called when the active location is resolved (GPS / demo). */
  onLocationResolved?: (loc: SystemLocation) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LiveMap({
  cameras,
  incidents,
  className = '',
  height = '280px',
  onLocationResolved,
}: LiveMapProps) {
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<L.Map | null>(null);

  const cameraMarkersRef   = useRef<Map<number, L.Marker>>(new Map());
  const incidentMarkersRef = useRef<Map<number, L.CircleMarker>>(new Map());
  const systemMarkerRef    = useRef<L.CircleMarker | null>(null);

  // Centre used when placing camera / incident markers
  const centreRef = useRef<{ lat: number; lng: number }>({
    lat: DEMO_LOCATION.latitude,
    lng: DEMO_LOCATION.longitude,
  });

  const [gpsStatus, setGpsStatus] = useState<'pending' | 'gps' | 'demo'>('pending');
  const [mapError, setMapError]   = useState<string | null>(null);

  // ── Helper: place / replace the system location marker ───────────────────
  const addSystemMarker = useCallback(
    (map: L.Map, lat: number, lng: number, source: string) => {
      try {
        systemMarkerRef.current?.remove();
        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          color: '#00c8ff',
          fillColor: '#00c8ff',
          fillOpacity: 0.35,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(
            `<strong>System Location</strong><br/>` +
            `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}<br/>` +
            `Source: <em>${source}</em>`,
          );
        systemMarkerRef.current = marker;
      } catch { /* map destroyed */ }
    },
    [],
  );

  // ── Initialise Leaflet once ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return;

    let map: L.Map;
    try {
      map = L.map(mapDivRef.current, {
        center: [DEMO_LOCATION.latitude, DEMO_LOCATION.longitude],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    } catch (err) {
      setMapError(String(err));
      return;
    }

    // Step 1 — ask backend for the configured location
    getSystemLocation()
      .then((backendLoc) => {
        centreRef.current = { lat: backendLoc.latitude, lng: backendLoc.longitude };

        // Step 2 — try real browser GPS
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              try {
                const { latitude, longitude } = pos.coords;
                centreRef.current = { lat: latitude, lng: longitude };
                map.setView([latitude, longitude], 15);
                addSystemMarker(map, latitude, longitude, 'GPS');
                setGpsStatus('gps');
                onLocationResolved?.({
                  latitude,
                  longitude,
                  label: 'Current Location',
                  source: 'gps',
                });
              } catch { /* map destroyed */ }
            },
            () => {
              // GPS denied / unavailable — use backend location
              try {
                map.setView([backendLoc.latitude, backendLoc.longitude], 14);
                addSystemMarker(map, backendLoc.latitude, backendLoc.longitude, backendLoc.source);
                setGpsStatus('demo');
                onLocationResolved?.(backendLoc);
              } catch { /* map destroyed */ }
            },
            { timeout: 8000, enableHighAccuracy: false },
          );
        } else {
          // geolocation API not available
          map.setView([backendLoc.latitude, backendLoc.longitude], 14);
          addSystemMarker(map, backendLoc.latitude, backendLoc.longitude, backendLoc.source);
          setGpsStatus('demo');
          onLocationResolved?.(backendLoc);
        }
      })
      .catch(() => {
        // Both backend and GPS unavailable — hardcoded fallback
        addSystemMarker(map, DEMO_LOCATION.latitude, DEMO_LOCATION.longitude, 'demo');
        setGpsStatus('demo');
        onLocationResolved?.(DEMO_LOCATION);
      });

    return () => {
      try { map.remove(); } catch { /* ignore */ }
      mapRef.current = null;
      cameraMarkersRef.current.clear();
      incidentMarkersRef.current.clear();
      systemMarkerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync camera markers when cameras prop changes ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const centre = centreRef.current;
      const seen   = new Set<number>();

      cameras.forEach((cam) => {
        seen.add(cam.id);
        const off = cameraOffset(cam.id);
        const lat = centre.lat + off.lat;
        const lng = centre.lng + off.lng;

        const popup =
          `<strong>${cam.name}</strong><br/>` +
          `ID: CAM-${String(cam.id).padStart(3, '0')}<br/>` +
          `Status: <strong>${cam.status}</strong><br/>` +
          `Location: ${cam.location || '—'}`;

        if (cameraMarkersRef.current.has(cam.id)) {
          const m = cameraMarkersRef.current.get(cam.id)!;
          m.setIcon(makeCameraIcon(cam.status));
          m.setPopupContent(popup);
        } else {
          const m = L.marker([lat, lng], { icon: makeCameraIcon(cam.status) })
            .addTo(map)
            .bindPopup(popup);
          cameraMarkersRef.current.set(cam.id, m);
        }
      });

      // Remove stale camera markers
      cameraMarkersRef.current.forEach((m, id) => {
        if (!seen.has(id)) { m.remove(); cameraMarkersRef.current.delete(id); }
      });
    } catch { /* ignore */ }
  }, [cameras]);

  // ── Sync incident markers when incidents prop changes ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const centre = centreRef.current;
      const seen   = new Set<number>();

      incidents.forEach((inc) => {
        seen.add(inc.id);
        const angle  = (inc.id * 73) % 360;
        const radius = 0.003 + (inc.id % 4) * 0.001;
        const lat    = centre.lat + radius * Math.cos((angle * Math.PI) / 180);
        const lng    = centre.lng + radius * Math.sin((angle * Math.PI) / 180);
        const colour = incidentColour(inc.severity);
        const time   = inc.detected_at
          ? new Date(inc.detected_at).toLocaleTimeString()
          : '—';

        const popup =
          `<strong>${inc.incident_type}</strong><br/>` +
          `Severity: <strong style="color:${colour}">${inc.severity}</strong><br/>` +
          `Camera: ${inc.camera_id != null ? 'CAM-' + String(inc.camera_id).padStart(3, '0') : '—'}<br/>` +
          `Time: ${time}<br/>` +
          `Confidence: ${Math.round(inc.confidence * 100)}%`;

        if (incidentMarkersRef.current.has(inc.id)) {
          // Update popup in case status changed
          incidentMarkersRef.current.get(inc.id)!.setPopupContent(popup);
        } else {
          const m = L.circleMarker([lat, lng], {
            radius: 8,
            color: colour,
            fillColor: colour,
            fillOpacity: 0.6,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(popup);
          incidentMarkersRef.current.set(inc.id, m);
        }
      });

      // Remove resolved / gone incidents
      incidentMarkersRef.current.forEach((m, id) => {
        if (!seen.has(id)) { m.remove(); incidentMarkersRef.current.delete(id); }
      });
    } catch { /* ignore */ }
  }, [incidents]);

  // ── Leaflet init failed → graceful fallback ───────────────────────────────
  if (mapError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-panel text-text-secondary text-xs p-6 ${className}`}
        style={{ minHeight: '220px' }}
      >
        <span className="text-2xl">🗺️</span>
        <p className="text-center text-muted">
          Map unavailable. Location: {DEMO_LOCATION.label}<br />
          ({DEMO_LOCATION.latitude.toFixed(4)}, {DEMO_LOCATION.longitude.toFixed(4)})
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* GPS status notice */}
      {gpsStatus === 'demo' && (
        <div className="text-[10px] text-yellow-500 px-1 pb-1 text-center">
          GPS unavailable — showing demo location ({DEMO_LOCATION.label})
        </div>
      )}
      {gpsStatus === 'gps' && (
        <div className="text-[10px] text-green-400 px-1 pb-1 text-center">
          📍 Live GPS location active
        </div>
      )}

      {/* Map container — overflow hidden prevents scrollbar flash */}
      <div
        ref={mapDivRef}
        style={{ height, borderRadius: '8px', overflow: 'hidden' }}
      />
    </div>
  );
}
