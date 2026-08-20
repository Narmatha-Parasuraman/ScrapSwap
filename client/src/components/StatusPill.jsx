export function StatusPill({ status }) {
  return <span className={`pill pill-${status}`}>{status.replace('_', ' ')}</span>;
}
