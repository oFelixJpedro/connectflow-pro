import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Search, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useQuickRepliesData, QuickReply } from '@/hooks/useQuickRepliesData';

interface QuickRepliesPickerProps {
  inputValue: string;
  onSelect: (message: string, replyId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function QuickRepliesPicker({
  inputValue,
  onSelect,
  onClose,
  isOpen,
}: QuickRepliesPickerProps) {
  const { quickReplies, incrementUseCount } = useQuickRepliesData();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter replies based on input (after "/")
  const searchTerm = inputValue.startsWith('/') ? inputValue.slice(1).toLowerCase() : '';
  
  const filteredReplies = quickReplies.filter(reply => {
    if (!searchTerm) return true;
    
    const matchesShortcut = reply.shortcut.toLowerCase().includes(searchTerm);
    const matchesTitle = reply.title.toLowerCase().includes(searchTerm);
    const matchesMessage = reply.message.toLowerCase().includes(searchTerm);
    
    return matchesShortcut || matchesTitle || matchesMessage;
  });

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredReplies.length, searchTerm]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((reply: QuickReply) => {
    incrementUseCount(reply.id);
    onSelect(reply.message, reply.id);
  }, [incrementUseCount, onSelect]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredReplies.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter' && filteredReplies.length > 0) {
        e.preventDefault();
        handleSelect(filteredReplies[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredReplies, selectedIndex, handleSelect, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="w-4 h-4" />
          <span>Respostas Rápidas</span>
          {searchTerm && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {filteredReplies.length} encontrada{filteredReplies.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="max-h-64">
        {filteredReplies.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma resposta encontrada</p>
            <p className="text-xs mt-1">Tente outro termo ou crie uma nova resposta</p>
          </div>
        ) : (
          <div className="py-1">
            {filteredReplies.map((reply, index) => (
              <div
                key={reply.id}
                ref={(el) => (itemRefs.current[index] = el)}
                onClick={() => handleSelect(reply)}
                className={cn(
                  "px-3 py-2 cursor-pointer transition-colors",
                  index === selectedIndex 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs flex-shrink-0">
                    {reply.shortcut}
                  </Badge>
                  <span className="font-medium text-sm truncate">{reply.title}</span>
                  {reply.category && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto flex-shrink-0">
                      <FolderOpen className="w-3 h-3" />
                      {reply.category}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {reply.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
        <span>↑↓ para navegar</span>
        <span>•</span>
        <span>Enter para selecionar</span>
        <span>•</span>
        <span>Esc para fechar</span>
      </div>
    </div>
  );
}
