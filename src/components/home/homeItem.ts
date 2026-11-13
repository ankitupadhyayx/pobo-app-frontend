import type { HomeItem } from '@/api/types';
import type { ActionTone } from './ActionCard';

/** Visual mapping for a ranked Home item. Ranking itself is server-side (`priority`). */
export function homeItemTone(item: HomeItem): ActionTone {
  switch (item.kind) {
    case 'SLA_FIRST_CONTACT':
      return item.sla_state === 'BREACHED' ? 'breach' : item.sla_state === 'TARGET_MISSED' || item.is_overdue ? 'overdue' : 'new';
    case 'FOLLOW_UP_OVERDUE':
      return 'overdue';
    case 'NEW_ASSIGNMENT':
      return 'new';
    case 'FOLLOW_UP_DUE_TODAY':
      return 'due';
    case 'VISIT_TODAY':
      return 'visit';
    case 'TRANSFER_UPDATE':
      return 'transfer';
    case 'TENANT_EXPIRY':
    case 'LISTING_CORRECTION':
      return 'due';
    case 'KEY_COLLECT':
    case 'KEY_RETURN':
      // FB-08: "Owner wants the key back" is urgent and due now, so it reads as overdue.
      return item.is_overdue ? 'overdue' : 'due';
    case 'OPS_REMINDER':
      return 'transfer';
    default:
      return 'info';
  }
}

export const HOME_BADGE_KEY: Record<HomeItem['kind'], string> = {
  SLA_FIRST_CONTACT: 'home.kind.SLA_FIRST_CONTACT',
  NEW_ASSIGNMENT: 'home.kind.NEW_ASSIGNMENT',
  FOLLOW_UP_OVERDUE: 'home.kind.FOLLOW_UP_OVERDUE',
  FOLLOW_UP_DUE_TODAY: 'home.kind.FOLLOW_UP_DUE_TODAY',
  FLOAT_OPPORTUNITY: 'home.kind.FLOAT_OPPORTUNITY',
  TRANSFER_UPDATE: 'home.kind.TRANSFER_UPDATE',
  VISIT_TODAY: 'home.kind.VISIT_TODAY',
  TENANT_EXPIRY: 'home.kind.TENANT_EXPIRY',
  LISTING_CORRECTION: 'home.kind.LISTING_CORRECTION',
  SURVEY_INCOMPLETE: 'home.kind.SURVEY_INCOMPLETE',
  KEY_COLLECT: 'home.kind.KEY_COLLECT',
  KEY_RETURN: 'home.kind.KEY_RETURN',
  OPS_REMINDER: 'home.kind.OPS_REMINDER',
};
