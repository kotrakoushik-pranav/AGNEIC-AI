import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Camera } from '../../types';
import { getCameraSnapshotUrl } from '../../services/cameraService';

interface Props {
  camera: Camera;
  peopleDetected?: number;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { color: string; pulse: boolean; label: string; textColor: string }> = {
    ONLINE:       { color: '#22C55E', pulse: true,  label: 'ONLINE',      textColor: '#16A34A' },
    WAITING:      { color: '#60A5FA', pulse: true,  label: 'WAITING',     textColor: '#2563EB' },
    CONNECTING:   { color: '#FACC15', pulse: true,  label: 'CONNECTING',  textColor: '#D97706' },
    RECONNECTING: { color: '#FACC15', pulse: true,  label: 'RECONNECTING',textColor: '#D97706' },
    ERROR:        { color: '#EF4444', pulse: false, label: 'ERROR',       textColor: '#DC2626' },
    OFFLINE:      { color: '#9CA3AF', pulse: false, label: 'OFFLINE',     textColor: '#6B7280' },
  };
  const c = cfg[status] ?? { color: '#9CA3AF', pulse: false, label: status, textColor: '#6B7280' };

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {c.pulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: c.color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: c.color }}
        />
      </span>
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: c.textColor }}>
        {c.label}
      </span>
    </div>
  );
}

function LiveSnapshot({ cameraId }: { cameraId: number }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseUrl = getCameraSnapshotUrl(cameraId);

  useEffect(() => {
    if (imgRef.current) imgRef.current.src = `${baseUrl}?t=${Date.now()}`;
    intervalRef.current = setInterval(() => {
      if (imgRef.current) imgRef.current.src = `${baseUrl}?t=${Date.now()}`;
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (imgRef.current) imgRef.current.src = '';
    };
  }, [baseUrl]);

  return (
    <img
      ref={imgRef}
      alt="Live camera feed"
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
      onLoad={(e)  => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
      style={{ opacity: 0, transition: 'opacity 0.1s' }}
    />
  );
}

export function CameraPanel({ camera, peopleDetected = 0 }: Props) {
  const [timestamp, setTimestamp] = useState(() => formatTimestamp(new Date()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTimestamp(formatTimestamp(new Date())), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const isOnline = camera.status === 'ONLINE';
  const isConnecting = ['CONNECTING', 'RECONNECTING', 'WAITING'].includes(camera.status);

  return (
    <div className="relative flex flex-col bg-white select-none overflow-hidden">
      {/* Viewport */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div
          className="absolute inset-0"
          style={{ background: isOnline ? '#0a0c10' : '#F9FAFB' }}
        >
          {isOnline ? (
            <>
              <LiveSnapshot cameraId={camera.id} />
              {/* Subtle scanlines */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(234,179,8,0.8) 2px, rgba(234,179,8,0.8) 3px)',
                }}
              />
              {/* Camera code */}
              <div className="absolute top-2 left-3 text-xs font-bold tracking-widest"
                style={{ color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {camera.camera_code}
              </div>
              {/* LIVE badge */}
              <div className="absolute top-2 right-3 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-[10px] font-bold tracking-widest text-green-400 uppercase"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  LIVE
                </span>
              </div>
              {/* Timestamp */}
              <div className="absolute bottom-2 left-3 text-[10px] font-mono tracking-wider"
                style={{ color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {timestamp}
              </div>
              {/* AI badge */}
              {camera.is_monitoring && (
                <div className="absolute bottom-2 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(234,179,8,0.18)', border: '1px solid rgba(234,179,8,0.45)' }}>
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#FACC15' }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#FACC15' }}>
                    AI ACTIVE
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <WifiOff size={24} style={{ color: '#D1D5DB' }} />
              <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                {camera.status === 'WAITING' ? 'Waiting…' : isConnecting ? 'Connecting…' : 'No Signal'}
              </span>
              {camera.status === 'ERROR' && (
                <span className="text-[9px] text-red-400 text-center px-2">Connection error</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white"
        style={{ borderTop: '1px solid rgba(234,179,8,0.3)' }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-semibold text-gray-800 leading-tight truncate">
            {camera.name}
          </span>
          <span className="text-[10px] text-gray-400 leading-tight truncate">{camera.location}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5 ml-2 flex-shrink-0">
          <StatusDot status={camera.status} />
          {isOnline && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500 tabular-nums">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: '#EAB308' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>{peopleDetected}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
