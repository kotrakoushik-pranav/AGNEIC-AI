const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  ACTIVE: {
    label: 'RESPONSE REQUIRED',
    bg: 'rgba(220,38,38,0.08)',
    color: '#DC2626',
    border: 'rgba(220,38,38,0.30)',
  },
  ACKNOWLEDGED: {
    label: 'UNDER REVIEW',
    bg: 'rgba(217,119,6,0.10)',
    color: '#D97706',
    border: 'rgba(217,119,6,0.35)',
  },
  RESOLVED: {
    label: 'MONITORING',
    bg: 'rgba(234,179,8,0.10)',
    color: '#92400E',
    border: 'rgba(234,179,8,0.40)',
  },
};

interface Props {
  status: string;
}

export function StatusChip({ status }: Props) {
  const c = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'rgba(107,114,128,0.08)',
    color: '#6B7280',
    border: 'rgba(107,114,128,0.25)',
  };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider"
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
