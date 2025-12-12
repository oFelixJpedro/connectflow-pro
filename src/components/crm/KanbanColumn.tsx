import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { EditColumnDialog } from './EditColumnDialog';
import { DeleteColumnDialog } from './DeleteColumnDialog';
import { MoreHorizontal, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType } from '@/hooks/useKanbanData';

interface ConnectionInfo {
  id: string;
  name: string;
  phone_number: string;
}

interface KanbanColumnProps {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  allColumns: KanbanColumnType[];
  isAdminOrOwner: boolean;
  isGlobalView?: boolean;
  connectionMap?: Map<string, ConnectionInfo>;
  onUpdateColumn: (columnId: string, updates: Partial<KanbanColumnType>) => Promise<boolean>;
  onDeleteColumn: (columnId: string, moveToColumnId?: string) => Promise<boolean>;
  onCardClick: (card: KanbanCardType) => void;
  getConnectionName?: (card: KanbanCardType) => string | undefined;
}

export function KanbanColumn({
  column,
  cards,
  allColumns,
  isAdminOrOwner,
  isGlobalView = false,
  connectionMap,
  onUpdateColumn,
  onDeleteColumn,
  onCardClick,
  getConnectionName,
}: KanbanColumnProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
    disabled: !isAdminOrOwner || isGlobalView,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={(node) => {
          setSortableRef(node);
          setDroppableRef(node);
        }}
        style={style}
        className={cn(
          'w-72 flex-shrink-0 bg-muted/50 rounded-lg flex flex-col max-h-[calc(100vh-220px)]',
          isDragging && 'opacity-50',
          isOver && 'ring-2 ring-primary'
        )}
      >
        {/* Column Header */}
        <div 
          className="p-3 flex items-center gap-2 border-b border-border/50"
          style={{ borderTopColor: column.color, borderTopWidth: 3, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
        >
          {isAdminOrOwner && !isGlobalView && (
            <button
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: column.color }}
          />
          
          <span className="font-medium flex-1 truncate">{column.name}</span>
          
          <span className="text-sm text-muted-foreground">{cards.length}</span>

          {isAdminOrOwner && !isGlobalView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <SortableContext
            items={cards.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map(card => (
              <KanbanCard
                key={card.id}
                card={card}
                onClick={() => onCardClick(card)}
                connectionName={getConnectionName?.(card)}
              />
            ))}
          </SortableContext>

          {cards.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum card
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditColumnDialog
        column={column}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdateColumn={onUpdateColumn}
      />

      {/* Delete Dialog */}
      <DeleteColumnDialog
        column={column}
        allColumns={allColumns}
        cardsCount={cards.length}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleteColumn={onDeleteColumn}
      />
    </>
  );
}
