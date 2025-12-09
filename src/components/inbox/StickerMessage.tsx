import { useState } from 'react';
import { ImageOff, X } from 'lucide-react';

interface StickerMessageProps {
  mediaUrl: string;
  isAnimated?: boolean;
}

const StickerMessage = ({ mediaUrl, isAnimated }: StickerMessageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-lg">
        <ImageOff className="w-10 h-10 text-muted-foreground mb-2" />
        <span className="text-xs text-muted-foreground">Figurinha indisponível</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-[200px] h-[200px]">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-muted/20 animate-pulse rounded-lg" />
        )}
        
        {/* Sticker image */}
        <img
          src={mediaUrl}
          alt={isAnimated ? "Sticker animado" : "Sticker"}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          onClick={() => setShowLightbox(true)}
          className={`w-[200px] h-[200px] object-contain cursor-pointer transition-opacity ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={mediaUrl}
            alt={isAnimated ? "Sticker animado" : "Sticker"}
            className="max-w-[512px] max-h-[512px] object-contain"
            style={{ background: 'transparent' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default StickerMessage;
