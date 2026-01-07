import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Trash2, 
  Loader2,
  FileText,
  Mail,
  Phone,
  Calendar,
  Hash,
  Link,
  Building,
  User,
  MapPin,
  Briefcase
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ManageCustomFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldsChanged?: () => void;
}

interface CustomFieldDefinition {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  icon: string;
  position: number;
  is_required: boolean;
  active: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'date', label: 'Data' },
  { value: 'number', label: 'Número' },
  { value: 'url', label: 'URL' },
];

const ICONS = [
  { value: 'FileText', label: 'Documento', icon: FileText },
  { value: 'Mail', label: 'E-mail', icon: Mail },
  { value: 'Phone', label: 'Telefone', icon: Phone },
  { value: 'Calendar', label: 'Calendário', icon: Calendar },
  { value: 'Hash', label: 'Número', icon: Hash },
  { value: 'Link', label: 'Link', icon: Link },
  { value: 'Building', label: 'Empresa', icon: Building },
  { value: 'User', label: 'Pessoa', icon: User },
  { value: 'MapPin', label: 'Localização', icon: MapPin },
  { value: 'Briefcase', label: 'Trabalho', icon: Briefcase },
];

export function ManageCustomFieldsModal({ 
  open, 
  onOpenChange,
  onFieldsChanged 
}: ManageCustomFieldsModalProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New field form
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldIcon, setNewFieldIcon] = useState('FileText');

  // Load fields
  useEffect(() => {
    if (open) {
      loadFields();
    }
  }, [open]);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('[ManageCustomFieldsModal] Error loading fields:', error);
      toast({
        title: 'Erro ao carregar campos',
        description: 'Não foi possível carregar os campos personalizados.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateFieldKey = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, ''); // Trim underscores
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para o campo.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.company_id) return;

    const fieldKey = generateFieldKey(newFieldName);
    
    // Check if key already exists
    if (fields.some(f => f.field_key === fieldKey)) {
      toast({
        title: 'Campo já existe',
        description: 'Já existe um campo com esse nome.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .insert({
          company_id: profile.company_id,
          name: newFieldName.trim(),
          field_key: fieldKey,
          field_type: newFieldType,
          icon: newFieldIcon,
          position: fields.length,
        });

      if (error) throw error;

      toast({
        title: 'Campo criado',
        description: `O campo \"${newFieldName}\" foi criado com sucesso.`,
      });

      // Reset form
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldIcon('FileText');
      
      // Reload
      await loadFields();
      onFieldsChanged?.();
    } catch (error) {
      console.error('[ManageCustomFieldsModal] Error creating field:', error);
      toast({
        title: 'Erro ao criar campo',
        description: 'Não foi possível criar o campo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (field: CustomFieldDefinition) => {
    setIsSaving(true);
    try {
      // Soft delete - just set active to false
      const { error } = await supabase
        .from('custom_field_definitions')
        .update({ active: false })
        .eq('id', field.id);

      if (error) throw error;

      toast({
        title: 'Campo removido',
        description: `O campo \"${field.name}\" foi removido.`,
      });

      await loadFields();
      onFieldsChanged?.();
    } catch (error) {
      console.error('[ManageCustomFieldsModal] Error deleting field:', error);
      toast({
        title: 'Erro ao remover campo',
        description: 'Não foi possível remover o campo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconData = ICONS.find(i => i.value === iconName);
    if (iconData) {
      const IconComponent = iconData.icon;
      return <IconComponent className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const getFieldTypeLabel = (type: string) => {
    return FIELD_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Campos Personalizados</DialogTitle>
          <DialogDescription>
            Crie campos que aparecerão em todos os contatos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create new field */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Novo Campo</h4>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome do campo</Label>
                <Input
                  placeholder="Ex: CPF, Empresa, Cargo..."
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={newFieldType} onValueChange={setNewFieldType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <Select value={newFieldIcon} onValueChange={setNewFieldIcon}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center gap-2">
                            <icon.icon className="w-4 h-4" />
                            {icon.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleAddField} 
                disabled={isSaving || !newFieldName.trim()}
                className="w-full"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Adicionar Campo
              </Button>
            </div>
          </div>

          {/* Existing fields */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Campos Existentes</h4>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum campo personalizado criado ainda.
              </p>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div 
                      key={field.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                          {getIconComponent(field.icon)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{field.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {getFieldTypeLabel(field.field_type)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteField(field)}
                        disabled={isSaving}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
