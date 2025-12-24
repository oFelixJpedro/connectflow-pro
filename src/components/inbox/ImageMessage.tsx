import { useState, useCallback, useEffect } from 'react';
import { X, Download, ImageOff, Loader2, ZoomIn, GripVertical, Save } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@/components/ui/dialog';
import { LinkifyText } from '@/components/ui/linkify-text';

interface ImageMessageProps {
  src: string;
  alt?: string;
  isOutbound?: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  status?: string;
  errorMessage?: string;
  caption?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageMessage({
  src,
  alt = 'Imagem do WhatsApp',
  isOutbound = false,
  width,
  height,
  fileSize,
  status,
  errorMessage,
  caption,
}: ImageMessageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Preload image as local Blob to bypass DLP policies
  const preloadAsBlob = useCallback(async () => {
    try {
      const response = await fetch(src, { mode: 'cors' });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
    } catch (error) {
      console.warn('Não foi possível pré-carregar imagem como blob:', error);
      // Fallback: continue using original URL
    }
  }, [src]);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading || hasError) {
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    
    // Use blob URL if available (bypasses DLP), otherwise original
    const downloadUrl = blobUrl || src;
    
    // Extract filename from URL or generate one
    const urlParts = src.split('/');
    const urlFileName = urlParts[urlParts.length - 1]?.split('?')[0];
    const fileName = urlFileName || `imagem-${Date.now()}.jpg`;
    
    // Detect MIME type from extension
    const mimeType = fileName.match(/\.png$/i) ? 'image/png' 
                   : fileName.match(/\.gif$/i) ? 'image/gif'
                   : fileName.match(/\.webp$/i) ? 'image/webp'
                   : 'image/jpeg';
    
    // DownloadURL format: MIME:filename:URL (for direct download when dropping)
    e.dataTransfer.setData('DownloadURL', `${mimeType}:${fileName}:${downloadUrl}`);
    
    // Fallbacks for other apps
    e.dataTransfer.setData('text/uri-list', downloadUrl);
    e.dataTransfer.setData('text/plain', downloadUrl);
    
    e.dataTransfer.effectAllowed = 'copy';
    
    // Set drag image preview
    const img = e.currentTarget.querySelector('img');
    if (img) {
      e.dataTransfer.setDragImage(img, 50, 50);
    }
  }, [src, blobUrl, isLoading, hasError]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragStartPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only open lightbox if it wasn't a drag (moved less than 5px)
    if (dragStartPos) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + 
        Math.pow(e.clientY - dragStartPos.y, 2)
      );
      if (distance > 5) {
        e.preventDefault();
        setDragStartPos(null);
        return;
      }
    }
    setDragStartPos(null);
    
    if (!isLoading && !hasError) {
      setIsLightboxOpen(true);
    }
  }, [dragStartPos, isLoading, hasError]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    preloadAsBlob(); // Preload as blob after image loads
  }, [preloadAsBlob]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleDownload = useCallback(() => {
    window.open(src, '_blank', 'noopener,noreferrer');
  }, [src]);

  // Quick save: forces download using Blob technique
  const handleQuickSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(src, { mode: 'cors' });
      const blob = await response.blob();
      
      // Extract filename
      const urlParts = src.split('/');
      const urlFileName = urlParts[urlParts.length - 1]?.split('?')[0];
      const fileName = urlFileName || `imagem-${Date.now()}.jpg`;
      
      // Create temporary link for download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      // Fallback: open in new tab
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  }, [src]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsLightboxOpen(true);
    }
  }, []);

  // Failed state
  if (status === 'failed' || (!src && !isLoading)) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-6 rounded-xl",
          "w-full max-w-[300px] md:max-w-[300px] min-h-[120px]",
          isOutbound 
            ? "bg-primary/10 dark:bg-primary/20" 
            : "bg-muted"
        )}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground text-center">
          {errorMessage || 'Imagem indisponível'}
        </span>
      </div>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            draggable={!isLoading && !hasError}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMouseDown={handleMouseDown}
            className={cn(
              "relative rounded-xl overflow-hidden group",
              "w-full max-w-[300px] md:max-w-[300px]",
              "transition-all duration-200 hover:scale-[1.02]",
              isOutbound 
                ? "bg-primary/10 dark:bg-primary/20" 
                : "bg-muted",
              !isLoading && !hasError && "cursor-grab",
              isDragging && "cursor-grabbing ring-2 ring-primary scale-105"
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`${alt}. Arraste para salvar ou clique para ampliar.`}
          >
        {/* Loading skeleton */}
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-muted/80"
            style={{ aspectRatio: width && height ? `${width}/${height}` : '16/9' }}
          >
            <div className="animate-shimmer w-full h-full bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div 
            className="flex flex-col items-center justify-center gap-2 p-6 min-h-[120px]"
          >
            <ImageOff className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Imagem indisponível</span>
          </div>
        )}

        {/* Image */}
        {!hasError && (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            draggable={false}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              "w-full h-auto object-cover max-h-[400px]",
              "transition-opacity duration-200 pointer-events-none select-none",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            style={{ 
              aspectRatio: width && height ? `${width}/${height}` : undefined,
              minHeight: isLoading ? '120px' : undefined
            }}
          />
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary pointer-events-none">
            <span className="text-xs font-medium text-primary-foreground bg-primary px-2 py-1 rounded">
              Solte para salvar
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {!isLoading && !hasError && (
          <div className={cn(
            "absolute inset-0 bg-black/0 group-hover:bg-black/20",
            "flex items-center justify-center opacity-0 group-hover:opacity-100",
            "transition-all duration-200"
          )}>
            <div className="bg-background/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
              <ZoomIn className="w-5 h-5 text-foreground" />
            </div>
          </div>
        )}

        {/* Drag indicator */}
        {!isLoading && !hasError && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/30 text-white rounded-full p-1.5">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Quick Save button - alternative to drag */}
        {!isLoading && !hasError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleQuickSave}
            className={cn(
              "absolute top-2 right-10 h-7 w-7 rounded-full",
              "bg-black/30 hover:bg-black/50 text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
            aria-label="Salvar rapidamente"
          >
            <Save className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Download button */}
        {!isLoading && !hasError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className={cn(
              "absolute top-2 right-2 h-7 w-7 rounded-full",
              "bg-black/30 hover:bg-black/50 text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
            aria-label="Baixar imagem"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        )}

          {/* Caption */}
          {caption && (
            <div 
              className={cn(
                "px-3 py-2 text-sm leading-relaxed",
                isOutbound ? "text-foreground" : "text-foreground"
              )}
            >
              <LinkifyText text={caption} />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Arraste para salvar ou clique para ampliar
      </TooltipContent>
    </Tooltip>


      {/* Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none"
          onPointerDownOutside={() => setIsLightboxOpen(false)}
        >
          <DialogClose className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>

          {/* Download button in lightbox */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="absolute top-4 right-16 z-50 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Baixar imagem"
          >
            <Download className="w-5 h-5" />
          </Button>

          <div className="flex items-center justify-center w-full h-full min-h-[50vh] p-4">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
