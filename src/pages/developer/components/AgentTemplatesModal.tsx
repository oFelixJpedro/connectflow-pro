import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Bot, 
  Save,
  X,
  Loader2,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { developerActions, developerData } from '@/lib/developerApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgentTemplate {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
  category: string | null;
  script_template: string | null;
  rules_template: string | null;
  faq_template: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface AgentTemplatesModalProps {
  open: boolean;
  onClose: () => void;
}

const AGENT_TYPES = [
  { value: 'sales', label: 'Vendas' },
  { value: 'support', label: 'Suporte' },
  { value: 'scheduling', label: 'Agendamento' },
  { value: 'qualification', label: 'Qualificação' },
  { value: 'general', label: 'Geral' },
];

const CATEGORIES = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'services', label: 'Serviços' },
  { value: 'healthcare', label: 'Saúde' },
  { value: 'education', label: 'Educação' },
  { value: 'real_estate', label: 'Imobiliário' },
  { value: 'general', label: 'Geral' },
];

export default function AgentTemplatesModal({ open, onClose }: AgentTemplatesModalProps) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_type: 'sales',
    category: 'general',
    script_template: '',
    rules_template: '',
    faq_template: '',
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await developerData({ action: 'list_templates' });
      
      if (error) {
        toast.error(error);
        return;
      }
      
      setTemplates(data?.templates || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error('Erro ao carregar templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      agent_type: 'sales',
      category: 'general',
      script_template: '',
      rules_template: '',
      faq_template: '',
      is_active: true,
    });
    setIsCreating(true);
    setEditingTemplate(null);
  };

  const handleEdit = (template: AgentTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      agent_type: template.agent_type,
      category: template.category || 'general',
      script_template: template.script_template || '',
      rules_template: template.rules_template || '',
      faq_template: template.faq_template || '',
      is_active: template.is_active,
    });
    setEditingTemplate(template);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      if (isCreating) {
        const { error } = await developerActions({
          action: 'create_template',
          template: formData,
        });

        if (error) {
          toast.error(error);
          return;
        }

        toast.success('Template criado com sucesso');
      } else if (editingTemplate) {
        const { error } = await developerActions({
          action: 'update_template',
          template_id: editingTemplate.id,
          updates: formData,
        });

        if (error) {
          toast.error(error);
          return;
        }

        toast.success('Template atualizado com sucesso');
      }

      handleCancel();
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (template: AgentTemplate) => {
    try {
      const { error } = await developerActions({
        action: 'toggle_template',
        template_id: template.id,
        is_active: !template.is_active,
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success(template.is_active ? 'Template desativado' : 'Template ativado');
      loadTemplates();
    } catch (err) {
      console.error('Error toggling template:', err);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (template: AgentTemplate) => {
    if (!confirm(`Excluir template "${template.name}"?`)) return;

    try {
      const { error } = await developerActions({
        action: 'delete_template',
        template_id: template.id,
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success('Template excluído');
      loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Erro ao excluir template');
    }
  };

  const getTypeBadge = (type: string) => {
    const config = AGENT_TYPES.find(t => t.value === type);
    return <Badge variant="secondary">{config?.label || type}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Templates de Agentes de IA
          </DialogTitle>
        </DialogHeader>

        {(isCreating || editingTemplate) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Vendedor de E-commerce"
                />
              </div>
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agent_type">Tipo de Agente</Label>
                <Select
                  value={formData.agent_type}
                  onValueChange={(value) => setFormData({ ...formData, agent_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Template ativo</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o propósito e comportamento do agente"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="script_template">Script / Roteiro Base</Label>
              <Textarea
                id="script_template"
                value={formData.script_template}
                onChange={(e) => setFormData({ ...formData, script_template: e.target.value })}
                placeholder="Instruções de como o agente deve se comportar..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="rules_template">Regras do Agente</Label>
              <Textarea
                id="rules_template"
                value={formData.rules_template}
                onChange={(e) => setFormData({ ...formData, rules_template: e.target.value })}
                placeholder="Regras e restrições do agente..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="faq_template">FAQ Base</Label>
              <Textarea
                id="faq_template"
                value={formData.faq_template}
                onChange={(e) => setFormData({ ...formData, faq_template: e.target.value })}
                placeholder="Perguntas e respostas frequentes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isCreating ? 'Criar Template' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum template cadastrado</p>
                  <Button className="mt-4" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeiro template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Usos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getTypeBadge(template.agent_type)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span>{template.usage_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
