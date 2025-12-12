import { Globe, User, Users, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';

interface VisibilityBadgeProps {
  visibility: QuickReplyVisibility;
  className?: string;
}

const visibilityConfig: Record<QuickReplyVisibility, {
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'outline';
}> = {
  all: {
    label: 'Todos',
    icon: <Globe className="w-3 h-3" />,
    variant: 'default',
  },
  personal: {
    label: 'Pessoal',
    icon: <User className="w-3 h-3" />,
    variant: 'secondary',
  },
  department: {
    label: 'Departamento',
    icon: <Users className="w-3 h-3" />,
    variant: 'outline',
  },
  connection: {
    label: 'Conexão',
    icon: <Smartphone className="w-3 h-3" />,
    variant: 'outline',
  },
};

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  const config = visibilityConfig[visibility];
  
  return (
    <Badge variant={config.variant} className={`text-xs flex items-center gap-1 ${className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
