interface Props {
  visible: boolean;
}

export function ErrorBanner({ visible }: Props) {
  if (!visible) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full px-4 py-2 text-center text-xs font-semibold tracking-wide"
      style={{
        background: 'rgba(220,38,38,0.07)',
        borderBottom: '2px solid #DC2626',
        color: '#DC2626',
      }}
    >
      ⚠ BACKEND CONNECTION LOST — Live monitoring unavailable. All counters show zero until connection is restored.
    </div>
  );
}
