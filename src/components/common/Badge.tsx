import React from 'react';
import { MembershipStatus, MemberStatus, AccessResult, DoorState, DeviceStatus } from '../../types';

interface BadgeProps {
  status: string;
  type?: 'membership' | 'member' | 'access' | 'door' | 'device' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, type = 'default', className = '' }) => {
  let colorClasses = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  if (type === 'membership') {
    switch (status as MembershipStatus) {
      case 'ACTIVE':
        colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        break;
      case 'EXPIRING_SOON':
        colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        break;
      case 'EXPIRED':
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        break;
      case 'FROZEN':
        colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
        break;
      case 'SUSPENDED':
        colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        break;
      case 'NOT_STARTED':
        colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        break;
      case 'CANCELLED':
        colorClasses = 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
        break;
    }
  } else if (type === 'member') {
    switch (status as MemberStatus) {
      case 'ACTIVE':
        colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        break;
      case 'INACTIVE':
        colorClasses = 'bg-zinc-700/40 text-zinc-400 border-zinc-600';
        break;
      case 'SUSPENDED':
        colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        break;
      case 'BLACKLISTED':
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        break;
    }
  } else if (type === 'access') {
    if (status === 'ACCESS_GRANTED') {
      colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else {
      colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  } else if (type === 'door') {
    switch (status as DoorState) {
      case 'UNLOCKED':
        colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse';
        break;
      case 'UNLOCKING':
        colorClasses = 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse';
        break;
      case 'LOCKED':
        colorClasses = 'bg-zinc-800 text-zinc-300 border-zinc-700';
        break;
      case 'ERROR':
      case 'OFFLINE':
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        break;
    }
  } else if (type === 'device') {
    switch (status as DeviceStatus) {
      case 'ONLINE':
        colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        break;
      case 'OFFLINE':
        colorClasses = 'bg-zinc-700/40 text-zinc-400 border-zinc-600';
        break;
      case 'ERROR':
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        break;
      case 'DISABLED':
        colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        break;
    }
  }

  const formatText = (txt: string) => {
    return txt.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses} ${className}`}
    >
      {formatText(status)}
    </span>
  );
};
