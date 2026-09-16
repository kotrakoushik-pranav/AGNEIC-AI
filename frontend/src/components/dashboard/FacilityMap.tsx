import { Camera, Incident } from '../../types';
import { LiveMap } from './LiveMap';

interface Props {
  cameras?: Camera[];
  incidents?: Incident[];
}

export function FacilityMap({ cameras = [], incidents = [] }: Props) {
  const onlineCount = cameras.filter(c => c.status === 'ONLINE').length;

  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Facility Map
        </h3>
        <span className="text-[10px] text-gray-400">
          <span className="font-semibold" style={{ color: '#16A34A' }}>{onlineCount}</span>
          <span>/{cameras.length} online</span>
        </span>
      </div>
      <LiveMap cameras={cameras} incidents={incidents} />
    </div>
  );
}
