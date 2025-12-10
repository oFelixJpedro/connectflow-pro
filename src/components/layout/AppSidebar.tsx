import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  LayoutDashboard, 
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Tag,
  Zap,
  Plug,
  LogOut,
  Building2,
  User,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { toast } from 'sonner';

import { UsersRound } from 'lucide-react';

const menuItems = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard',
    badge: null,
    adminOnly: false,
  },
  { 
    icon: MessageSquare, 
    label: 'Inbox', 
    path: '/inbox',
    badge: 5,
    adminOnly: false,
  },
  { 
    icon: Users, 
    label: 'Contatos', 
    path: '/contacts',
    badge: null,
    adminOnly: false,
  },
  { 
    icon: Tag, 
    label: 'Tags', 
    path: '/tags',
    badge: null,
    adminOnly: false,
  },
  { 
    icon: Building2, 
    label: 'Departamentos', 
    path: '/departments',
    badge: null,
    adminOnly: true,
  },
  { 
    icon: Zap, 
    label: 'Respostas Rápidas', 
    path: '/quick-replies',
    badge: null,
    adminOnly: false,
  },
  { 
    icon: Plug, 
    label: 'Conexões', 
    path: '/connections',
    badge: null,
    adminOnly: true,
  },
  { 
    icon: UsersRound, 
    label: 'Equipe', 
    path: '/team',
    badge: null,
    adminOnly: true,
  },
  { 
    icon: Settings, 
    label: 'Configurações', 
    path: '/settings',
    badge: null,
    adminOnly: false,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, company, userRole, signOut, updateStatus } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
  };

  const statusLabels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    away: 'Ausente',
    busy: 'Ocupado',
  };

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    supervisor: 'Supervisor',
    agent: 'Agente',
    viewer: 'Visualizador',
  };

  const handleStatusChange = async (newStatus: 'online' | 'offline' | 'away' | 'busy') => {
    await updateStatus(newStatus);
    toast.success(`Status alterado para ${statusLabels[newStatus]}`);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Até logo!');
    navigate('/auth');
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <aside 
      className={cn(
        'h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">
              Multiatendimento
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            sidebarCollapsed && "hidden"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Company Info */}
      {!sidebarCollapsed && company && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sidebar-accent rounded-lg flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-4 h-4 text-sidebar-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {company.name}
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">
                Plano {company.plan}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems
          .filter(item => !item.adminOnly || userRole?.role === 'owner' || userRole?.role === 'admin')
          .map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/inbox' && location.pathname.startsWith('/inbox'));
          
          const NavItem = (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'sidebar-link',
                isActive && 'active'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0')} />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className="bg-primary text-primary-foreground text-xs px-2 py-0.5"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  {NavItem}
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  {item.label}
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }

          return NavItem;
        })}
      </nav>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <div className="px-3 pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* User Section */}
      <div className={cn(
        "border-t border-sidebar-border p-4",
        sidebarCollapsed && "px-3"
      )}>
        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full rounded-lg p-2 hover:bg-sidebar-accent transition-colors",
                sidebarCollapsed && "justify-center p-1"
              )}>
                <div className="relative">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span 
                    className={cn(
                      "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-sidebar",
                      statusColors[profile.status]
                    )} 
                  />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {profile.full_name}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60">
                      {userRole ? roleLabels[userRole.role] : statusLabels[profile.status]}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Status
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleStatusChange('online')}>
                <Circle className="w-3 h-3 mr-2 fill-green-500 text-green-500" />
                Online
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('away')}>
                <Circle className="w-3 h-3 mr-2 fill-yellow-500 text-yellow-500" />
                Ausente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('busy')}>
                <Circle className="w-3 h-3 mr-2 fill-red-500 text-red-500" />
                Ocupado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('offline')}>
                <Circle className="w-3 h-3 mr-2 fill-gray-400 text-gray-400" />
                Offline
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="w-4 h-4 mr-2" />
                Meu perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
