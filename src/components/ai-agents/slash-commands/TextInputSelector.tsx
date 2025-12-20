import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TextInputSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  placeholder: string;
  multiline?: boolean;
}

export function TextInputSelector({ 
  position, 
  onSelect, 
  onClose, 
  onBack,
  title,
  placeholder,
  multiline = false
}: TextInputSelectorProps) {
  const [value, setValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  // Calculate if modal should open upward
  useEffect(() => {
    const modalHeight = 200;
    const spaceBelow = window.innerHeight - position.y;
    setOpenUpward(spaceBelow < modalHeight && position.y > modalHeight);
  }, [position]);

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
      if (e.key === 'Enter' && !multiline && value.trim()) {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [value, multiline, onClose]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    // Envolver em colchetes para suportar espaços
    onSelect(`[${value.trim()}]`);
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
        <span className="text-sm font-medium">{title}</span>
      </div>
      
      <div className="p-3 space-y-3">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="min-h-[80px] text-sm resize-none"
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-9 text-sm"
          />
        )}
        
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            Inserir
          </Button>
        </div>
      </div>
    </div>
  );
}
