import { useState, useCallback } from 'react';

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
  const mentionedIds: string[] = [];
  
  // For each team member, check if their name appears after @ in the text
  for (const member of teamMembers) {
    // Create a regex that matches @FullName (case insensitive)
    const escapedName = member.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`@${escapedName}(?:\\s|$|[.,!?;:])`, 'i');
    
    if (regex.test(text) && !mentionedIds.includes(member.id)) {
      mentionedIds.push(member.id);
    }
  }

  return mentionedIds;
}
