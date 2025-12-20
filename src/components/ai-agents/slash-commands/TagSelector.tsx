import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, Plus, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTagsData } from '@/hooks/useTagsData';

interface TagSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
}

export function TagSelector({ position, onSelect, onClose, onBack }: TagSelectorProps) {
  const { tags, loading } = useTagsData();
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

  const filteredTags = useMemo(() => {
    if (!search) return tags;
    const searchLower = search.toLowerCase();
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower)
    );
  }, [tags, search]);

  // Allow creating new tag if search doesn't match existing
  const canCreateNew = search && !filteredTags.some(t => t.name.toLowerCase() === search.toLowerCase());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredTags.length]);

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
    const totalItems = filteredTags.length + (canCreateNew ? 1 : 0);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (canCreateNew && selectedIndex === filteredTags.length) {
            onSelect(`[${search.trim()}]`);
          } else if (filteredTags[selectedIndex]) {
            onSelect(`[${filteredTags[selectedIndex].name}]`);
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
  }, [filteredTags, selectedIndex, canCreateNew, search, onSelect, onClose]);

  const handleSelect = (tagName: string) => {
    // Envolver em colchetes para suportar espaços
    onSelect(`[${tagName}]`);
  };

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
        <span className="text-sm font-medium">Selecionar Etiqueta</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ou criar etiqueta..."
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
          ) : filteredTags.length === 0 && !canCreateNew ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma etiqueta encontrada
            </div>
          ) : (
            <>
              {filteredTags.map((tag, index) => (
                <button
                  key={tag.id}
                  onClick={() => handleSelect(tag.name)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                    index === selectedIndex 
                      ? 'bg-accent text-accent-foreground' 
                      : 'hover:bg-accent/50'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm truncate">{tag.name}</span>
                </button>
              ))}
              
              {canCreateNew && (
                <button
                  onClick={() => handleSelect(search.trim())}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                    selectedIndex === filteredTags.length 
                      ? 'bg-accent text-accent-foreground' 
                      : 'hover:bg-accent/50'
                  )}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Criar "<span className="font-medium">{search}</span>"
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
