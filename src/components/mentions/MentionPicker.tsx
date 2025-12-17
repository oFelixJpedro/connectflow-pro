import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
}

interface GroupParticipant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface MentionPickerProps {
  isOpen: boolean;
  onSelect: (member: TeamMember) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  filterText?: string;
  roomType?: 'general' | 'direct' | 'group';
  groupParticipants?: GroupParticipant[];
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  agent: 'Atendente',
  viewer: 'Visualizador',
};

const roleOrder: Record<string, number> = {
  owner: 0,
  admin: 1,
  supervisor: 2,
  agent: 3,
  viewer: 4,
};

export function MentionPicker({ isOpen, onSelect, onClose, position, filterText = '', roomType, groupParticipants }: MentionPickerProps) {
  const { company, profile } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Don't show picker for direct chats
  const shouldShowPicker = roomType !== 'direct';

  // Combine external filter and internal search
  const effectiveSearch = filterText || searchQuery;

  // Load team members - for groups, use participants; for general, load all
  const loadMembers = useCallback(async () => {
    if (!company?.id) return;
    
    // For group chats, use provided participants
    if (roomType === 'group' && groupParticipants) {
      const participantMembers: TeamMember[] = groupParticipants
        .filter(p => p.id !== profile?.id) // Exclude current user
        .map(p => ({
          id: p.id,
          fullName: p.fullName,
          avatarUrl: p.avatarUrl,
          role: 'agent', // Role not critical for display in groups
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      
      setMembers(participantMembers);
      setIsLoading(false);
      return;
    }

    // For general chat, load all company members
    setIsLoading(true);

    try {
      // Get profiles with roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('company_id', company.id)
        .eq('active', true);

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', (profilesData || []).map(p => p.id));

      if (rolesError) throw rolesError;

      // Map roles to users
      const rolesMap: Record<string, string> = {};
      (rolesData || []).forEach(r => {
        rolesMap[r.user_id] = r.role;
      });

      // Create team members list (optionally excluding current user)
      const teamMembers: TeamMember[] = (profilesData || [])
        .filter(p => p.id !== profile?.id) // Exclude current user
        .map(p => ({
          id: p.id,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
          role: rolesMap[p.id] || 'agent',
        }))
        .sort((a, b) => {
          // Sort by role first, then by name
          const roleOrderA = roleOrder[a.role] || 99;
          const roleOrderB = roleOrder[b.role] || 99;
          if (roleOrderA !== roleOrderB) return roleOrderA - roleOrderB;
          return a.fullName.localeCompare(b.fullName);
        });

      setMembers(teamMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, profile?.id, roomType, groupParticipants]);

  // Load members when picker opens
  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setSelectedIndex(0);
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, loadMembers]);

  // Filter members based on search
  const filteredMembers = members.filter(member =>
    member.fullName.toLowerCase().includes(effectiveSearch.toLowerCase())
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [effectiveSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredMembers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMembers[selectedIndex]) {
          onSelect(filteredMembers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredMembers, onSelect, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Don't render for direct chats or when closed
  if (!isOpen || !shouldShowPicker) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={position ? { top: position.top, left: position.left } : { bottom: '100%', left: 0, marginBottom: 8 }}
    >
      <div className="p-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Mencionar membro</p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>
      
      <ScrollArea className="max-h-60">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum membro encontrado
          </div>
        ) : (
          <div className="p-1">
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                onClick={() => onSelect(member)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={member.avatarUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(member.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabels[member.role] || member.role}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
