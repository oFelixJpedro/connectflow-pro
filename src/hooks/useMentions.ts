import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
}

interface MentionData {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

interface UseMentionsResult {
  showMentionPicker: boolean;
  mentionFilterText: string;
  mentionStartIndex: number;
  mentions: MentionData[];
  handleInputChange: (value: string, cursorPosition: number) => void;
  handleMentionSelect: (member: TeamMember, currentValue: string, cursorPosition: number) => { newValue: string; newCursorPosition: number };
  closeMentionPicker: () => void;
  extractMentionIds: () => string[];
  resetMentions: () => void;
}

export function useMentions(): UseMentionsResult {
  const { profile } = useAuth();
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilterText, setMentionFilterText] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentions, setMentions] = useState<MentionData[]>([]);

  // Detect @ in input and extract filter text
  const handleInputChange = useCallback((value: string, cursorPosition: number) => {
    // Look for @ before cursor
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if @ is at start or after a space (not in the middle of a word)
      const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
      if (lastAtIndex === 0 || charBeforeAt === ' ' || charBeforeAt === '\n') {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        
        // Check if there's no space after the @ (still typing the mention)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setShowMentionPicker(true);
          setMentionFilterText(textAfterAt);
          setMentionStartIndex(lastAtIndex);
          return;
        }
      }
    }
    
    // Close picker if no valid @ context
    setShowMentionPicker(false);
    setMentionFilterText('');
    setMentionStartIndex(-1);
  }, []);

  // Handle selection of a member from the picker
  const handleMentionSelect = useCallback((
    member: TeamMember,
    currentValue: string,
    cursorPosition: number
  ): { newValue: string; newCursorPosition: number } => {
    if (mentionStartIndex === -1) {
      return { newValue: currentValue, newCursorPosition: cursorPosition };
    }

    // Replace @ and filter text with @Name
    const beforeMention = currentValue.slice(0, mentionStartIndex);
    const afterCursor = currentValue.slice(cursorPosition);
    const mentionText = `@${member.fullName}`;
    const newValue = `${beforeMention}${mentionText} ${afterCursor}`;
    const newCursorPosition = beforeMention.length + mentionText.length + 1;

    // Track this mention
    const newMention: MentionData = {
      userId: member.id,
      displayName: member.fullName,
      startIndex: mentionStartIndex,
      endIndex: mentionStartIndex + mentionText.length,
    };

    setMentions(prev => [...prev, newMention]);
    
    // Close picker
    setShowMentionPicker(false);
    setMentionFilterText('');
    setMentionStartIndex(-1);

    return { newValue, newCursorPosition };
  }, [mentionStartIndex]);

  const closeMentionPicker = useCallback(() => {
    setShowMentionPicker(false);
    setMentionFilterText('');
    setMentionStartIndex(-1);
  }, []);

  // Extract unique user IDs from mentions
  const extractMentionIds = useCallback((): string[] => {
    const uniqueIds = [...new Set(mentions.map(m => m.userId))];
    return uniqueIds;
  }, [mentions]);

  // Reset mentions for a new message
  const resetMentions = useCallback(() => {
    setMentions([]);
    setShowMentionPicker(false);
    setMentionFilterText('');
    setMentionStartIndex(-1);
  }, []);

  return {
    showMentionPicker,
    mentionFilterText,
    mentionStartIndex,
    mentions,
    handleInputChange,
    handleMentionSelect,
    closeMentionPicker,
    extractMentionIds,
    resetMentions,
  };
}

// Helper to parse mentions from text and return array of user IDs
export function parseMentionsFromText(text: string, teamMembers: { id: string; fullName: string }[]): string[] {
  // Match @Name where Name is capitalized words (matching the display pattern)
  const mentionRegex = /@([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+){0,3})/g;
  const mentionedIds: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedName = match[1].trim();
    const member = teamMembers.find(m => 
      m.fullName.toLowerCase() === mentionedName.toLowerCase()
    );
    if (member && !mentionedIds.includes(member.id)) {
      mentionedIds.push(member.id);
    }
  }

  return mentionedIds;
}

// Create mention notifications
export async function createMentionNotifications(
  mentionedUserIds: string[],
  mentionerUserId: string,
  sourceType: 'internal_note' | 'internal_chat',
  messageId: string,
  conversationId?: string,
  roomId?: string,
  companyId?: string
): Promise<void> {
  if (mentionedUserIds.length === 0) return;

  try {
    // For internal notes, check if each user has access to the conversation
    const notifications = await Promise.all(
      mentionedUserIds.map(async (userId) => {
        let hasAccess = true;

        if (sourceType === 'internal_note' && conversationId && companyId) {
          // Check if user can access this conversation
          hasAccess = await checkUserConversationAccess(userId, conversationId, companyId);
        }

        return {
          mentioned_user_id: userId,
          mentioner_user_id: mentionerUserId,
          source_type: sourceType,
          message_id: messageId,
          conversation_id: conversationId || null,
          room_id: roomId || null,
          has_access: hasAccess,
          is_read: false,
        };
      })
    );

    const { error } = await supabase
      .from('mention_notifications')
      .insert(notifications);

    if (error) {
      console.error('Error creating mention notifications:', error);
    }
  } catch (error) {
    console.error('Error in createMentionNotifications:', error);
  }
}

// Check if a user has access to a conversation
async function checkUserConversationAccess(
  userId: string,
  conversationId: string,
  companyId: string
): Promise<boolean> {
  try {
    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('whatsapp_connection_id, department_id, assigned_user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) return false;

    // Get user's role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const userRole = roleData?.role;

    // Owner/admin always have access
    if (userRole === 'owner' || userRole === 'admin') {
      return true;
    }

    // Check connection access
    const { data: connectionAccess } = await supabase
      .from('connection_users')
      .select('access_level, department_access_mode')
      .eq('user_id', userId)
      .eq('connection_id', conversation.whatsapp_connection_id)
      .single();

    if (!connectionAccess) {
      return false; // No access to this connection
    }

    // Check if 'assigned_only' and not assigned to this user
    if (connectionAccess.access_level === 'assigned_only') {
      if (conversation.assigned_user_id !== userId) {
        return false;
      }
    }

    // Check department access
    if (connectionAccess.department_access_mode === 'none') {
      return false;
    }

    if (connectionAccess.department_access_mode === 'specific' && conversation.department_id) {
      const { data: deptAccess } = await supabase
        .from('department_users')
        .select('id')
        .eq('user_id', userId)
        .eq('department_id', conversation.department_id)
        .single();

      if (!deptAccess) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking conversation access:', error);
    return false;
  }
}
