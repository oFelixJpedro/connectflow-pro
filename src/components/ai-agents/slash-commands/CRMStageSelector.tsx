import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Kanban, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [hoveredBoardId, setHoveredBoardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Filter boards based on search
  const filteredColumnsByBoard = useMemo(() => {
    if (!search) return columnsByBoard;
    
    const searchLower = search.toLowerCase();
    const filtered = new Map<string, { board: { id: string; name: string; isDefault: boolean }; columns: CRMColumn[] }>();
    
    columnsByBoard.forEach((value, boardId) => {
      // Match board name or any column name
      const boardMatches = value.board.name.toLowerCase().includes(searchLower);
      const matchingColumns = value.columns.filter(c => 
        c.name.toLowerCase().includes(searchLower)
      );
      
      if (boardMatches || matchingColumns.length > 0) {
        // If board matches, show all columns; otherwise show only matching columns
        filtered.set(boardId, { 
          board: value.board, 
          columns: boardMatches ? value.columns : matchingColumns 
        });
      }
    });
    
    return filtered;
  }, [columnsByBoard, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = (column: CRMColumn) => {
    // Include board name in the output for multi-board support
    const hasMultipleBoards = columnsByBoard.size > 1;
    if (hasMultipleBoards) {
      onSelect(`[Board: ${column.boardName}] [Etapa: ${column.name}]`);
    } else {
      onSelect(`[${column.name}]`);
    }
  };

  const handleBoardHover = (boardId: string | null) => {
    // Clear any pending timeout
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }

    if (boardId) {
      setHoveredBoardId(boardId);
    } else {
      // Delay hiding to allow mouse to move to submenu
      submenuTimeoutRef.current = setTimeout(() => {
        setHoveredBoardId(null);
      }, 150);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    };
  }, []);

  const hasMultipleBoards = columnsByBoard.size > 1;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden flex"
      style={{
        left: Math.min(position.x, window.innerWidth - 500),
        ...(openUpward 
          ? { bottom: window.innerHeight - position.y + 8 }
          : { top: position.y + 8 }
        ),
      }}
    >
      {/* Main panel - boards list */}
      <div className="w-64 flex flex-col">
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

        <ScrollArea className="flex-1 max-h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredColumnsByBoard.size === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma etapa encontrada
            </div>
          ) : !hasMultipleBoards ? (
            // Single board - show stages directly
            <div className="p-1">
              {Array.from(filteredColumnsByBoard.values())[0]?.columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleSelect(col)}
                  className="w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors hover:bg-accent"
                >
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm truncate">{col.name}</span>
                </button>
              ))}
            </div>
          ) : (
            // Multiple boards - show board list with hover submenus
            <div className="p-1">
              {Array.from(filteredColumnsByBoard.entries()).map(([boardId, { board }]) => (
                <div
                  key={boardId}
                  className="relative"
                  onMouseEnter={() => handleBoardHover(boardId)}
                  onMouseLeave={() => handleBoardHover(null)}
                >
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                      hoveredBoardId === boardId ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <Kanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{board.name}</span>
                    {board.isDefault && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">
                        Padrão
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Submenu panel - stages for hovered board */}
      {hasMultipleBoards && hoveredBoardId && filteredColumnsByBoard.has(hoveredBoardId) && (
        <div 
          className="w-52 border-l border-border bg-popover"
          onMouseEnter={() => handleBoardHover(hoveredBoardId)}
          onMouseLeave={() => handleBoardHover(null)}
        >
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">Etapas</span>
          </div>
          <ScrollArea className="max-h-[280px]">
            <div className="p-1">
              {filteredColumnsByBoard.get(hoveredBoardId)?.columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleSelect(col)}
                  className="w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors hover:bg-accent"
                >
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm truncate">{col.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
