import { useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ContactAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const fallbackTextSizes: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ContactAvatar({
  imageUrl,
  name,
  size = 'md',
  className,
  fallbackClassName,
}: ContactAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Reset error state when imageUrl changes
  const handleImageLoad = useCallback(() => {
    setImageError(false);
  }, []);

  const showFallback = !imageUrl || imageError;

  return (
    <Avatar className={cn(sizeClasses[size], 'shrink-0', className)}>
      {!showFallback && (
        <AvatarImage
          src={imageUrl}
          alt={name || 'Avatar'}
          className="object-cover object-top"
          loading="lazy"
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      <AvatarFallback
        className={cn(
          'bg-primary/10 text-primary font-medium',
          fallbackTextSizes[size],
          fallbackClassName
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
