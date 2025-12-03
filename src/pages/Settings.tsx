import { useState } from 'react';
import { 
  Building2, 
  Users, 
  MessageSquare, 
  Link2, 
  Bell, 
  Shield,
  CreditCard,
  Palette,
  Save,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/hooks/use-toast';

export default function Settings() {
  const { company, user } = useAppStore();
  const [companyName, setCompanyName] = useState(company?.name || '');

  const handleSave = () => {
    toast({
      title: 'Configurações salvas',
      description: 'Suas alterações foram salvas com sucesso.',
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua conta e empresa
          </p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Faturamento</span>
            </TabsTrigger>
          </TabsList>

          {/* Company Settings */}
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>
                  Configure as informações básicas da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo */}
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={company?.logoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {company?.name?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Alterar Logo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG ou SVG. Máximo 2MB.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Company Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nome da Empresa</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-slug">Slug (URL)</Label>
                    <Input
                      id="company-slug"
                      value={company?.slug || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company-description">Descrição</Label>
                  <Textarea
                    id="company-description"
                    placeholder="Uma breve descrição da sua empresa..."
                    className="min-h-[100px]"
                  />
                </div>

                <Separator />

                {/* Business Hours */}
                <div className="space-y-4">
                  <h4 className="font-medium">Horário de Atendimento</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dias úteis</Label>
                      <div className="flex gap-2">
                        <Select defaultValue="09:00">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Início" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                                {`${String(i).padStart(2, '0')}:00`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="flex items-center text-muted-foreground">até</span>
                        <Select defaultValue="18:00">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Fim" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                                {`${String(i).padStart(2, '0')}:00`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Sábados</Label>
                      <div className="flex gap-2">
                        <Select defaultValue="09:00">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Início" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                                {`${String(i).padStart(2, '0')}:00`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="flex items-center text-muted-foreground">até</span>
                        <Select defaultValue="13:00">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Fim" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                                {`${String(i).padStart(2, '0')}:00`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure como você deseja receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações de Desktop</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações no navegador quando novas mensagens chegarem
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Som de Notificação</Label>
                    <p className="text-sm text-muted-foreground">
                      Toque um som quando novas mensagens chegarem
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por E-mail</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba um resumo diário por e-mail
                    </p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificar conversas sem atendente</Label>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando conversas não forem atribuídas
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Settings */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Equipe</CardTitle>
                <CardDescription>
                  Adicione e gerencie os membros da sua equipe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {1} membro(s) na equipe
                  </p>
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Convidar Membro
                  </Button>
                </div>
                <Separator />
                
                {/* Team Member */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user?.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user?.fullName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user?.fullName}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground capitalize">
                      {user?.role}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Settings */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plano Atual</CardTitle>
                <CardDescription>
                  Gerencie sua assinatura e faturamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg capitalize">
                        Plano {company?.plan}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Até 50 usuários • Integrações ilimitadas
                      </p>
                    </div>
                    <Button variant="outline">
                      Alterar Plano
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Uso Atual</h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-4 rounded-lg border">
                      <p className="text-2xl font-bold">1</p>
                      <p className="text-sm text-muted-foreground">de 50 usuários</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-2xl font-bold">156</p>
                      <p className="text-sm text-muted-foreground">conversas este mês</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-2xl font-bold">1</p>
                      <p className="text-sm text-muted-foreground">conexão WhatsApp</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
