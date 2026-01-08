import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Mail, MessageSquare, Plus, Trash2, Upload, Paperclip, Send, History, X, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ConversationPreviewModal } from './ConversationPreviewModal';
import type { KanbanCard, KanbanColumn, KanbanCardComment, KanbanCardHistory, KanbanCardAttachment } from '@/hooks/useKanbanData';

interface KanbanCardDrawerProps {
  card: KanbanCard | null;
  columns: KanbanColumn[];
  teamMembers: { id: string; full_name: string; avatar_url: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCard: (cardId: string, updates: Partial<Pick<KanbanCard, 'priority' | 'assigned_user_id'>>, historyAction?: string, oldValue?: Record<string, unknown>, newValue?: Record<string, unknown>) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<boolean>;
  onAddTag: (cardId: string, name: string, color: string) => Promise<unknown>;
  onRemoveTag: (cardId: string, tagId: string) => Promise<boolean>;
  onAddChecklistItem: (cardId: string, text: string) => Promise<unknown>;
  onToggleChecklistItem: (cardId: string, itemId: string) => Promise<boolean>;
  onDeleteChecklistItem: (cardId: string, itemId: string) => Promise<boolean>;
  onAddComment: (cardId: string, content: string) => Promise<KanbanCardComment | null>;
  onLoadComments: (cardId: string) => Promise<KanbanCardComment[]>;
  onLoadHistory: (cardId: string) => Promise<KanbanCardHistory[]>;
  onLoadAttachments: (cardId: string) => Promise<KanbanCardAttachment[]>;
  onUploadAttachment: (cardId: string, file: File) => Promise<KanbanCardAttachment | null>;
  onDeleteAttachment: (cardId: string, attachmentId: string, filePath: string) => Promise<boolean>;
  onMoveCard: (cardId: string, toColumnId: string, newPosition: number) => Promise<boolean>;
}

const priorityOptions = [
  { value: 'low', label: 'Baixa', color: 'bg-slate-500' },
  { value: 'medium', label: 'Média', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];

const TAG_COLORS = ['#FFD6E0', '#D6E5FF', '#D6FFE0', '#FFF5D6', '#E8D6FF', '#FFE5D6'];

export function KanbanCardDrawer({ card, columns, teamMembers, open, onOpenChange, onUpdateCard, onDeleteCard, onAddTag, onRemoveTag, onAddChecklistItem, onToggleChecklistItem, onDeleteChecklistItem, onAddComment, onLoadComments, onLoadHistory, onLoadAttachments, onUploadAttachment, onDeleteAttachment, onMoveCard }: KanbanCardDrawerProps) {
  const [comments, setComments] = useState<KanbanCardComment[]>([]);
  const [history, setHistory] = useState<KanbanCardHistory[]>([]);
  const [attachments, setAttachments] = useState<KanbanCardAttachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConversationPreviewOpen, setIsConversationPreviewOpen] = useState(false);
  const [isCorrectingComment, setIsCorrectingComment] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (card && open) {
      loadCardData();
    }
  }, [card?.id, open]);

  const loadCardData = async () => {
    if (!card) return;
    const [commentsData, historyData, attachmentsData] = await Promise.all([
      onLoadComments(card.id),
      onLoadHistory(card.id),
      onLoadAttachments(card.id),
    ]);
    setComments(commentsData);
    setHistory(historyData);
    setAttachments(attachmentsData);
  };

  const handleAddComment = async () => {
    if (!card || !newComment.trim()) return;
    setLoading(true);
    const comment = await onAddComment(card.id, newComment.trim());
    if (comment) {
      setComments([comment, ...comments]);
      setNewComment('');
    }
    setLoading(false);
  };

  const handleAddChecklistItem = async () => {
    if (!card || !newChecklistItem.trim()) return;
    await onAddChecklistItem(card.id, newChecklistItem.trim());
    setNewChecklistItem('');
  };

  const handleAddTag = async () => {
    if (!card || !newTagName.trim()) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    await onAddTag(card.id, newTagName.trim(), color);
    setNewTagName('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!card || !e.target.files?.length) return;
    const file = e.target.files[0];
    console.log('Uploading file:', { name: file.name, type: file.type, size: file.size });
    const attachment = await onUploadAttachment(card.id, file);
    console.log('Upload result:', attachment);
    if (attachment) {
      setAttachments([attachment, ...attachments]);
    }
    // Reset input
    e.target.value = '';
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!card) return null;

  const currentColumn = columns.find(c => c.id === card.column_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="truncate">{card.contact?.name || 'Sem nome'}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={card.contact?.avatar_url || undefined} className="object-cover object-top" />
              <AvatarFallback>{getInitials(card.contact?.name || 'SN')}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                {card.contact?.phone_number}
              </div>
              {card.contact?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {card.contact.email}
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsConversationPreviewOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Conversa
            </Button>
          </div>

          {/* Conversation Preview Modal */}
          <ConversationPreviewModal
            open={isConversationPreviewOpen}
            onOpenChange={setIsConversationPreviewOpen}
            contactId={card.contact_id}
            contactName={card.contact?.name}
            contactPhone={card.contact?.phone_number}
            contactAvatarUrl={card.contact?.avatar_url || undefined}
          />

          {/* Column, Priority, Assigned */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Coluna</Label>
              <Select value={card.column_id} onValueChange={(val) => onMoveCard(card.id, val, 0)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={card.priority} onValueChange={(val) => onUpdateCard(card.id, { priority: val as KanbanCard['priority'] }, 'priority_changed', { priority: card.priority }, { priority: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={card.assigned_user_id || 'none'} onValueChange={(val) => onUpdateCard(card.id, { assigned_user_id: val === 'none' ? null : val }, 'assigned', { assigned: card.assigned_user?.full_name }, { assigned: teamMembers.find(m => m.id === val)?.full_name })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {card.tags?.map(tag => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-black">
                  {tag.name}
                  <button onClick={() => onRemoveTag(card.id, tag.id)} className="ml-1"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Nova tag" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <Tabs defaultValue="checklist">
            <TabsList className="w-full">
              <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">Comentários</TabsTrigger>
              <TabsTrigger value="attachments" className="flex-1">Anexos</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="checklist" className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Novo item" value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} />
                <Button size="sm" onClick={handleAddChecklistItem}><Plus className="w-4 h-4" /></Button>
              </div>
              {card.checklist_items?.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox checked={item.completed} onCheckedChange={() => onToggleChecklistItem(card.id, item.id)} />
                  <span className={item.completed ? 'line-through text-muted-foreground' : ''}>{item.text}</span>
                  <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => onDeleteChecklistItem(card.id, item.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="comments" className="space-y-3">
              <div className="flex gap-2">
                <Textarea ref={commentTextareaRef} placeholder="Adicionar comentário..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} className="flex-1" />
                {newComment.trim() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (isCorrectingComment) return;
                      setIsCorrectingComment(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('correct-text', {
                          body: { text: newComment }
                        });
                        
                        // Handle insufficient credits error
                        if (data?.code === 'INSUFFICIENT_CREDITS') {
                          toast.error('Créditos insuficientes. Recarregue seus créditos de IA.');
                          return;
                        }
                        
                        if (error) throw error;
                        if (data?.correctedText) {
                          setNewComment(data.correctedText);
                          setTimeout(() => commentTextareaRef.current?.focus(), 100);
                          if (data.hasChanges) {
                            toast.success('Texto corrigido');
                          } else {
                            toast.info('Texto já está correto');
                          }
                        }
                      } catch (error) {
                        toast.error('Erro ao corrigir');
                      } finally {
                        setIsCorrectingComment(false);
                      }
                    }}
                    disabled={isCorrectingComment}
                  >
                    {isCorrectingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  </Button>
                )}
                <Button size="sm" onClick={handleAddComment} disabled={loading || !newComment.trim()}><Send className="w-4 h-4" /></Button>
              </div>
              <ScrollArea className="h-48">
                {comments.map(c => (
                  <div key={c.id} className="p-2 border-b">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{c.user?.full_name}</span>
                      <span>{format(new Date(c.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                    </div>
                    <p className="text-sm mt-1">{c.content}</p>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="attachments" className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer border rounded p-2 hover:bg-muted">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Fazer upload</span>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </label>
              {attachments.map(a => {
                const getFilePath = () => {
                  const urlParts = a.file_url.split('/kanban-attachments/');
                  return urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
                };
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 border rounded">
                    <Paperclip className="w-4 h-4 flex-shrink-0" />
                    <button 
                      onClick={async () => {
                        try {
                          const filePath = getFilePath();
                          if (filePath) {
                            const { data, error } = await supabase.storage
                              .from('kanban-attachments')
                              .createSignedUrl(filePath, 3600);
                            if (error) throw error;
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, '_blank');
                            }
                          }
                        } catch (error) {
                          console.error('Error downloading file:', error);
                          toast.error('Erro ao baixar arquivo');
                        }
                      }}
                      className="flex-1 text-sm truncate hover:underline text-left"
                    >
                      {a.file_name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={async () => {
                        const filePath = getFilePath();
                        if (filePath && card) {
                          const success = await onDeleteAttachment(card.id, a.id, filePath);
                          if (success) {
                            setAttachments(attachments.filter(att => att.id !== a.id));
                          }
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-48">
                {history.map(h => (
                  <div key={h.id} className="p-2 border-b text-xs">
                    <span className="font-medium">{h.user?.full_name || 'Sistema'}</span>
                    <span className="text-muted-foreground"> {h.action_type} </span>
                    <span>{format(new Date(h.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Button variant="destructive" className="w-full" onClick={() => { onDeleteCard(card.id); onOpenChange(false); }}>
            <Trash2 className="w-4 h-4 mr-2" />Excluir Card
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
