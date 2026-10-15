import { useNavigate } from 'react-router-dom';

// Deep links open with no in-app history; going back must still land somewhere useful.
export function useGoBack() {
  const nav = useNavigate();
  return () => (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0 ? nav(-1) : nav('/'));
}
