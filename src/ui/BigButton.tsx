import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export const BigButton = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <Link className="big-button" to={to} aria-label={label}><span aria-hidden="true">{icon}</span><span>{label}</span></Link>
);
