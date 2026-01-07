// Calendar Event types
export type CalendarEventType = 'meeting' | 'reminder' | 'task' | 'other';
export type CalendarEventStatus = 'scheduled' | 'completed' | 'cancelled';
export type AttendeeStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface CalendarEvent {
  id: string;
  company_id: string;
  title: string;
  description?: string;
  summary?: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  location?: string;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  color: string;
  contact_id?: string;
  conversation_id?: string;
  assigned_to?: string;
  created_by: string;
  google_event_id?: string;
  google_calendar_synced: boolean;
  reminder_minutes: number;
  recurrence_rule?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined data
  contact?: {
    id: string;
    name?: string;
    phone_number: string;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  attendees?: CalendarEventAttendee[];
}

export interface CalendarEventAttendee {
  id: string;
  event_id: string;
  profile_id?: string;
  contact_id?: string;
  email?: string;
  name?: string;
  status: AttendeeStatus;
  created_at: string;
}

export interface CalendarGoogleToken {
  id: string;
  company_id: string;
  google_email: string;
  connected_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventData {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  location?: string;
  event_type?: CalendarEventType;
  color?: string;
  contact_id?: string;
  conversation_id?: string;
  assigned_to?: string;
  reminder_minutes?: number;
  attendees?: Array<{
    profile_id?: string;
    contact_id?: string;
    email?: string;
    name?: string;
  }>;
}

export interface UpdateCalendarEventData {
  title?: string;
  description?: string;
  summary?: string;
  start_date?: string;
  end_date?: string;
  all_day?: boolean;
  location?: string;
  event_type?: CalendarEventType;
  status?: CalendarEventStatus;
  color?: string;
  contact_id?: string;
  conversation_id?: string;
  assigned_to?: string;
  reminder_minutes?: number;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';
