import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  LayoutDashboard, 
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  LogOut,
  Building2,
  User,
  LayoutGrid,
  Bell
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
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SettingsSubmenu } from './SettingsSubmenu';
import { useNotifications } from '@/hooks/useNotifications';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { ThemeToggleMenuItem } from '@/components/ui/theme-toggle';
import { NotificationsModal } from '@/components/notifications/NotificationsModal';

const baseMenuItems = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard',
    badgeKey: null as string | null,
    adminOnly: false,
  },
  { 
    icon: MessageSquare, 
    label: 'Conversas', 
    path: '/inbox',
    badgeKey: 'whatsapp' as string | null,
    adminOnly: false,
  },
  { 
    icon: Users, 
    label: 'Contatos', 
    path: '/contacts',
    badgeKey: null as string | null,
    adminOnly: false,
  },
  { 
    icon: LayoutGrid, 
    label: 'CRM', 
    path: '/crm',
    badgeKey: null as string | null,
    adminOnly: false,
  },
];

interface AppSidebarContentProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  showCollapseButton?: boolean;
}

export function AppSidebarContent({ 
  collapsed = false, 
  onToggleCollapse,
  onNavigate,
  showCollapseButton = true 
}: AppSidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, company, userRole, signOut } = useAuth();
  const { 
    unreadCounts, 
    internalNotifications, 
    whatsappNotifications,
    markAsRead,
    markAllAsRead 
  } = useNotifications();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const totalNotifications = internalNotifications.filter(n => !n.isRead).length + 
                            whatsappNotifications.filter(n => !n.isRead).length;

  // Auto-open settings submenu when on settings route
  useEffect(() => {
    const isSettingsRoute = location.pathname.startsWith('/settings');
    if (isSettingsRoute && !settingsOpen) {
      setSettingsOpen(true);
    }
  }, [location.pathname]);

  // Close settings submenu when navigating away from settings
  useEffect(() => {
    const isSettingsRoute = location.pathname.startsWith('/settings');
    if (!isSettingsRoute && settingsOpen) {
      setSettingsOpen(false);
    }
  }, [location.pathname]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    supervisor: 'Supervisor',
    agent: 'Agente',
    viewer: 'Visualizador',
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Até logo!');
    navigate('/auth');
  };

  const handleSettingsClick = () => {
    if (settingsOpen) {
      setSettingsOpen(false);
    } else {
      setSettingsOpen(true);
      navigate('/settings/general');
    }
    onNavigate?.();
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <div className="flex h-full">
      <div 
        className={cn(
          'h-full bg-sidebar flex flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">
                Multiatendimento
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          {showCollapseButton && onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(
                "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                collapsed && "hidden"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Company Info */}
        {!collapsed && company && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sidebar-accent rounded-lg flex items-center justify-center overflow-hidden">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover object-top" />
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
          {baseMenuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/inbox' && location.pathname.startsWith('/inbox'));
            
            // Get badge count - use red for Conversas
            const badgeCount = item.badgeKey 
              ? unreadCounts[item.badgeKey as keyof typeof unreadCounts] || 0
              : 0;
            
            const NavItem = (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  'sidebar-link relative',
                  isActive && 'active'
                )}
              >
                <item.icon className={cn('w-5 h-5 flex-shrink-0')} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="text-xs px-2 py-0.5"
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {NavItem}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    {item.label}
                    {badgeCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return NavItem;
          })}

          {/* Settings Item - Special handling */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSettingsClick}
                  className={cn(
                    'sidebar-link w-full',
                    isSettingsActive && 'active'
                  )}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Configurações
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSettingsClick}
              className={cn(
                'sidebar-link w-full text-left',
                isSettingsActive && 'active'
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">Configurações</span>
            </button>
          )}
        </nav>

        {/* Notifications Bell - Above Internal Chat */}
        <div className={cn("px-3 pb-1", collapsed && "pb-1")}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="sidebar-link w-full flex items-center justify-center gap-0 relative"
                >
                  <Bell className="w-5 h-5 flex-shrink-0 text-sidebar-foreground" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {totalNotifications > 9 ? '9+' : totalNotifications}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                Notificações
                {totalNotifications > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {totalNotifications > 99 ? '99+' : totalNotifications}
                  </Badge>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => setNotificationsOpen(true)}
              className="sidebar-link w-full text-left relative"
            >
              <Bell className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">Notificações</span>
              {totalNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="text-xs px-2 py-0.5"
                >
                  {totalNotifications > 99 ? '99+' : totalNotifications}
                </Badge>
              )}
            </button>
          )}
        </div>

        {/* Internal Chat */}
        <div className={cn("px-3 pb-2", collapsed && "pb-1")}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to="/internal-chat"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      "sidebar-link w-full flex items-center justify-center gap-0 relative z-20 text-sidebar-foreground",
                      isActive && "sidebar-link-internal-chat-active"
                    )
                  }
                >
                  <MessageSquare className="w-5 h-5 flex-shrink-0 text-sidebar-foreground" />
                  {unreadCounts.internalChat > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCounts.internalChat > 9 ? '9+' : unreadCounts.internalChat}
                    </span>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                Chat Interno
                {unreadCounts.internalChat > 0 && (
                  <Badge variant="secondary" className="text-xs bg-emerald-500 text-white">
                    {unreadCounts.internalChat > 99 ? '99+' : unreadCounts.internalChat}
                  </Badge>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/internal-chat"
              onClick={handleNavClick}
              className={({ isActive }) => cn(
                'sidebar-link',
                isActive && 'sidebar-link-internal-chat-active'
              )}
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">Chat Interno</span>
              {unreadCounts.internalChat > 0 && (
                <Badge 
                  variant="secondary" 
                  className="bg-emerald-500 text-white text-xs px-2 py-0.5"
                >
                  {unreadCounts.internalChat > 99 ? '99+' : unreadCounts.internalChat}
                </Badge>
              )}
            </NavLink>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && showCollapseButton && onToggleCollapse && (
          <div className="px-3 pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* User Section */}
        <div className={cn(
          "border-t border-sidebar-border p-4",
          collapsed && "px-3"
        )}>
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center gap-3 w-full rounded-lg p-2 hover:bg-sidebar-accent transition-colors",
                  collapsed && "justify-center p-1"
                )}>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={profile.avatar_url || undefined} className="object-cover object-top" />
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {profile.full_name}
                      </p>
                      <p className="text-xs text-sidebar-foreground/60">
                        {userRole ? roleLabels[userRole.role] : ''}
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
                <DropdownMenuItem onClick={() => setProfileModalOpen(true)}>
                  <User className="w-4 h-4 mr-2" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { navigate('/settings/general'); onNavigate?.(); }}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <ThemeToggleMenuItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Settings Submenu */}
      <SettingsSubmenu 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        sidebarCollapsed={collapsed}
      />

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        internalNotifications={internalNotifications}
        whatsappNotifications={whatsappNotifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    </div>
  );
}
