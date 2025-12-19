import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface UserSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
}

export function UserSelector({ position, onSelect, onClose, onBack }: UserSelectorProps) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('company_id', profile.company_id)
          .eq('active', true)
          .order('full_name');
        
        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [profile?.company_id]);

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const searchLower = search.toLowerCase();
    return users.filter(u => 
      u.full_name.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower)
    );
  }, [users, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredUsers.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            handleSelect(filteredUsers[selectedIndex].full_name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredUsers, selectedIndex, onClose]);

  const handleSelect = (userName: string) => {
    onSelect(userName);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: position.y + 8,
      }}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium">Selecionar Usuário</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuário..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto">
        <div className="p-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum usuário encontrado
            </div>
          ) : (
            filteredUsers.map((user, index) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user.full_name)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50'
                )}
              >
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.full_name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
