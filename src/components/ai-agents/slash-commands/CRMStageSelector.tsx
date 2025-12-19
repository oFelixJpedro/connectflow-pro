import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Kanban, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CRMColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface CRMStageSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
  connectionId?: string;
}

export function CRMStageSelector({ position, onSelect, onClose, onBack, connectionId }: CRMStageSelectorProps) {
  const { profile } = useAuth();
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!profile?.company_id) return;
      
      try {
        // Get columns from boards in the company
        let query = supabase
          .from('kanban_columns')
          .select(`
            id,
            name,
            color,
            position,
            kanban_boards!inner(company_id, whatsapp_connection_id)
          `)
          .order('position');
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Filter by company and optionally by connection
        const filtered = (data || []).filter(col => {
          const board = col.kanban_boards as any;
          if (board.company_id !== profile.company_id) return false;
          if (connectionId && board.whatsapp_connection_id !== connectionId) return false;
          return true;
        });
        
        setColumns(filtered.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          position: c.position
        })));
      } catch (err) {
        console.error('Error fetching CRM columns:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchColumns();
  }, [profile?.company_id, connectionId]);

  const filteredColumns = useMemo(() => {
    if (!search) return columns;
    const searchLower = search.toLowerCase();
    return columns.filter(c => c.name.toLowerCase().includes(searchLower));
  }, [columns, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredColumns.length]);

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
          setSelectedIndex(i => (i + 1) % filteredColumns.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredColumns.length) % filteredColumns.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredColumns[selectedIndex]) {
            handleSelect(filteredColumns[selectedIndex].name);
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
  }, [filteredColumns, selectedIndex, onClose]);

  const handleSelect = (columnName: string) => {
    onSelect(columnName);
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
        <span className="text-sm font-medium">Selecionar Etapa</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar etapa..."
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
          ) : filteredColumns.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma etapa encontrada
            </div>
          ) : (
            filteredColumns.map((col, index) => (
              <button
                key={col.id}
                onClick={() => handleSelect(col.name)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50'
                )}
              >
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm truncate">{col.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
