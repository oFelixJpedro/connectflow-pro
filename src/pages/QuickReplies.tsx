import { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Zap, 
  Edit2, 
  Trash2, 
  Copy,
  MoreHorizontal,
  FolderOpen,
  Loader2,
  Image,
  Video,
  Mic,
  FileText,
  X,
  Upload,
  Square,
  Pause,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuickRepliesData, QuickReply, QuickReplyMediaType, QuickReplyVisibility } from '@/hooks/useQuickRepliesData';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { VisibilityTabs } from '@/components/quick-replies/VisibilityTabs';
import { VisibilitySelector } from '@/components/quick-replies/VisibilitySelector';
import { VisibilityBadge } from '@/components/quick-replies/VisibilityBadge';

const defaultCategories = ['Saudações', 'Geral', 'Encerramento', 'Informações', 'Vendas', 'Suporte'];

// File types matching exactly what AttachmentMenu accepts for WhatsApp sending
const mediaTypeOptions: { value: QuickReplyMediaType; label: string; icon: React.ReactNode; accept: string }[] = [
  { value: 'text', label: 'Texto', icon: <FileText className="w-4 h-4" />, accept: '' },
  { value: 'image', label: 'Imagem', icon: <Image className="w-4 h-4" />, accept: 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp' },
  { value: 'video', label: 'Vídeo', icon: <Video className="w-4 h-4" />, accept: 'video/mp4,video/avi,video/x-msvideo,video/quicktime,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm' },
  { value: 'audio', label: 'Áudio', icon: <Mic className="w-4 h-4" />, accept: 'audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/aac,audio/x-m4a,.mp3,.ogg,.wav,.webm,.aac,.m4a' },
  { value: 'document', label: 'Documento', icon: <FileText className="w-4 h-4" />, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.h,.sql,.sh,.bat,.log,.ini,.cfg,.yaml,.yml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,text/html,text/css,text/javascript,application/json,application/xml,application/zip,application/x-rar-compressed,application/octet-stream' },
];

// Helper to format recording time
const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface Department {
  id: string;
  name: string;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

export default function QuickReplies() {
  const { profile } = useAuth();
  const { 
    quickReplies, 
    loading, 
    isAdminOrOwner,
    userDepartments,
    createQuickReply, 
    updateQuickReply, 
    deleteQuickReply,
    uploadMedia,
    deleteMedia,
    getCategories,
    getFilteredByVisibility,
    getVisibilityCounts,
  } = useQuickRepliesData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visibilityTab, setVisibilityTab] = useState<QuickReplyVisibility>('all');
  
  // Data for visibility selectors
  const [departments, setDepartments] = useState<Department[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  // Add dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<QuickReplyVisibility>('all');
  const [formDepartmentId, setFormDepartmentId] = useState<string | null>(null);
  const [formConnectionId, setFormConnectionId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<QuickReplyMediaType>('text');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [editShortcut, setEditShortcut] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVisibility, setEditVisibility] = useState<QuickReplyVisibility>('all');
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const [editConnectionId, setEditConnectionId] = useState<string | null>(null);
  const [editMediaType, setEditMediaType] = useState<QuickReplyMediaType>('text');
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [editMediaPreview, setEditMediaPreview] = useState<string | null>(null);
  const [editExistingMediaUrl, setEditExistingMediaUrl] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<QuickReply | null>(null);

  // Audio recording states
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [editIsRecordingMode, setEditIsRecordingMode] = useState(false);
  
  // Audio recorder hooks
  const audioRecorder = useAudioRecorder();
  const editAudioRecorder = useAudioRecorder();

  // Load departments and connections
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.company_id) return;
      
      // Load departments - admins/owners see all, regular users see only their departments
      if (isAdminOrOwner) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('id, name')
          .eq('active', true)
          .order('name');
        setDepartments(deptData || []);
      } else {
        const deptIds = userDepartments;
        if (deptIds.length > 0) {
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', deptIds)
            .eq('active', true)
            .order('name');
          setDepartments(deptData || []);
        }
      }
      
      // Load connections
      const { data: connData } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected');
      setConnections(connData || []);
      
      // Set default connection
      if (connData && connData.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(connData[0].id);
      }
    };
    
    loadData();
  }, [profile?.company_id, userDepartments, selectedConnectionId, isAdminOrOwner]);

  // Get all categories (existing + defaults)
  const existingCategories = getCategories();
  const allCategories = [...new Set([...defaultCategories, ...existingCategories])].sort();

  // Get replies filtered by visibility tab, then by search/category
  const visibilityFilteredReplies = getFilteredByVisibility(visibilityTab, selectedConnectionId);
  const filteredReplies = visibilityFilteredReplies.filter((reply) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesShortcut = reply.shortcut.toLowerCase().includes(query);
      const matchesTitle = reply.title.toLowerCase().includes(query);
      const matchesMessage = reply.message.toLowerCase().includes(query);
      if (!matchesShortcut && !matchesTitle && !matchesMessage) return false;
    }
    if (selectedCategory !== 'all' && reply.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const visibilityCounts = getVisibilityCounts(selectedConnectionId);

  // Convert recorded blob to File
  const blobToFile = (blob: Blob, fileName: string): File => {
    return new File([blob], fileName, { type: blob.type });
  };

  // Handle using recorded audio
  const handleUseRecordedAudio = (isEdit: boolean = false) => {
    const recorder = isEdit ? editAudioRecorder : audioRecorder;
    if (recorder.audioBlob) {
      const file = blobToFile(recorder.audioBlob, `audio_${Date.now()}.webm`);
      handleFileSelect(file, isEdit);
      recorder.clearRecording();
      if (isEdit) {
        setEditIsRecordingMode(false);
      } else {
        setIsRecordingMode(false);
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Mensagem copiada para a área de transferência.',
    });
  };

  const handleFileSelect = (file: File, isEdit: boolean = false) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (isEdit) {
        setEditMediaFile(file);
        setEditMediaPreview(e.target?.result as string);
        setEditExistingMediaUrl(null);
      } else {
        setMediaFile(file);
        setMediaPreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = (isEdit: boolean = false) => {
    if (isEdit) {
      setEditMediaFile(null);
      setEditMediaPreview(null);
      setEditExistingMediaUrl(null);
    } else {
      setMediaFile(null);
      setMediaPreview(null);
    }
  };

  const resetAddForm = () => {
    setShortcut('');
    setTitle('');
    setMessage('');
    setCategory('');
    setVisibility('all');
    setFormDepartmentId(null);
    setFormConnectionId(null);
    setMediaType('text');
    setMediaFile(null);
    setMediaPreview(null);
    setIsRecordingMode(false);
    audioRecorder.cancelRecording();
  };

  const handleAdd = async () => {
    if (!shortcut.trim() || !title.trim()) return;
    if (mediaType === 'text' && !message.trim()) return;
    if (mediaType !== 'text' && !mediaFile) return;
    
    setIsSubmitting(true);
    
    let mediaUrl: string | null = null;
    
    // Upload media if exists
    if (mediaFile && mediaType !== 'text') {
      setIsUploading(true);
      mediaUrl = await uploadMedia(mediaFile);
      setIsUploading(false);
      
      if (!mediaUrl) {
        setIsSubmitting(false);
        return;
      }
    }
    
    const result = await createQuickReply({
      shortcut,
      title,
      message: message || '',
      category,
      is_global: visibility === 'all',
      media_url: mediaUrl,
      media_type: mediaType,
      visibility_type: visibility,
      department_id: visibility === 'department' ? formDepartmentId : null,
      whatsapp_connection_id: visibility === 'connection' ? formConnectionId : null,
    });
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetAddForm();
    }
  };

  const handleOpenEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setEditShortcut(reply.shortcut);
    setEditTitle(reply.title);
    setEditMessage(reply.message);
    setEditCategory(reply.category || '');
    setEditVisibility(reply.visibility_type || 'all');
    setEditDepartmentId(reply.department_id);
    setEditConnectionId(reply.whatsapp_connection_id);
    setEditMediaType(reply.media_type || 'text');
    setEditMediaFile(null);
    setEditMediaPreview(null);
    setEditExistingMediaUrl(reply.media_url);
    setEditIsRecordingMode(false);
    editAudioRecorder.cancelRecording();
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingReply || !editShortcut.trim() || !editTitle.trim()) return;
    if (editMediaType === 'text' && !editMessage.trim()) return;
    if (editMediaType !== 'text' && !editMediaFile && !editExistingMediaUrl) return;
    
    setIsSubmitting(true);
    
    let mediaUrl: string | null = editExistingMediaUrl;
    
    // Upload new media if exists
    if (editMediaFile && editMediaType !== 'text') {
      setIsUploading(true);
      
      // Delete old media if exists
      if (editingReply.media_url) {
        await deleteMedia(editingReply.media_url);
      }
      
      mediaUrl = await uploadMedia(editMediaFile);
      setIsUploading(false);
      
      if (!mediaUrl) {
        setIsSubmitting(false);
        return;
      }
    }
    
    // If changed to text type, delete old media
    if (editMediaType === 'text' && editingReply.media_url) {
      await deleteMedia(editingReply.media_url);
      mediaUrl = null;
    }
    
    const success = await updateQuickReply(editingReply.id, {
      shortcut: editShortcut,
      title: editTitle,
      message: editMessage,
      category: editCategory,
      is_global: editVisibility === 'all',
      media_url: mediaUrl,
      media_type: editMediaType,
      visibility_type: editVisibility,
      department_id: editVisibility === 'department' ? editDepartmentId : null,
      whatsapp_connection_id: editVisibility === 'connection' ? editConnectionId : null,
    });
    setIsSubmitting(false);

    if (success) {
      setIsEditDialogOpen(false);
      setEditingReply(null);
    }
  };

  const handleDeleteClick = (reply: QuickReply) => {
    setReplyToDelete(reply);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!replyToDelete) return;
    
    await deleteQuickReply(replyToDelete.id);
    setDeleteConfirmOpen(false);
    setReplyToDelete(null);
  };

  const getMediaTypeIcon = (type: QuickReplyMediaType | null) => {
    const option = mediaTypeOptions.find(o => o.value === type);
    return option?.icon || <FileText className="w-4 h-4" />;
  };

  const getMediaTypeLabel = (type: QuickReplyMediaType | null) => {
    const option = mediaTypeOptions.find(o => o.value === type);
    return option?.label || 'Texto';
  };

  const renderMediaPreview = (url: string | null, type: QuickReplyMediaType, isEdit: boolean = false) => {
    if (!url) return null;

    return (
      <div className="relative mt-2 p-2 bg-muted rounded-lg">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={() => handleRemoveMedia(isEdit)}
        >
          <X className="w-4 h-4" />
        </Button>
        
        {type === 'image' && (
          <img src={url} alt="Preview" className="max-h-32 rounded object-contain mx-auto" />
        )}
        {type === 'video' && (
          <video src={url} controls className="max-h-32 rounded mx-auto" />
        )}
        {type === 'audio' && (
          <audio src={url} controls className="w-full" />
        )}
        {type === 'document' && (
          <div className="flex items-center gap-2 p-2">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {isEdit && editMediaFile ? editMediaFile.name : mediaFile?.name || 'Documento'}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Respostas Rápidas</h1>
          <p className="text-muted-foreground">
            Crie atalhos para mensagens frequentes
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetAddForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Resposta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Resposta Rápida</DialogTitle>
              <DialogDescription>
                Crie um atalho para usar durante os atendimentos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shortcut">Atalho *</Label>
                  <Input
                    id="shortcut"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/ola"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome descritivo da resposta"
                  maxLength={100}
                />
              </div>

              {/* Media Type Selector */}
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <div className="flex gap-2 flex-wrap">
                  {mediaTypeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={mediaType === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setMediaType(option.value);
                        setMediaFile(null);
                        setMediaPreview(null);
                      }}
                      className="gap-2"
                    >
                      {option.icon}
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message for text type */}
              {mediaType === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Conteúdo da mensagem..."
                    className="min-h-[120px]"
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length}/2000
                  </p>
                </div>
              )}

              {/* Media upload for non-text types */}
              {mediaType !== 'text' && (
                <div className="space-y-2">
                  <Label>
                    {mediaType === 'audio' ? 'Áudio (gravar ou selecionar arquivo) *' : `Arquivo ${getMediaTypeLabel(mediaType)} *`}
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={mediaTypeOptions.find(o => o.value === mediaType)?.accept}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                  
                  {/* Audio type - show toggle between record and upload */}
                  {mediaType === 'audio' && !mediaPreview && (
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant={isRecordingMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsRecordingMode(true)}
                        className="flex-1"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Gravar
                      </Button>
                      <Button
                        type="button"
                        variant={!isRecordingMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setIsRecordingMode(false);
                          audioRecorder.cancelRecording();
                        }}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Arquivo
                      </Button>
                    </div>
                  )}
                  
                  {/* Audio recording UI */}
                  {mediaType === 'audio' && isRecordingMode && !mediaPreview && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      {!audioRecorder.isRecording && !audioRecorder.audioUrl && (
                        <div className="text-center">
                          <Button
                            type="button"
                            variant="default"
                            size="lg"
                            onClick={audioRecorder.startRecording}
                            className="rounded-full w-16 h-16"
                          >
                            <Mic className="w-6 h-6" />
                          </Button>
                          <p className="text-sm text-muted-foreground mt-2">Clique para começar a gravar</p>
                          {audioRecorder.error && (
                            <p className="text-sm text-destructive mt-2">{audioRecorder.error}</p>
                          )}
                        </div>
                      )}
                      
                      {audioRecorder.isRecording && (
                        <div className="text-center space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-lg font-mono">{formatRecordingTime(audioRecorder.recordingTime)}</span>
                          </div>
                          <div className="flex justify-center gap-2">
                            {audioRecorder.isPaused ? (
                              <Button type="button" variant="outline" size="icon" onClick={audioRecorder.resumeRecording}>
                                <Play className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="icon" onClick={audioRecorder.pauseRecording}>
                                <Pause className="w-4 h-4" />
                              </Button>
                            )}
                            <Button type="button" variant="destructive" size="icon" onClick={audioRecorder.stopRecording}>
                              <Square className="w-4 h-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={audioRecorder.cancelRecording}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {audioRecorder.audioUrl && !audioRecorder.isRecording && (
                        <div className="space-y-3">
                          <audio src={audioRecorder.audioUrl} controls className="w-full" />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleUseRecordedAudio(false)}
                              className="flex-1"
                            >
                              Usar este áudio
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                audioRecorder.clearRecording();
                              }}
                            >
                              Descartar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* File upload button - for non-audio or when not in recording mode */}
                  {!mediaPreview && (mediaType !== 'audio' || !isRecordingMode) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para selecionar {getMediaTypeLabel(mediaType).toLowerCase()}
                        </span>
                      </div>
                    </Button>
                  )}
                  
                  {/* Media preview */}
                  {mediaPreview && renderMediaPreview(mediaPreview, mediaType)}

                  {/* Optional caption for media */}
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="message-caption">Legenda (opcional)</Label>
                    <Textarea
                      id="message-caption"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Legenda para a mídia..."
                      className="min-h-[60px]"
                      maxLength={1000}
                    />
                  </div>
                </div>
              )}
              
              {/* Visibility Selector */}
              <VisibilitySelector
                visibility={visibility}
                onVisibilityChange={setVisibility}
                selectedDepartmentId={formDepartmentId}
                onDepartmentChange={setFormDepartmentId}
                selectedConnectionId={formConnectionId}
                onConnectionChange={setFormConnectionId}
              />
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={
                  !shortcut.trim() || 
                  !title.trim() || 
                  (mediaType === 'text' && !message.trim()) ||
                  (mediaType !== 'text' && !mediaFile) ||
                  isSubmitting
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isUploading ? 'Enviando...' : 'Criando...'}
                  </>
                ) : (
                  'Criar Resposta'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-info" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Como usar?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Durante um atendimento, digite "/" no campo de mensagem para ver todas as 
                respostas disponíveis. Você pode criar respostas com texto, imagens, vídeos, 
                áudios ou documentos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibility Tabs */}
      <VisibilityTabs
        activeTab={visibilityTab}
        onTabChange={setVisibilityTab}
        counts={visibilityCounts}
        hasDepartments={departments.length > 0}
        hasConnection={connections.length > 0}
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por atalho, título ou mensagem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Connection selector for connection tab */}
        {visibilityTab === 'connection' && connections.length > 0 && (
          <Select value={selectedConnectionId || ''} onValueChange={setSelectedConnectionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Conexão" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Quick Replies Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredReplies.map((reply) => {
          const replyMediaType = reply.media_type || 'text';
          return (
            <Card key={reply.id} className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {reply.shortcut}
                      </Badge>
                      {replyMediaType !== 'text' && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {getMediaTypeIcon(replyMediaType)}
                          {getMediaTypeLabel(replyMediaType)}
                        </Badge>
                      )}
                      <VisibilityBadge visibility={reply.visibility_type || 'all'} />
                    </div>
                    <h4 className="font-medium text-foreground mt-2 truncate">
                      {reply.title}
                    </h4>
                    {reply.category && (
                      <div className="flex items-center gap-1 mt-1">
                        <FolderOpen className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {reply.category}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {replyMediaType === 'text' && (
                        <DropdownMenuItem onClick={() => handleCopy(reply.message)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar mensagem
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleOpenEdit(reply)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteClick(reply)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Media preview in card */}
                {replyMediaType !== 'text' && reply.media_url && (
                  <div className="mt-3 rounded-lg overflow-hidden bg-muted">
                    {replyMediaType === 'image' && (
                      <img src={reply.media_url} alt="" className="w-full h-24 object-cover" />
                    )}
                    {replyMediaType === 'video' && (
                      <div className="h-24 flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {replyMediaType === 'audio' && (
                      <div className="h-12 flex items-center justify-center">
                        <Mic className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    {replyMediaType === 'document' && (
                      <div className="h-12 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
                
                {reply.message && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {reply.message}
                  </p>
                )}

                {reply.use_count > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Usada {reply.use_count}x
                  </p>
                )}
                
                {replyMediaType === 'text' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => handleCopy(reply.message)}
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copiar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filteredReplies.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Nenhuma resposta encontrada' 
                : 'Nenhuma resposta criada'
              }
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || selectedCategory !== 'all'
                ? 'Tente ajustar os filtros ou crie uma nova resposta'
                : 'Crie sua primeira resposta rápida para agilizar os atendimentos'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingReply(null);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Resposta Rápida</DialogTitle>
            <DialogDescription>
              Atualize as informações da resposta
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-shortcut">Atalho *</Label>
                <Input
                  id="edit-shortcut"
                  value={editShortcut}
                  onChange={(e) => setEditShortcut(e.target.value)}
                  placeholder="/ola"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Nome descritivo da resposta"
                maxLength={100}
              />
            </div>

            {/* Media Type Selector */}
            <div className="space-y-2">
              <Label>Tipo de Conteúdo</Label>
              <div className="flex gap-2 flex-wrap">
                {mediaTypeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={editMediaType === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEditMediaType(option.value);
                      setEditMediaFile(null);
                      setEditMediaPreview(null);
                      if (option.value !== editingReply?.media_type) {
                        setEditExistingMediaUrl(null);
                      } else {
                        setEditExistingMediaUrl(editingReply?.media_url || null);
                      }
                    }}
                    className="gap-2"
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message for text type */}
            {editMediaType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="edit-message">Mensagem *</Label>
                <Textarea
                  id="edit-message"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="Conteúdo da mensagem..."
                  className="min-h-[120px]"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editMessage.length}/2000
                </p>
              </div>
            )}

            {/* Media upload for non-text types */}
            {editMediaType !== 'text' && (
              <div className="space-y-2">
                <Label>
                  {editMediaType === 'audio' ? 'Áudio (gravar ou selecionar arquivo) *' : `Arquivo ${getMediaTypeLabel(editMediaType)} *`}
                </Label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept={mediaTypeOptions.find(o => o.value === editMediaType)?.accept}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, true);
                  }}
                  className="hidden"
                />
                
                {/* Audio type - show toggle between record and upload */}
                {editMediaType === 'audio' && !editMediaPreview && !editExistingMediaUrl && (
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={editIsRecordingMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditIsRecordingMode(true)}
                      className="flex-1"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Gravar
                    </Button>
                    <Button
                      type="button"
                      variant={!editIsRecordingMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setEditIsRecordingMode(false);
                        editAudioRecorder.cancelRecording();
                      }}
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Arquivo
                    </Button>
                  </div>
                )}
                
                {/* Audio recording UI */}
                {editMediaType === 'audio' && editIsRecordingMode && !editMediaPreview && !editExistingMediaUrl && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    {!editAudioRecorder.isRecording && !editAudioRecorder.audioUrl && (
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="default"
                          size="lg"
                          onClick={editAudioRecorder.startRecording}
                          className="rounded-full w-16 h-16"
                        >
                          <Mic className="w-6 h-6" />
                        </Button>
                        <p className="text-sm text-muted-foreground mt-2">Clique para começar a gravar</p>
                        {editAudioRecorder.error && (
                          <p className="text-sm text-destructive mt-2">{editAudioRecorder.error}</p>
                        )}
                      </div>
                    )}
                    
                    {editAudioRecorder.isRecording && (
                      <div className="text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-lg font-mono">{formatRecordingTime(editAudioRecorder.recordingTime)}</span>
                        </div>
                        <div className="flex justify-center gap-2">
                          {editAudioRecorder.isPaused ? (
                            <Button type="button" variant="outline" size="icon" onClick={editAudioRecorder.resumeRecording}>
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="icon" onClick={editAudioRecorder.pauseRecording}>
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          <Button type="button" variant="destructive" size="icon" onClick={editAudioRecorder.stopRecording}>
                            <Square className="w-4 h-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={editAudioRecorder.cancelRecording}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {editAudioRecorder.audioUrl && !editAudioRecorder.isRecording && (
                      <div className="space-y-3">
                        <audio src={editAudioRecorder.audioUrl} controls className="w-full" />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleUseRecordedAudio(true)}
                            className="flex-1"
                          >
                            Usar este áudio
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              editAudioRecorder.clearRecording();
                            }}
                          >
                            Descartar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* File upload button - for non-audio or when not in recording mode */}
                {!editMediaPreview && !editExistingMediaUrl && (editMediaType !== 'audio' || !editIsRecordingMode) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique para selecionar {getMediaTypeLabel(editMediaType).toLowerCase()}
                      </span>
                    </div>
                  </Button>
                )}
                
                {/* Media preview */}
                {(editMediaPreview || editExistingMediaUrl) && renderMediaPreview(editMediaPreview || editExistingMediaUrl, editMediaType, true)}

                {/* Optional caption for media */}
                <div className="space-y-2 mt-2">
                  <Label htmlFor="edit-message-caption">Legenda (opcional)</Label>
                  <Textarea
                    id="edit-message-caption"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    placeholder="Legenda para a mídia..."
                    className="min-h-[60px]"
                    maxLength={1000}
                  />
                </div>
              </div>
            )}
            
            {/* Visibility Selector */}
              <VisibilitySelector
                visibility={editVisibility}
                onVisibilityChange={setEditVisibility}
                selectedDepartmentId={editDepartmentId}
                onDepartmentChange={setEditDepartmentId}
                selectedConnectionId={editConnectionId}
                onConnectionChange={setEditConnectionId}
              />
            </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={
                !editShortcut.trim() || 
                !editTitle.trim() || 
                (editMediaType === 'text' && !editMessage.trim()) ||
                (editMediaType !== 'text' && !editMediaFile && !editExistingMediaUrl) ||
                isSubmitting
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? 'Enviando...' : 'Salvando...'}
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a resposta "{replyToDelete?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
