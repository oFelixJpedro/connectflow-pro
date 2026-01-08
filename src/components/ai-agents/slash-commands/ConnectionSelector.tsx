import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Wifi, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Connection {
  id: string;
  name: string;
  phone_number: string | null;
}

interface ConnectionSelectorProps {
  position: { x: number; y: number };
  onSelect: (connectionId: string, connectionName: string) => void;
  onClose: () => void;
  onBack?: () => void;
  title: string;
}

export function ConnectionSelector({ position, onSelect, onClose, onBack, title }: ConnectionSelectorProps) {
  const { profile } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  // Calculate if modal should open upward
  useEffect(() => {
    const modalHeight = 350;
    const spaceBelow = window.innerHeight - position.y;
    setOpenUpward(spaceBelow < modalHeight && position.y > modalHeight);
  }, [position]);

  useEffect(() => {
    const fetchConnections = async () => {
      if (!profile?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number')
          .eq('company_id', profile.company_id)
          .eq('active', true)
          .order('name');
        
        if (error) throw error;
        setConnections(data || []);
      } catch (err) {
        console.error('Error fetching connections:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchConnections();
  }, [profile?.company_id]);

  const filteredConnections = useMemo(() => {
    if (!search) return connections;
    const searchLower = search.toLowerCase();
    return connections.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.phone_number?.includes(search)
    );
  }, [connections, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredConnections.length]);

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
          setSelectedIndex(i => (i + 1) % filteredConnections.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredConnections.length) % filteredConnections.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredConnections[selectedIndex]) {
            onSelect(filteredConnections[selectedIndex].id, filteredConnections[selectedIndex].name);
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
  }, [filteredConnections, selectedIndex, onSelect, onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        ...(openUpward 
          ? { bottom: window.innerHeight - position.y + 8 }
          : { top: position.y + 8 }
        ),
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
        <span className="text-sm font-medium">{title}</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conexão..."
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
          ) : filteredConnections.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma conexão encontrada
            </div>
          ) : (
            filteredConnections.map((conn, index) => (
              <button
                key={conn.id}
                onClick={() => onSelect(conn.id, conn.name)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50'
                )}
              >
                <Wifi className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{conn.name}</div>
                  {conn.phone_number && (
                    <div className="text-xs text-muted-foreground truncate">
                      {conn.phone_number}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
