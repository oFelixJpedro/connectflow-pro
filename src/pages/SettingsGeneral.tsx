import { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Bell, 
  CreditCard,
  Save,
  Upload,
  Loader2,
  Volume2
} from 'lucide-react';
import { playNotificationSound } from '@/hooks/useNotifications';
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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BusinessHours {
  enabled: boolean;
  timezone: string;
  schedule: {
    monday: { open: string | null; close: string | null };
    tuesday: { open: string | null; close: string | null };
    wednesday: { open: string | null; close: string | null };
    thursday: { open: string | null; close: string | null };
    friday: { open: string | null; close: string | null };
    saturday: { open: string | null; close: string | null };
    sunday: { open: string | null; close: string | null };
  };
}

interface CompanySettings {
  businessHours: BusinessHours;
  description?: string;
}

interface NotificationSettings {
  whatsappSoundNotifications: boolean;
  internalChatSoundNotifications: boolean;
}

const defaultBusinessHours: BusinessHours = {
  enabled: true,
  timezone: 'America/Sao_Paulo',
  schedule: {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: { open: null, close: null },
  },
};

const defaultNotificationSettings: NotificationSettings = {
  whatsappSoundNotifications: true,
  internalChatSoundNotifications: true,
};

export default function SettingsGeneral() {
  const { company, profile, userRole, updateCompany, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if user is owner or admin
  const isOwnerOrAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';
  
  // Company state
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours);
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotificationSettings);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Load company data
  useEffect(() => {
    if (company) {
      setCompanyName(company.name || '');
      setCompanyLogo(company.logo_url);
      
      const settings = company.settings as unknown as CompanySettings | null;
      if (settings) {
        setCompanyDescription(settings.description || '');
        if (settings.businessHours) {
          setBusinessHours(settings.businessHours);
        }
      }
    }
  }, [company]);

  // Load notification preferences from profile metadata
  useEffect(() => {
    if (profile?.metadata) {
      const metadata = profile.metadata as { notifications?: NotificationSettings };
      if (metadata.notifications) {
        setNotifications(metadata.notifications);
      }
    }
  }, [profile]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem (PNG, JPG ou SVG).',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${company.id}/logo.${fileExt}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update company with new logo URL
      const { error: updateError } = await updateCompany({ logo_url: publicUrl });
      if (updateError) throw updateError;

      setCompanyLogo(publicUrl);
      toast({
        title: 'Logo atualizado',
        description: 'O logo da empresa foi atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: 'Não foi possível enviar o logo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!company) return;

    setSavingCompany(true);
    try {
      const currentSettings = (company.settings as unknown as CompanySettings) || {};
      const newSettings: CompanySettings = {
        ...currentSettings,
        description: companyDescription,
        businessHours,
      };

      const { error } = await updateCompany({
        name: companyName,
        settings: newSettings as any,
      });

      if (error) throw error;

      toast({
        title: 'Configurações salvas',
        description: 'As informações da empresa foram atualizadas.',
      });
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const currentMetadata = (profile?.metadata as Record<string, any>) || {};
      const newMetadata = {
        ...currentMetadata,
        notifications,
      };

      const { error } = await updateProfile({
        metadata: newMetadata as any,
      });

      if (error) throw error;

      toast({
        title: 'Preferências salvas',
        description: 'Suas preferências de notificação foram atualizadas.',
      });
    } catch (error) {
      console.error('Error saving notifications:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as preferências.',
        variant: 'destructive',
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const updateBusinessHour = (
    day: keyof BusinessHours['schedule'],
    field: 'open' | 'close',
    value: string
  ) => {
    setBusinessHours((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações Gerais</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua conta e empresa
          </p>
        </div>

        <Tabs defaultValue={isOwnerOrAdmin ? "company" : "notifications"} className="space-y-6">
          <TabsList className={`grid w-full lg:w-auto lg:inline-flex ${isOwnerOrAdmin ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {isOwnerOrAdmin && (
              <TabsTrigger value="company" className="gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Empresa</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            {isOwnerOrAdmin && (
              <TabsTrigger value="billing" className="gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Faturamento</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Company Settings */}
          {isOwnerOrAdmin && (
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
                    <AvatarImage src={companyLogo || undefined} className="object-cover object-top" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {companyName?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploadingLogo ? 'Enviando...' : 'Alterar Logo'}
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
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                  />
                </div>

                <Separator />

                {/* Business Hours */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Horário de Atendimento</h4>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="business-hours-enabled" className="text-sm text-muted-foreground">
                        Ativo
                      </Label>
                      <Switch
                        id="business-hours-enabled"
                        checked={businessHours.enabled}
                        onCheckedChange={(checked) =>
                          setBusinessHours((prev) => ({ ...prev, enabled: checked }))
                        }
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dias úteis (Seg-Sex)</Label>
                      <div className="flex gap-2">
                        <Select 
                          value={businessHours.schedule.monday.open || '09:00'}
                          onValueChange={(value) => {
                            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach((day) => {
                              updateBusinessHour(day as keyof BusinessHours['schedule'], 'open', value);
                            });
                          }}
                        >
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
                        <Select 
                          value={businessHours.schedule.monday.close || '18:00'}
                          onValueChange={(value) => {
                            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach((day) => {
                              updateBusinessHour(day as keyof BusinessHours['schedule'], 'close', value);
                            });
                          }}
                        >
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
                        <Select 
                          value={businessHours.schedule.saturday.open || '09:00'}
                          onValueChange={(value) => updateBusinessHour('saturday', 'open', value)}
                        >
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
                        <Select 
                          value={businessHours.schedule.saturday.close || '13:00'}
                          onValueChange={(value) => updateBusinessHour('saturday', 'close', value)}
                        >
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
                  <Button onClick={handleSaveCompany} disabled={savingCompany}>
                    {savingCompany ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {savingCompany ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure como você deseja receber notificações sonoras
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* WhatsApp Sound */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Som de Notificação - WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Toque um som quando novas mensagens de clientes chegarem
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => playNotificationSound()}
                      className="gap-1"
                    >
                      <Volume2 className="w-3 h-3" />
                      Testar
                    </Button>
                    <Switch 
                      checked={notifications.whatsappSoundNotifications}
                      onCheckedChange={(checked) => 
                        setNotifications((prev) => ({ ...prev, whatsappSoundNotifications: checked }))
                      }
                    />
                  </div>
                </div>
                <Separator />
                
                {/* Internal Chat Sound */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Som de Notificação - Chat Interno</Label>
                    <p className="text-sm text-muted-foreground">
                      Toque um som quando mensagens da equipe chegarem
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => playNotificationSound()}
                      className="gap-1"
                    >
                      <Volume2 className="w-3 h-3" />
                      Testar
                    </Button>
                    <Switch 
                      checked={notifications.internalChatSoundNotifications}
                      onCheckedChange={(checked) => 
                        setNotifications((prev) => ({ ...prev, internalChatSoundNotifications: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
                    {savingNotifications ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {savingNotifications ? 'Salvando...' : 'Salvar Preferências'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Settings (Mockup) */}
          {isOwnerOrAdmin && (
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
          )}
        </Tabs>
      </div>
    </div>
  );
}