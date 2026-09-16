import { Camera as CameraIcon } from 'lucide-react';
import { Camera } from '../../types';
import { CameraPanel } from './CameraPanel';

interface Props {
  cameras: Camera[];
  peopleByCamera?: Record<number, number>;
  onNavigateToCameras?: () => void;
}

export function CameraGrid({ cameras, peopleByCamera = {}, onNavigateToCameras }: Props) {
  if (cameras.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Live Camera Feed
        </h2>
        <div
          className="flex flex-col items-center justify-center gap-3 py-12 bg-white rounded-xl"
          style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
        >
          <CameraIcon size={32} style={{ color: '#EAB308', opacity: 0.4 }} />
          <div className="text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-500">No cameras connected</p>
            {onNavigateToCameras ? (
              <button
                onClick={onNavigateToCameras}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)',
                  color: '#1F2937',
                  boxShadow: '0 2px 8px rgba(234,179,8,0.30)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,179,8,0.45)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(234,179,8,0.30)';
                }}
              >
                📱 Connect Mobile Camera
              </button>
            ) : (
              <p className="text-xs text-gray-400">Navigate to Live Cameras to connect a device</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const panels = cameras.slice(0, 4);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Live Camera Feed
        <span className="ml-2 text-gray-400 normal-case font-normal">
          ({cameras.length} registered, {cameras.filter(c => c.status === 'ONLINE').length} online)
        </span>
      </h2>
      <div className={`grid gap-3 ${panels.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {panels.map((camera) => (
          <div
            key={camera.id}
            className="rounded-xl overflow-hidden transition-all duration-150"
            style={{
              border: '1.5px solid #EAB308',
              boxShadow: '0 2px 8px rgba(234,179,8,0.10)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(234,179,8,0.25)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#D97706';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(234,179,8,0.10)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#EAB308';
            }}
          >
            <CameraPanel
              camera={camera}
              peopleDetected={peopleByCamera[camera.id] ?? 0}
            />
          </div>
        ))}
      </div>
      {cameras.length > 0 && cameras.filter(c => c.status === 'ONLINE').length === 0 && onNavigateToCameras && (
        <div className="flex justify-center mt-2">
          <button
            onClick={onNavigateToCameras}
            className="text-xs font-semibold transition-colors duration-150"
            style={{ color: '#D97706' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none'; }}
          >
            Connect a camera →
          </button>
        </div>
      )}
    </div>
  );
}
