import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Kanban, ArrowLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface CRMBoard {
  id: string;
  name: string;
  is_default: boolean;
}

interface CRMColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  boardId: string;
  boardName: string;
  isDefaultBoard: boolean;
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
  const [openUpward, setOpenUpward] = useState(false);

  // Calculate if modal should open upward
  useEffect(() => {
    const modalHeight = 350;
    const spaceBelow = window.innerHeight - position.y;
    setOpenUpward(spaceBelow < modalHeight && position.y > modalHeight);
  }, [position]);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!profile?.company_id) return;
      
      try {
        // Get all boards with their columns
        let boardsQuery = supabase
          .from('kanban_boards')
          .select('id, name, is_default, whatsapp_connection_id, company_id')
          .eq('company_id', profile.company_id)
          .order('is_default', { ascending: false })
          .order('name');
        
        if (connectionId) {
          boardsQuery = boardsQuery.eq('whatsapp_connection_id', connectionId);
        }
        
        const { data: boards, error: boardsError } = await boardsQuery;
        
        if (boardsError) throw boardsError;
        
        if (!boards || boards.length === 0) {
          setColumns([]);
          setLoading(false);
          return;
        }
        
        const boardIds = boards.map(b => b.id);
        
        // Get columns for all boards
        const { data: columnsData, error: columnsError } = await supabase
          .from('kanban_columns')
          .select('id, name, color, position, board_id')
          .in('board_id', boardIds)
          .order('position');
        
        if (columnsError) throw columnsError;
        
        // Map columns with board info
        const boardMap = new Map(boards.map(b => [b.id, b]));
        
        const mappedColumns: CRMColumn[] = (columnsData || []).map(col => {
          const board = boardMap.get(col.board_id);
          return {
            id: col.id,
            name: col.name,
            color: col.color,
            position: col.position,
            boardId: col.board_id,
            boardName: board?.name || 'CRM Principal',
            isDefaultBoard: board?.is_default || false,
          };
        });
        
        setColumns(mappedColumns);
      } catch (err) {
        console.error('Error fetching CRM columns:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchColumns();
  }, [profile?.company_id, connectionId]);

  // Group columns by board
  const columnsByBoard = useMemo(() => {
    const grouped = new Map<string, { board: { id: string; name: string; isDefault: boolean }; columns: CRMColumn[] }>();
    
    columns.forEach(col => {
      if (!grouped.has(col.boardId)) {
        grouped.set(col.boardId, {
          board: { id: col.boardId, name: col.boardName, isDefault: col.isDefaultBoard },
          columns: []
        });
      }
      grouped.get(col.boardId)!.columns.push(col);
    });
    
    return grouped;
  }, [columns]);

  // Filter columns based on search
  const filteredColumnsByBoard = useMemo(() => {
    if (!search) return columnsByBoard;
    
    const searchLower = search.toLowerCase();
    const filtered = new Map<string, { board: { id: string; name: string; isDefault: boolean }; columns: CRMColumn[] }>();
    
    columnsByBoard.forEach((value, boardId) => {
      const matchingColumns = value.columns.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        value.board.name.toLowerCase().includes(searchLower)
      );
      if (matchingColumns.length > 0) {
        filtered.set(boardId, { board: value.board, columns: matchingColumns });
      }
    });
    
    return filtered;
  }, [columnsByBoard, search]);

  // Flatten filtered columns for keyboard navigation
  const flatFilteredColumns = useMemo(() => {
    const flat: CRMColumn[] = [];
    filteredColumnsByBoard.forEach(({ columns }) => {
      flat.push(...columns);
    });
    return flat;
  }, [filteredColumnsByBoard]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatFilteredColumns.length]);

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
          setSelectedIndex(i => (i + 1) % flatFilteredColumns.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + flatFilteredColumns.length) % flatFilteredColumns.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatFilteredColumns[selectedIndex]) {
            handleSelect(flatFilteredColumns[selectedIndex]);
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
  }, [flatFilteredColumns, selectedIndex, onClose]);

  const handleSelect = (column: CRMColumn) => {
    // Include board name in the output for multi-board support
    const hasMultipleBoards = columnsByBoard.size > 1;
    if (hasMultipleBoards) {
      onSelect(`[Board: ${column.boardName}] [Etapa: ${column.name}]`);
    } else {
      onSelect(`[${column.name}]`);
    }
  };

  // Check if a column is currently selected (for keyboard navigation)
  const isColumnSelected = (column: CRMColumn) => {
    const index = flatFilteredColumns.findIndex(c => c.id === column.id);
    return index === selectedIndex;
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
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
        <span className="text-sm font-medium">Selecionar Etapa do CRM</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar etapa ou board..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filteredColumnsByBoard.size === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma etapa encontrada
          </div>
        ) : (
          Array.from(filteredColumnsByBoard.entries()).map(([boardId, { board, columns }]) => (
            <div key={boardId}>
              {/* Board header - only show if multiple boards */}
              {columnsByBoard.size > 1 && (
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 flex items-center gap-2 sticky top-0">
                  <Kanban className="w-3 h-3" />
                  <span className="truncate">{board.name}</span>
                  {board.isDefault && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      Padrão
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Columns */}
              <div className="p-1">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleSelect(col)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                      isColumnSelected(col)
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
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
