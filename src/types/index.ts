// Company types
export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  settings: Record<string, unknown>;
  active: boolean;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

// User types
export type UserRole = 'owner' | 'admin' | 'supervisor' | 'agent' | 'viewer';

export interface User {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  departmentId?: string;
  maxConversations: number;
  active: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Department types
export interface Department {
  id: string;
  whatsappConnectionId: string;
  name: string;
  description?: string;
  color: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// WhatsApp Connection types
export type ConnectionStatus = 'connected' | 'disconnected' | 'qr_ready' | 'connecting';

export interface WhatsAppConnection {
  id: string;
  companyId: string;
  name: string;
  phoneNumber: string;
  sessionId: string;
  qrCode?: string;
  status: ConnectionStatus;
  webhookUrl?: string;
  settings: Record<string, unknown>;
  active: boolean;
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Contact types
export interface Contact {
  id: string;
  companyId: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  tags: string[];
  customFields: Record<string, unknown>;
  notes?: string;
  lastInteractionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Conversation types
export type ConversationStatus = 'open' | 'pending' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Conversation {
  id: string;
  companyId: string;
  contactId: string;
  contact?: Contact;
  whatsappConnectionId?: string;
  assignedUserId?: string;
  assignedUser?: User;
  departmentId?: string;
  department?: Department;
  status: ConversationStatus;
  priority: ConversationPriority;
  channel: string;
  tags: string[];
  unreadCount: number;
  lastMessageAt?: string;
  lastMessage?: Message;
  assignedAt?: string;
  closedAt?: string;
  metadata?: {
    markedAsUnread?: boolean;
    markedAsUnreadAt?: string;
    autoReopened?: boolean;
    reopenedAt?: string;
    reopenedByClient?: boolean;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

// Message types
export type MessageDirection = 'inbound' | 'outbound';
export type SenderType = 'user' | 'contact' | 'system' | 'bot';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'sticker';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Reaction types
export interface MessageReaction {
  id: string;
  messageId: string;
  companyId: string;
  reactorType: 'contact' | 'user';
  reactorId: string;
  emoji: string;
  whatsappMessageId?: string;
  reactorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string;
  messageType: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  status: MessageStatus;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  isInternalNote: boolean;
  quotedMessageId?: string;
  quotedMessage?: QuotedMessage;
  reactions?: MessageReaction[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedByType?: 'client' | 'agent';
  deletedBy?: string;
  deletedByName?: string;
  originalContent?: string;
  mentions?: string[]; // Array of user IDs who were mentioned
  mentionNames?: string[]; // Array of user names for display highlighting
  createdAt: string;
  updatedAt: string;
}

export interface QuotedMessage {
  id: string;
  content?: string;
  messageType: MessageType;
  senderType: SenderType;
  mediaUrl?: string;
  isDeleted?: boolean;
  createdAt: string;
}

// Tag types
export interface Tag {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string;
}

// Quick Reply types
export interface QuickReply {
  id: string;
  companyId: string;
  createdByUserId?: string;
  shortcut: string;
  title: string;
  message: string;
  isGlobal: boolean;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalConversations: number;
  openConversations: number;
  todayConversations: number;
  avgResponseTime: string;
  resolutionRate: number;
  pendingConversations: number;
  myConversations: number;
}

// Inbox column type
export type InboxColumn = 'minhas' | 'fila' | 'todas';

// Filters
export interface ConversationFilters {
  status?: string[]; // Array of statuses for multi-select (e.g., ['open', 'in_progress'])
  assignedUserId?: string | 'mine' | 'unassigned' | 'all' | 'others';
  filterByAgentId?: string; // Filter by specific agent (admin/owner only)
  departmentId?: string;
  tags?: string[];
  kanbanColumnId?: string; // Filter by Kanban funnel stage
  priority?: ConversationPriority;
  search?: string;
  inboxColumn?: InboxColumn;
  isFollowing?: boolean; // Filter by followed conversations (admin/owner only)
}
