import { RefreshCw, Link2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

export function GoogleCalendarConnect() {
  const {
    googleConnection,
    isConnected,
    isLoading,
    isSyncing,
    canManageConnection,
    connectGoogle,
    disconnectGoogle,
    syncEvents,
  } = useGoogleCalendar();

  if (!canManageConnection) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <RefreshCw className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (isConnected) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <img 
              src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" 
              alt="Google" 
              className="w-4 h-4"
            />
            <span className="hidden sm:inline">Sincronizado</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Google Calendar Conectado</span>
            </div>
            
            {googleConnection?.google_email && (
              <p className="text-sm text-muted-foreground">
                {googleConnection.google_email}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={syncEvents}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectGoogle}
              >
                <Link2Off className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={connectGoogle} className="gap-2">
      <img 
        src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" 
        alt="Google" 
        className="w-4 h-4"
      />
      <span className="hidden sm:inline">Conectar Google</span>
    </Button>
  );
}
