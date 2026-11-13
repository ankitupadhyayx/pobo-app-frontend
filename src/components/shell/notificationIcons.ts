import {
  AlarmClock,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Copy,
  IndianRupee,
  KeyRound,
  LifeBuoy,
  MessageSquareReply,
  Radio,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';

const BY_KIND: Record<string, LucideIcon> = {
  NEW_ASSIGNMENT: UserPlus,
  SLA_WARNING: AlarmClock,
  SLA_BREACH: AlertTriangle,
  ESCALATION: AlertTriangle,
  FLOAT_OFFER: Radio,
  FLOAT_RESULT: Radio,
  TRANSFER_UPDATE: ArrowLeftRight,
  FOLLOW_UP_DUE: AlarmClock,
  DUPLICATE_REVIEW: Copy,
  LEAVE_UPDATE: CalendarOff,
  OPS_QUEUE: ClipboardList,
  OPS_REMINDER: ClipboardList,
  SUPPORT_TICKET: LifeBuoy,
  EARNINGS_UPDATE: IndianRupee,
  KEY_TASK: KeyRound,
  VISIT_UPDATE: CalendarDays,
  CUSTOMER_RESPONSE: MessageSquareReply,
};

/** REQ-11: one icon per notification kind; a kind the app doesn't know yet gets the bell. */
export function notificationIcon(kind: string | undefined): LucideIcon {
  return (kind && BY_KIND[kind]) || Bell;
}
