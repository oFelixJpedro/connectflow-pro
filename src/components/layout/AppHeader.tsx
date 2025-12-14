import { Menu, MessageSquare } from 'lucide-react';
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
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';

interface AppHeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export function AppHeader({ title, onMenuClick }: AppHeaderProps) {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const { unreadCounts } = useNotifications();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-14 md:h-16 bg-card border-b border-border px-3 md:px-4 flex items-center justify-between gap-2 md:gap-4">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        {title && (
          <h1 className="text-base md:text-lg font-semibold text-foreground truncate">
            {title}
          </h1>
        )}
      </div>

      <div className="flex-1 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/internal-chat')}
          className="flex items-center gap-1 md:gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 relative px-2 md:px-3"
        >
          <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
          <span className="hidden sm:inline text-xs md:text-sm">Chat Interno</span>
          {unreadCounts.internalChat > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 p-0 flex items-center justify-center text-[10px] md:text-xs"
            >
              {unreadCounts.internalChat > 99 ? '99+' : unreadCounts.internalChat}
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
                <Avatar className="w-7 h-7 md:w-8 md:h-8">
                  <AvatarImage src={user.avatarUrl} className="object-cover object-top" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs md:text-sm">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
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
