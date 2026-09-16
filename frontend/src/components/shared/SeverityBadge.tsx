interface Props {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const SEVERITY_CONFIG: Record<
  Props['severity'],
  { label: string; bg: string; color: string; border: string }
> = {
  CRITICAL: {
    label: 'CRITICAL',
    bg: 'rgba(220,38,38,0.10)',
    color: '#DC2626',
    border: 'rgba(220,38,38,0.35)',
  },
  HIGH: {
    label: 'HIGH',
    bg: 'rgba(217,119,6,0.10)',
    color: '#D97706',
    border: 'rgba(217,119,6,0.40)',
  },
  MEDIUM: {
    label: 'MEDIUM',
    bg: 'rgba(234,179,8,0.12)',
    color: '#92400E',
    border: 'rgba(234,179,8,0.45)',
  },
  LOW: {
    label: 'LOW',
    bg: 'rgba(107,114,128,0.08)',
    color: '#6B7280',
    border: 'rgba(107,114,128,0.30)',
  },
};

export function SeverityBadge({ severity }: Props) {
  const c = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.LOW;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label}
    </span>
  );
}
