import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DropZone({ onFilesDropped, disabled, children, className }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = { current: 0 };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (!disabled && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragging(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesDropped(files);
    }
  }, [disabled, onFilesDropped]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative", className)}
    >
      {children}
      
      {/* Overlay when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 
                        flex items-center justify-center rounded-lg border-2 border-dashed border-primary
                        pointer-events-none">
          <div className="text-center bg-background/90 rounded-lg p-6 shadow-lg">
            <Upload className="w-12 h-12 mx-auto text-primary mb-2" />
            <p className="text-lg font-medium text-foreground">Solte os arquivos aqui</p>
            <p className="text-sm text-muted-foreground">Imagens, vídeos, áudios ou documentos</p>
          </div>
        </div>
      )}
    </div>
  );
}
