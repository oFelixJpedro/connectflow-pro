import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  BarChart3,
  Plug,
  LogOut,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const menuItems = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard',
    badge: null 
  },
  { 
    icon: MessageSquare, 
    label: 'Inbox', 
    path: '/inbox',
    badge: 5 
  },
  { 
    icon: Users, 
    label: 'Contatos', 
    path: '/contacts',
    badge: null 
  },
  { 
    icon: Tag, 
    label: 'Tags', 
    path: '/tags',
    badge: null 
  },
  { 
    icon: Zap, 
    label: 'Respostas Rápidas', 
    path: '/quick-replies',
    badge: null 
  },
  { 
    icon: BarChart3, 
    label: 'Relatórios', 
    path: '/reports',
    badge: null 
  },
  { 
    icon: Plug, 
    label: 'Conexões', 
    path: '/connections',
    badge: null 
  },
  { 
    icon: Settings, 
    label: 'Configurações', 
    path: '/settings',
    badge: null 
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, company, sidebarCollapsed, toggleSidebar, logout } = useAppStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors = {
    online: 'bg-status-online',
    offline: 'bg-status-offline',
    away: 'bg-status-away',
    busy: 'bg-status-busy',
  };

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
            <div className="w-8 h-8 bg-sidebar-accent rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-sidebar-foreground" />
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
        {menuItems.map((item) => {
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
        {user && (
          <div className={cn(
            "flex items-center gap-3",
            sidebarCollapsed && "justify-center"
          )}>
            <div className="relative">
              <Avatar className="w-9 h-9">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span 
                className={cn(
                  "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-sidebar",
                  statusColors[user.status]
                )} 
              />
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">
                    {user.status}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
