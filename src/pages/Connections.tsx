import { useState } from 'react';
import { 
  Plus, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  QrCode,
  Settings,
  Trash2,
  MoreHorizontal,
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Connection {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  lastConnected?: string;
}

const mockConnections: Connection[] = [
  {
    id: '1',
    name: 'WhatsApp Principal',
    phoneNumber: '+55 11 99999-0001',
    status: 'connected',
    lastConnected: '2024-12-03T10:00:00Z',
  },
];

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>(mockConnections);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

  const handleAddConnection = () => {
    setShowQRCode(true);
    
    // Simulate QR code generation and connection
    setTimeout(() => {
      const newConnection: Connection = {
        id: `${Date.now()}`,
        name: newConnectionName || 'Nova Conexão',
        phoneNumber: '+55 11 99999-0002',
        status: 'connected',
        lastConnected: new Date().toISOString(),
      };
      setConnections([...connections, newConnection]);
      setIsAddDialogOpen(false);
      setShowQRCode(false);
      setNewConnectionName('');
      
      toast({
        title: 'Conexão estabelecida!',
        description: 'Seu WhatsApp foi conectado com sucesso.',
      });
    }, 3000);
  };

  const handleDisconnect = (id: string) => {
    setConnections(
      connections.map((c) =>
        c.id === id ? { ...c, status: 'disconnected' as const } : c
      )
    );
    toast({
      title: 'Desconectado',
      description: 'A conexão foi encerrada.',
    });
  };

  const handleReconnect = (id: string) => {
    setConnections(
      connections.map((c) =>
        c.id === id ? { ...c, status: 'connecting' as const } : c
      )
    );
    
    setTimeout(() => {
      setConnections(
        connections.map((c) =>
          c.id === id ? { ...c, status: 'connected' as const, lastConnected: new Date().toISOString() } : c
        )
      );
      toast({
        title: 'Reconectado',
        description: 'A conexão foi restabelecida.',
      });
    }, 2000);
  };

  const statusConfig = {
    connected: {
      label: 'Conectado',
      icon: Wifi,
      className: 'bg-success/10 text-success border-success/20',
    },
    disconnected: {
      label: 'Desconectado',
      icon: WifiOff,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    qr_ready: {
      label: 'Aguardando QR',
      icon: QrCode,
      className: 'bg-warning/10 text-warning border-warning/20',
    },
    connecting: {
      label: 'Conectando...',
      icon: RefreshCw,
      className: 'bg-info/10 text-info border-info/20',
    },
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões de WhatsApp
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp para conectar
              </DialogDescription>
            </DialogHeader>
            
            {!showQRCode ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="connection-name">Nome da Conexão</Label>
                  <Input
                    id="connection-name"
                    value={newConnectionName}
                    onChange={(e) => setNewConnectionName(e.target.value)}
                    placeholder="Ex: WhatsApp Vendas"
                  />
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="flex flex-col items-center">
                  {/* QR Code Placeholder */}
                  <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Gerando QR Code...
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Abra o WhatsApp no seu celular, vá em<br />
                    <strong>Configurações › Dispositivos conectados › Conectar dispositivo</strong>
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              {!showQRCode && (
                <Button onClick={handleAddConnection}>
                  Gerar QR Code
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Como funciona?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Conecte seu WhatsApp escaneando o QR Code. Uma vez conectado, todas as mensagens 
                serão sincronizadas automaticamente com a plataforma. Você pode conectar múltiplos 
                números WhatsApp de acordo com seu plano.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => {
          const status = statusConfig[connection.status];
          const StatusIcon = status.icon;
          
          return (
            <Card key={connection.id} className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      connection.status === 'connected' ? 'bg-success/10' : 'bg-muted'
                    )}>
                      <Smartphone className={cn(
                        'w-6 h-6',
                        connection.status === 'connected' ? 'text-success' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{connection.name}</h4>
                      <p className="text-sm text-muted-foreground">{connection.phoneNumber}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Settings className="w-4 h-4 mr-2" />
                        Configurações
                      </DropdownMenuItem>
                      {connection.status === 'connected' && (
                        <DropdownMenuItem onClick={() => handleDisconnect(connection.id)}>
                          <WifiOff className="w-4 h-4 mr-2" />
                          Desconectar
                        </DropdownMenuItem>
                      )}
                      {connection.status === 'disconnected' && (
                        <DropdownMenuItem onClick={() => handleReconnect(connection.id)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reconectar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={status.className}>
                      <StatusIcon className={cn(
                        'w-3 h-3 mr-1',
                        connection.status === 'connecting' && 'animate-spin'
                      )} />
                      {status.label}
                    </Badge>
                    {connection.status === 'connected' && (
                      <span className="text-xs text-muted-foreground">
                        Conectado há 2h
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Connection Card */}
        <Card 
          className="border-dashed cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <CardContent className="pt-6 flex flex-col items-center justify-center h-full min-h-[180px]">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Adicionar conexão</p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Conecte um novo número WhatsApp
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
