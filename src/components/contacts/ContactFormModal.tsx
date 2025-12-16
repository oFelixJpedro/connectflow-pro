import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Loader2, LayoutGrid, Trash2, Smartphone, AlertTriangle, Users, Paperclip, MessageSquare, Image, Video, FileText, Mic } from 'lucide-react';
import { Contact, ContactFormData } from '@/hooks/useContactsData';
import { useContactCRM } from '@/hooks/useContactCRM';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  tags: { id: string; name: string; color: string }[];
  onSave: (data: ContactFormData) => Promise<boolean | string>; // string = new contact ID
  preselectedConnectionId?: string | null;
}

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
}

interface Department {
  id: string;
  name: string;
  whatsapp_connection_id: string;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Média', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-700' },
];

const MEDIA_TYPES = [
  { type: 'image', label: 'Imagem', icon: Image, accept: 'image/*' },
  { type: 'video', label: 'Vídeo', icon: Video, accept: 'video/*' },
  { type: 'audio', label: 'Áudio', icon: Mic, accept: 'audio/*' },
  { type: 'document', label: 'Documento', icon: FileText, accept: '*/*' },
];

export function ContactFormModal({
  open,
  onOpenChange,
  contact,
  tags,
  onSave,
  preselectedConnectionId
}: ContactFormModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone_number: '',
    email: '',
    tags: [],
    notes: ''
  });

  // New contact fields
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [initialMessage, setInitialMessage] = useState('');
  const [initialMessageMedia, setInitialMessageMedia] = useState<{
    type: 'image' | 'video' | 'audio' | 'document';
    file: File;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');

  // Migration state - Connection
  const [allConnections, setAllConnections] = useState<WhatsAppConnection[]>([]);
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null);
  const [connectionMigrationEnabled, setConnectionMigrationEnabled] = useState(false);
  const [targetConnectionId, setTargetConnectionId] = useState<string>('');
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ContactFormData | null>(null);

  // Migration state - Department
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<string | null>(null);
  const [departmentMigrationEnabled, setDepartmentMigrationEnabled] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetConnectionDepartmentId, setTargetConnectionDepartmentId] = useState<string>('');

  // CRM state
  const {
    connections,
    boards,
    currentPosition,
    loading: crmLoading,
    setCardPosition,
    removeFromCRM
  } = useContactCRM(contact?.id || null);

  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [kanbanChanged, setKanbanChanged] = useState(false);

  // Track original values to detect changes
  const [originalColumn, setOriginalColumn] = useState<string>('');
  const [originalPriority, setOriginalPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  // Load all connections and departments
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.company_id) return;
      
      const [connectionsRes, departmentsRes] = await Promise.all([
        supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number')
          .eq('company_id', profile.company_id)
          .eq('status', 'connected')
          .order('name'),
        supabase
          .from('departments')
          .select('id, name, whatsapp_connection_id')
          .eq('active', true)
          .order('name')
      ]);
      
      if (connectionsRes.data) {
        setAllConnections(connectionsRes.data);
      }
      if (departmentsRes.data) {
        // Filter to only departments from user's company connections
        const companyConnectionIds = connectionsRes.data?.map(c => c.id) || [];
        const filteredDepts = departmentsRes.data.filter(d => 
          companyConnectionIds.includes(d.whatsapp_connection_id)
        );
        setAllDepartments(filteredDepts);
      }
    };
    
    if (open) {
      loadData();
    }
  }, [open, profile?.company_id]);

  // Load current connection and department for the contact
  useEffect(() => {
    const loadContactData = async () => {
      if (!contact?.id) {
        setCurrentConnectionId(null);
        setCurrentDepartmentId(null);
        return;
      }
      
      // Get the connection and department from the contact's most recent conversation
      const { data } = await supabase
        .from('conversations')
        .select('whatsapp_connection_id, department_id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setCurrentConnectionId(data.whatsapp_connection_id);
        setCurrentDepartmentId(data.department_id);
      } else {
        setCurrentConnectionId(null);
        setCurrentDepartmentId(null);
      }
    };
    
    if (open && contact) {
      loadContactData();
    }
  }, [open, contact?.id]);

  // Reset migration state when modal opens/closes
  useEffect(() => {
    if (open) {
      setConnectionMigrationEnabled(false);
      setTargetConnectionId('');
      setTargetConnectionDepartmentId('');
      setDepartmentMigrationEnabled(false);
      setTargetDepartmentId('');
      setKanbanChanged(false);
      // Reset new contact fields
      setInitialMessage('');
      setInitialMessageMedia(null);
      // Pre-select connection if provided
      if (!contact && preselectedConnectionId) {
        setSelectedConnectionId(preselectedConnectionId);
      } else if (!contact) {
        setSelectedConnectionId('');
      }
    }
  }, [open, contact, preselectedConnectionId]);

  // Initialize form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        phone_number: contact.phone_number || '',
        email: contact.email || '',
        tags: contact.tags || [],
        notes: contact.notes || ''
      });
    } else {
      setFormData({
        name: '',
        phone_number: '',
        email: '',
        tags: [],
        notes: ''
      });
    }
  }, [contact, open]);

  // Initialize CRM selection when position loads
  useEffect(() => {
    if (currentPosition) {
      setSelectedColumn(currentPosition.column_id);
      setSelectedPriority(currentPosition.priority);
      setOriginalColumn(currentPosition.column_id);
      setOriginalPriority(currentPosition.priority);
      setCrmEnabled(true);
    } else {
      setCrmEnabled(false);
      setOriginalColumn('');
      setOriginalPriority('medium');
    }
  }, [currentPosition]);

  // Detect kanban changes
  useEffect(() => {
    if (!currentPosition) {
      setKanbanChanged(crmEnabled);
    } else {
      const columnChanged = selectedColumn !== originalColumn;
      const priorityChanged = selectedPriority !== originalPriority;
      setKanbanChanged(columnChanged || priorityChanged || !crmEnabled);
    }
  }, [selectedColumn, selectedPriority, crmEnabled, currentPosition, originalColumn, originalPriority]);

  // Check if connection migration is active (user intends to migrate connection)
  const isConnectionMigrationActive = connectionMigrationEnabled;
  
  // Check if department or CRM changes are active (blocking connection migration)
  // crmEnabled = true means user wants to KEEP in current CRM, so block connection migration
  const isDepartmentOrCrmActive = departmentMigrationEnabled || crmEnabled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phone_number.replace(/\D/g, '')) {
      return;
    }

    // For new contacts, connection is mandatory
    if (!contact && !selectedConnectionId) {
      return;
    }

    // If connection migration is enabled, show confirmation
    if (isConnectionMigrationActive) {
      setPendingFormData(formData);
      setShowMigrationConfirm(true);
      return;
    }

    await executeSubmit(formData);
  };

  const executeSubmit = async (data: ContactFormData) => {
    setLoading(true);
    
    // For new contacts, include connection and initial message data
    const submitData: ContactFormData = { ...data };
    if (!contact) {
      submitData.connectionId = selectedConnectionId;
      if (initialMessage.trim()) {
        submitData.initialMessage = initialMessage.trim();
      }
      if (initialMessageMedia) {
        submitData.initialMessageMedia = initialMessageMedia;
      }
    }
    
    const result = await onSave(submitData);
    const success = result === true || typeof result === 'string';
    const contactId = contact?.id || (typeof result === 'string' ? result : null);
    
    const connectionChanging = connectionMigrationEnabled && targetConnectionId && targetConnectionId !== currentConnectionId;
    const departmentChanging = departmentMigrationEnabled && targetDepartmentId && targetDepartmentId !== currentDepartmentId;

    // Handle connection migration first
    if (success && contactId && connectionChanging) {
      // Update all conversations for this contact to the new connection and department
      const updateData: { whatsapp_connection_id: string; department_id?: string } = { 
        whatsapp_connection_id: targetConnectionId 
      };
      
      // If a department was selected for the new connection, set it
      if (targetConnectionDepartmentId) {
        updateData.department_id = targetConnectionDepartmentId;
      }
      
      await supabase
        .from('conversations')
        .update(updateData)
        .eq('contact_id', contactId);
      
      // Remove from old kanban and add to first column of new kanban
      if (currentPosition) {
        await removeFromCRM(contactId);
      }
      
      // Get the first column of the new connection's board
      const newBoard = boards.get(targetConnectionId);
      if (newBoard && newBoard.columns.length > 0) {
        const firstColumn = newBoard.columns[0];
        await setCardPosition(contactId, targetConnectionId, firstColumn.id, 'medium');
      } else {
        // Try to get board from database if not in cache
        const { data: boardData } = await supabase
          .from('kanban_boards')
          .select('id')
          .eq('whatsapp_connection_id', targetConnectionId)
          .single();
        
        if (boardData) {
          const { data: columnsData } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', boardData.id)
            .order('position')
            .limit(1);
          
          if (columnsData && columnsData.length > 0) {
            await setCardPosition(contactId, targetConnectionId, columnsData[0].id, 'medium');
          }
        }
      }
    }
    // Handle department migration
    else if (success && contactId && departmentChanging) {
      await supabase
        .from('conversations')
        .update({ department_id: targetDepartmentId })
        .eq('contact_id', contactId);
    }
    
    // Handle CRM changes (only if not migrating connection)
    if (success && contactId && !connectionChanging && contact) {
      if (crmEnabled && currentConnectionId && selectedColumn) {
        await setCardPosition(contactId, currentConnectionId, selectedColumn, selectedPriority);
      } else if (!crmEnabled && currentPosition) {
        await removeFromCRM(contactId);
      }
    }

    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const handleMigrationConfirm = async () => {
    setShowMigrationConfirm(false);
    if (pendingFormData) {
      await executeSubmit(pendingFormData);
      setPendingFormData(null);
    }
  };

  const handleMigrationCancel = () => {
    setShowMigrationConfirm(false);
    setPendingFormData(null);
  };

  const toggleTag = (tagName: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }));
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handleFileSelect = (type: 'image' | 'video' | 'audio' | 'document') => {
    setMediaType(type);
    const mediaConfig = MEDIA_TYPES.find(m => m.type === type);
    if (fileInputRef.current && mediaConfig) {
      fileInputRef.current.accept = mediaConfig.accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInitialMessageMedia({
        type: mediaType,
        file
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = () => {
    setInitialMessageMedia(null);
  };

  // Get columns for current connection's board
  const currentBoard = currentConnectionId ? boards.get(currentConnectionId) : null;
  const availableColumns = currentBoard?.columns || [];
  
  const currentConnection = allConnections.find(c => c.id === currentConnectionId);
  const targetConnection = allConnections.find(c => c.id === targetConnectionId);
  const availableConnectionsForMigration = allConnections.filter(c => c.id !== currentConnectionId);
  
  const currentDepartment = allDepartments.find(d => d.id === currentDepartmentId);
  const targetDepartment = allDepartments.find(d => d.id === targetDepartmentId);
  // Only show departments from current connection
  const availableDepartmentsForMigration = allDepartments.filter(
    d => d.whatsapp_connection_id === currentConnectionId && d.id !== currentDepartmentId
  );
  // Departments for target connection (when migrating connection)
  const targetConnectionDepartments = allDepartments.filter(
    d => d.whatsapp_connection_id === targetConnectionId
  );
  

  // Require department selection when migrating connection and target has departments
  const needsDepartmentSelection = isConnectionMigrationActive && 
    targetConnectionId && 
    targetConnectionDepartments.length > 0 && 
    !targetConnectionDepartmentId;

  // For new contacts, connection must be selected
  const needsConnectionForNewContact = !contact && !selectedConnectionId;

  const canSave = !loading && !needsDepartmentSelection && !needsConnectionForNewContact;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {contact ? 'Editar Contato' : 'Novo Contato'}
            </DialogTitle>
            <DialogDescription>
              {contact 
                ? 'Atualize as informações do contato'
                : 'Preencha as informações para criar um novo contato'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do contato"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={formatPhoneNumber(formData.phone_number)}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            {/* Connection Selection - Only for new contacts */}
            {!contact && (
              <div className="space-y-2">
                <Label htmlFor="connection">Conexão WhatsApp *</Label>
                <Select
                  value={selectedConnectionId}
                  onValueChange={setSelectedConnectionId}
                >
                  <SelectTrigger id="connection">
                    <SelectValue placeholder="Selecione uma conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {allConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.name} ({conn.phone_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allConnections.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma conexão disponível. Conecte um WhatsApp primeiro.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={formData.tags.includes(tag.name) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    style={formData.tags.includes(tag.name) ? { backgroundColor: tag.color } : {}}
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                    {formData.tags.includes(tag.name) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre o contato..."
                rows={3}
              />
            </div>

            {/* Initial Message Section - Only for new contacts */}
            {!contact && selectedConnectionId && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Mensagem Inicial (Opcional)</Label>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Envie uma mensagem ao criar o contato
                  </p>

                  <div className="space-y-3">
                    <Textarea
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Digite uma mensagem para enviar ao contato..."
                      rows={3}
                    />

                    {/* Media attachment */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {MEDIA_TYPES.map((media) => (
                          <Button
                            key={media.type}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileSelect(media.type as typeof mediaType)}
                            className="h-8 px-2"
                            title={media.label}
                          >
                            <media.icon className="w-4 h-4" />
                          </Button>
                        ))}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* Selected media preview */}
                    {initialMessageMedia && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md overflow-hidden min-w-0">
                        <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate min-w-0 flex-1">
                          {initialMessageMedia.type === 'image' && 'Imagem'}
                          {initialMessageMedia.type === 'video' && 'Vídeo'}
                          {initialMessageMedia.type === 'audio' && 'Áudio'}
                          {initialMessageMedia.type === 'document' && 'Documento'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeMedia}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Connection Migration Section - Only for existing contacts */}
            {contact && currentConnectionId && allConnections.length > 1 && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Conexão Atual</Label>
                  </div>
                  
                  {currentConnection && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm font-medium">{currentConnection.name}</p>
                      <p className="text-xs text-muted-foreground">{currentConnection.phone_number}</p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="connection-migration-enabled"
                      checked={connectionMigrationEnabled}
                      disabled={isDepartmentOrCrmActive}
                      onCheckedChange={(checked) => {
                        setConnectionMigrationEnabled(checked === true);
                        if (!checked) {
                          setTargetConnectionId('');
                          setTargetConnectionDepartmentId('');
                        }
                      }}
                    />
                    <Label 
                      htmlFor="connection-migration-enabled" 
                      className={`text-sm font-normal cursor-pointer ${isDepartmentOrCrmActive ? 'text-muted-foreground' : ''}`}
                    >
                      Migrar para outra conexão
                    </Label>
                  </div>

                  {isDepartmentOrCrmActive && !connectionMigrationEnabled && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Desabilitado enquanto departamento ou CRM estiver sendo alterado
                    </p>
                  )}

                  {connectionMigrationEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label htmlFor="target-connection" className="text-sm">Nova Conexão</Label>
                        <Select
                          value={targetConnectionId}
                          onValueChange={(value) => {
                            setTargetConnectionId(value);
                            setTargetConnectionDepartmentId('');
                          }}
                        >
                          <SelectTrigger id="target-connection">
                            <SelectValue placeholder="Selecione a nova conexão" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableConnectionsForMigration.map((conn) => (
                              <SelectItem key={conn.id} value={conn.id}>
                                {conn.name} ({conn.phone_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {targetConnectionId && targetConnectionDepartments.length > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="target-connection-department" className="text-sm">Departamento na Nova Conexão</Label>
                          <Select
                            value={targetConnectionDepartmentId}
                            onValueChange={setTargetConnectionDepartmentId}
                          >
                            <SelectTrigger id="target-connection-department">
                              <SelectValue placeholder="Selecione o departamento" />
                            </SelectTrigger>
                            <SelectContent>
                              {targetConnectionDepartments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {targetConnectionId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-900/20 dark:border-amber-800">
                          <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            As conversas e o card do CRM serão migrados para a nova conexão
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Department Migration Section - Only for existing contacts when NOT migrating connection */}
            {contact && currentConnectionId && !isConnectionMigrationActive && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Departamento Atual</Label>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm font-medium">
                      {currentDepartment?.name || 'Sem departamento'}
                    </p>
                  </div>

                  {availableDepartmentsForMigration.length > 0 && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="department-migration-enabled"
                          checked={departmentMigrationEnabled}
                          onCheckedChange={(checked) => {
                            setDepartmentMigrationEnabled(checked === true);
                            if (!checked) {
                              setTargetDepartmentId('');
                            }
                          }}
                        />
                        <Label 
                          htmlFor="department-migration-enabled" 
                          className="text-sm font-normal cursor-pointer"
                        >
                          Migrar para outro departamento
                        </Label>
                      </div>

                      {departmentMigrationEnabled && (
                        <div className="space-y-3 pl-6 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label htmlFor="target-department" className="text-sm">Novo Departamento</Label>
                            <Select
                              value={targetDepartmentId}
                              onValueChange={setTargetDepartmentId}
                            >
                              <SelectTrigger id="target-department">
                                <SelectValue placeholder="Selecione o novo departamento" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableDepartmentsForMigration.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {targetDepartmentId && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-900/20 dark:border-blue-800">
                              <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                As conversas serão migradas para o novo departamento
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* CRM Section - Only show if current connection has a board AND not migrating connection */}
            {contact && currentConnectionId && availableColumns.length > 0 && !isConnectionMigrationActive && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Posição no CRM</Label>
                    </div>
                    {crmLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : currentPosition ? (
                      <Badge variant="secondary" className="text-xs">
                        {currentPosition.column_name}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="crm-enabled"
                      checked={crmEnabled}
                      onCheckedChange={(checked) => setCrmEnabled(checked === true)}
                    />
                    <Label htmlFor="crm-enabled" className="text-sm font-normal cursor-pointer">
                      {currentPosition ? 'Manter no Kanban do CRM' : 'Adicionar ao Kanban do CRM'}
                    </Label>
                  </div>

                  {crmEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label htmlFor="column" className="text-sm">Coluna</Label>
                        <Select
                          value={selectedColumn}
                          onValueChange={setSelectedColumn}
                        >
                          <SelectTrigger id="column">
                            <SelectValue placeholder="Selecione a coluna" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: col.color }}
                                  />
                                  {col.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority" className="text-sm">Prioridade</Label>
                        <Select
                          value={selectedPriority}
                          onValueChange={(v) => setSelectedPriority(v as typeof selectedPriority)}
                        >
                          <SelectTrigger id="priority">
                            <SelectValue placeholder="Selecione a prioridade" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={opt.color}>
                                    {opt.label}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {currentPosition && !crmEnabled && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      O card será removido do CRM ao salvar
                    </p>
                  )}
                </div>
              </>
            )}


            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSave}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {contact ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Migration Confirmation Dialog */}
      <AlertDialog open={showMigrationConfirm} onOpenChange={setShowMigrationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Migração de Conexão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a migrar este contato para outra conexão WhatsApp.</p>
                
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">De:</span>
                    <span className="font-medium">{currentConnection?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Para:</span>
                    <span className="font-medium">{targetConnection?.name}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-900/20 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Atenção:</strong> Todas as conversas deste contato serão transferidas para a nova conexão e o card do CRM será movido para a primeira coluna do novo Kanban.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMigrationCancel}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMigrationConfirm}>
              Confirmar Migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
