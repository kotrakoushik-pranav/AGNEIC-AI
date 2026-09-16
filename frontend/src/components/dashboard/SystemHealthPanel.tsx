import { SystemStatus } from '../../types';

interface Props {
  systemHealth: SystemStatus[];
}

function StatusIndicator({ status }: { status: string }) {
  const isOnline = status === 'ONLINE';
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: isOnline ? '#16A34A' : '#D97706',
          boxShadow: isOnline
            ? '0 0 6px 2px rgba(22,163,74,0.45)'
            : '0 0 6px 2px rgba(217,119,6,0.45)',
        }}
      />
      <span
        className="text-[10px] font-mono font-semibold uppercase tracking-wide"
        style={{ color: isOnline ? '#16A34A' : '#D97706' }}
      >
        {status}
      </span>
    </div>
  );
}

export function SystemHealthPanel({ systemHealth }: Props) {
  if (systemHealth.length === 0) {
    return (
      <div
        className="bg-white rounded-xl p-4 flex flex-col gap-3"
        style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">System Health</h3>
        <p className="text-xs text-gray-400 text-center py-4">Connecting to backend…</p>
      </div>
    );
  }

  const onlineCount = systemHealth.filter((r) => r.status === 'ONLINE').length;
  const totalCount  = systemHealth.length;

  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">System Health</h3>
        <span className="text-[10px] text-gray-400">
          <span className="font-semibold" style={{ color: '#16A34A' }}>{onlineCount}</span>
          <span className="text-gray-400">/{totalCount} ONLINE</span>
        </span>
      </div>

      {/* Subsystem rows */}
      <div className="flex flex-col gap-2">
        {systemHealth.map((subsystem) => (
          <div
            key={subsystem.id}
            className="flex items-center justify-between py-1.5 px-3 rounded-lg transition-all duration-150"
            style={{
              background: 'rgba(234,179,8,0.04)',
              border: '1px solid rgba(234,179,8,0.20)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(234,179,8,0.09)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(234,179,8,0.40)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(234,179,8,0.04)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(234,179,8,0.20)';
            }}
          >
            <span className="text-xs text-gray-700 font-medium">{subsystem.service_name}</span>
            <StatusIndicator status={subsystem.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
