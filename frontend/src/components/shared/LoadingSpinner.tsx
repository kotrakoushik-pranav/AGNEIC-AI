interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingSpinner({ size = 'md' }: Props) {
  return (
    <div
      className={`${sizeMap[size]} rounded-full animate-spin`}
      style={{
        border: '2px solid rgba(234,179,8,0.2)',
        borderTop: '2px solid #EAB308',
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
