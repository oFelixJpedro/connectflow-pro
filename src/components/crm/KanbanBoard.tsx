import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn as KanbanColumnComponent } from './KanbanColumn';
import { KanbanCard as KanbanCardComponent } from './KanbanCard';
import { KanbanCardDrawer } from './KanbanCardDrawer';
import { AddColumnDialog } from './AddColumnDialog';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KanbanColumn, KanbanCard, KanbanCardComment, KanbanCardHistory, KanbanCardAttachment } from '@/hooks/useKanbanData';

interface ConnectionInfo {
  id: string;
  name: string;
  phone_number: string;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  teamMembers: { id: string; full_name: string; avatar_url: string | null }[];
  isAdminOrOwner: boolean;
  isGlobalView?: boolean;
  connectionMap?: Map<string, ConnectionInfo>;
  connections?: { id: string; name: string; phone_number: string }[];
  onCreateColumn: (name: string, color: string) => Promise<KanbanColumn | null>;
  onUpdateColumn: (columnId: string, updates: Partial<KanbanColumn>) => Promise<boolean>;
  onDeleteColumn: (columnId: string, moveToColumnId?: string) => Promise<boolean>;
  onReorderColumns: (newColumns: KanbanColumn[]) => Promise<boolean>;
  onMoveCard: (cardId: string, toColumnId: string, newPosition: number) => Promise<boolean>;
  onUpdateCard: (
    cardId: string,
    updates: Partial<Pick<KanbanCard, 'priority' | 'assigned_user_id'>>,
    historyAction?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>
  ) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<boolean>;
  onAddTag: (cardId: string, name: string, color: string) => Promise<unknown>;
  onRemoveTag: (cardId: string, tagId: string) => Promise<boolean>;
  onAddChecklistItem: (cardId: string, text: string) => Promise<unknown>;
  onToggleChecklistItem: (cardId: string, itemId: string) => Promise<boolean>;
  onDeleteChecklistItem: (cardId: string, itemId: string) => Promise<boolean>;
  onAddComment: (cardId: string, content: string) => Promise<KanbanCardComment | null>;
  onLoadComments: (cardId: string) => Promise<KanbanCardComment[]>;
  onLoadHistory: (cardId: string) => Promise<KanbanCardHistory[]>;
  onLoadAttachments: (cardId: string) => Promise<KanbanCardAttachment[]>;
  onUploadAttachment: (cardId: string, file: File) => Promise<KanbanCardAttachment | null>;
  onDeleteAttachment: (cardId: string, attachmentId: string, filePath: string) => Promise<boolean>;
}

export function KanbanBoard({
  columns,
  cards,
  teamMembers,
  isAdminOrOwner,
  isGlobalView = false,
  connectionMap,
  connections,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumns,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
  onAddTag,
  onRemoveTag,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onAddComment,
  onLoadComments,
  onLoadHistory,
  onLoadAttachments,
  onUploadAttachment,
  onDeleteAttachment,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'column' | 'card' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  // Derive selected card from cards array to always get the latest state
  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) || null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getCardsByColumn = (columnId: string) => {
    return cards
      .filter(card => card.column_id === columnId)
      .sort((a, b) => a.position - b.position);
  };

  // Get connection name for a card (used in global view)
  const getConnectionNameForCard = (card: KanbanCard): string | undefined => {
    if (!isGlobalView || !connectionMap) return undefined;
    
    const column = columns.find(c => c.id === card.column_id);
    if (!column) return undefined;
    
    const connection = connectionMap.get(column.board_id);
    return connection?.name;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === 'column') {
      setActiveType('column');
      setActiveId(active.id as string);
    } else if (activeData?.type === 'card') {
      setActiveType('card');
      setActiveId(active.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== 'card') return;

    const activeCardId = active.id as string;
    const overColumnId = overData?.type === 'column' 
      ? (over.id as string)
      : overData?.columnId;

    if (!overColumnId) return;

    const activeCard = cards.find(c => c.id === activeCardId);
    if (!activeCard || activeCard.column_id === overColumnId) return;

    // Card is being dragged to a different column - this is handled in dragEnd
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle column reordering (disabled in global view)
    if (activeData?.type === 'column' && overData?.type === 'column' && isAdminOrOwner && !isGlobalView) {
      const oldIndex = columns.findIndex(c => c.id === active.id);
      const newIndex = columns.findIndex(c => c.id === over.id);

      if (oldIndex !== newIndex) {
        const newColumns = arrayMove(columns, oldIndex, newIndex);
        await onReorderColumns(newColumns);
      }
      return;
    }

    // Handle card movement (disabled in global view for cross-board moves)
    if (activeData?.type === 'card') {
      const activeCardId = active.id as string;
      let targetColumnId: string;
      let newPosition: number;

      if (overData?.type === 'column') {
        // Dropped on column
        targetColumnId = over.id as string;
        const columnCards = getCardsByColumn(targetColumnId);
        newPosition = columnCards.length;
      } else if (overData?.type === 'card') {
        // Dropped on another card
        targetColumnId = overData.columnId;
        const columnCards = getCardsByColumn(targetColumnId);
        const overIndex = columnCards.findIndex(c => c.id === over.id);
        newPosition = overIndex >= 0 ? overIndex : columnCards.length;
      } else {
        return;
      }

      // In global view, prevent moving cards between different boards
      if (isGlobalView) {
        const activeCard = cards.find(c => c.id === activeCardId);
        const activeColumn = columns.find(c => c.id === activeCard?.column_id);
        const targetColumn = columns.find(c => c.id === targetColumnId);
        
        if (activeColumn?.board_id !== targetColumn?.board_id) {
          return; // Don't allow cross-board moves
        }
      }

      await onMoveCard(activeCardId, targetColumnId, newPosition);
    }
  };

  const activeCard = activeType === 'card' && activeId
    ? cards.find(c => c.id === activeId)
    : null;

  const activeColumn = activeType === 'column' && activeId
    ? columns.find(c => c.id === activeId)
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-4 custom-scrollbar-horizontal">
          <div className="flex gap-4 h-full min-w-max">
            <SortableContext
              items={columns.map(c => c.id)}
              strategy={horizontalListSortingStrategy}
              disabled={!isAdminOrOwner || isGlobalView}
            >
              {columns.map(column => (
                <KanbanColumnComponent
                  key={column.id}
                  column={column}
                  cards={getCardsByColumn(column.id)}
                  allColumns={columns}
                  isAdminOrOwner={isAdminOrOwner}
                  isGlobalView={isGlobalView}
                  connectionMap={connectionMap}
                  onUpdateColumn={onUpdateColumn}
                  onDeleteColumn={onDeleteColumn}
                  onCardClick={(card) => setSelectedCardId(card.id)}
                  getConnectionName={getConnectionNameForCard}
                />
              ))}
            </SortableContext>

            {/* Add Column Button - hidden in global view */}
            {isAdminOrOwner && !isGlobalView && (
              <div className="w-72 flex-shrink-0">
                <Button
                  variant="outline"
                  className="w-full h-12 border-dashed"
                  onClick={() => setAddColumnOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Coluna
                </Button>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <KanbanCardComponent
              card={activeCard}
              isDragging
              onClick={() => {}}
            />
          )}
          {activeColumn && (
            <div className="w-72 bg-muted rounded-lg p-3 opacity-80">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeColumn.color }}
                />
                <span className="font-medium">{activeColumn.name}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Card Detail Drawer */}
      <KanbanCardDrawer
        card={selectedCard}
        columns={columns}
        teamMembers={teamMembers}
        open={!!selectedCardId}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
        onUpdateCard={onUpdateCard}
        onDeleteCard={onDeleteCard}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onAddChecklistItem={onAddChecklistItem}
        onToggleChecklistItem={onToggleChecklistItem}
        onDeleteChecklistItem={onDeleteChecklistItem}
        onAddComment={onAddComment}
        onLoadComments={onLoadComments}
        onLoadHistory={onLoadHistory}
        onLoadAttachments={onLoadAttachments}
        onUploadAttachment={onUploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
        onMoveCard={onMoveCard}
      />

      {/* Add Column Dialog */}
      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        onCreateColumn={onCreateColumn}
      />
    </>
  );
}
