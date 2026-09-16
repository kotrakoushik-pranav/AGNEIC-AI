import { Activity, AlertTriangle, AlertCircle, Camera, Brain } from 'lucide-react';
import { DashboardSummary } from '../../types';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  summary: DashboardSummary;
  loading?: boolean;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor: string;
  subLabel?: string;
  topBorderColor?: string;
  iconColor?: string;
}

function StatCard({ label, value, icon, valueColor, subLabel, topBorderColor = '#EAB308', iconColor = '#EAB308' }: StatCardProps) {
  return (
    <div
      className="flex-1 min-w-0 bg-white rounded-xl px-5 py-4 flex flex-col gap-3 cursor-default select-none gold-card-top"
      style={{ borderTop: `3px solid ${topBorderColor}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </span>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span
          className="text-3xl font-bold leading-none tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        {subLabel && (
          <span className="text-xs text-gray-400 mb-0.5">{subLabel}</span>
        )}
      </div>
    </div>
  );
}

export function StatCards({ summary, loading = false }: Props) {
  if (loading) {
    return (
      <div className="flex gap-4 w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 bg-white rounded-xl px-5 py-4 flex items-center justify-center h-[100px]"
            style={{ border: '1.5px solid #EAB308', boxShadow: '0 2px 8px rgba(234,179,8,0.10)' }}
          >
            <LoadingSpinner size="sm" />
          </div>
        ))}
      </div>
    );
  }

  const criticalColor = summary.critical_count > 0 ? '#DC2626' : '#1F2937';
  const warningColor  = summary.warning_count  > 0 ? '#D97706' : '#1F2937';
  const confidencePct = Math.round(summary.average_ai_confidence * 100);

  return (
    <div className="flex gap-4 w-full">
      <StatCard
        label="Active Incidents"
        value={summary.active_incident_count}
        icon={<Activity size={16} />}
        valueColor="#1F2937"
        iconColor="#EAB308"
      />
      <StatCard
        label="Critical"
        value={summary.critical_count}
        icon={<AlertCircle size={16} />}
        valueColor={criticalColor}
        topBorderColor={summary.critical_count > 0 ? '#DC2626' : '#EAB308'}
        iconColor={summary.critical_count > 0 ? '#DC2626' : '#EAB308'}
      />
      <StatCard
        label="Warnings"
        value={summary.warning_count}
        icon={<AlertTriangle size={16} />}
        valueColor={warningColor}
        topBorderColor={summary.warning_count > 0 ? '#D97706' : '#EAB308'}
        iconColor={summary.warning_count > 0 ? '#D97706' : '#EAB308'}
      />
      <StatCard
        label="Cameras Online"
        value={summary.cameras_online_count}
        icon={<Camera size={16} />}
        valueColor="#1F2937"
        subLabel={`/ ${summary.total_cameras}`}
        iconColor="#EAB308"
      />
      <StatCard
        label="AI Confidence"
        value={`${confidencePct}%`}
        icon={<Brain size={16} />}
        valueColor="#D97706"
        iconColor="#D97706"
        topBorderColor="#D97706"
      />
    </div>
  );
}
