import { NavLink, useLocation } from 'react-router-dom';
import { 
  Settings,
  Tag,
  Building2,
  Zap,
  Wifi,
  UsersRound,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface SettingsSubmenuProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarCollapsed: boolean;
}

const settingsMenuItems = [
  { 
    icon: Settings, 
    label: 'Geral', 
    path: '/settings/general',
    adminOnly: false,
  },
  { 
    icon: Tag, 
    label: 'Tags', 
    path: '/settings/tags',
    adminOnly: false,
  },
  { 
    icon: Building2, 
    label: 'Departamentos', 
    path: '/settings/departments',
    adminOnly: true,
  },
  { 
    icon: Zap, 
    label: 'Respostas Rápidas', 
    path: '/settings/quick-replies',
    adminOnly: false,
  },
  { 
    icon: Wifi, 
    label: 'Conexões', 
    path: '/settings/connections',
    adminOnly: true,
  },
  { 
    icon: UsersRound, 
    label: 'Equipe', 
    path: '/settings/team',
    adminOnly: true,
  },
];

export function SettingsSubmenu({ isOpen, onClose, sidebarCollapsed }: SettingsSubmenuProps) {
  const location = useLocation();
  const { userRole } = useAuth();

  if (!isOpen) return null;

  const filteredItems = settingsMenuItems.filter(
    item => !item.adminOnly || userRole?.role === 'owner' || userRole?.role === 'admin'
  );

  return (
    <div 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col",
        "w-64 animate-slide-in-left"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <span className="font-semibold text-sidebar-foreground">
          Configurações
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'sidebar-link',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
