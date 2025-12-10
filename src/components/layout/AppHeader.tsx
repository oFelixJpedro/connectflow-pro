import { Bell, Menu, MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { user, toggleSidebar, sidebarCollapsed } = useAppStore();
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCounts, 
    isLoading, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return '';
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    
    if (notification.type === 'whatsapp_message' && notification.conversationId) {
      navigate('/inbox');
    } else if (notification.type === 'internal_message' && notification.roomId) {
      navigate('/internal-chat');
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const totalUnread = unreadCounts.total;

  return (
    <header className="h-16 bg-card border-b border-border px-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        {title && (
          <h1 className="text-lg font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>

      <div className="flex-1 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/internal-chat')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 relative"
        >
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span className="hidden md:inline text-sm">Chat Interno</span>
          {unreadCounts.internalChat > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCounts.internalChat > 99 ? '99+' : unreadCounts.internalChat}
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {totalUnread > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              {unreadNotifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                {notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id}
                    className={`flex flex-col items-start gap-1 py-3 cursor-pointer ${
                      !notification.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-center text-primary cursor-pointer justify-center"
              onClick={() => navigate('/inbox')}
            >
              Ver todas as conversas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium">
                  {user.fullName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                Preferências
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
