import { useState, useCallback } from 'react';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Wand2, 
  Sparkles, 
  Loader2,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAgentKnowledge, KnowledgeDocument } from '@/hooks/useAgentKnowledge';
import { AI_AGENT_CHAR_LIMITS } from '@/types/ai-agents';

interface AgentKnowledgeBaseTabProps {
  agentId: string;
  content: string;
  onChange: (content: string) => void;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const DEFAULT_KNOWLEDGE_TEMPLATE = `# 📖 BASE DE CONHECIMENTO

Use esta seção para adicionar informações que o agente pode consultar durante o atendimento. O conteúdo aqui é usado para enriquecer as respostas do agente.

---

## 📋 INFORMAÇÕES GERAIS

**Sobre a empresa/serviço:**
[Insira uma breve descrição]

**Diferenciais:**
- [Diferencial 1]
- [Diferencial 2]
- [Diferencial 3]

---

## 📦 PRODUTOS/SERVIÇOS

**[Nome do produto/serviço 1]:**
- Descrição: [descrição]
- Preço: [preço]
- Benefícios: [benefícios]

**[Nome do produto/serviço 2]:**
- Descrição: [descrição]
- Preço: [preço]
- Benefícios: [benefícios]

---

## 📌 INFORMAÇÕES IMPORTANTES

- [Informação relevante 1]
- [Informação relevante 2]
- [Informação relevante 3]

---

## ⚠️ OBSERVAÇÕES

[Adicione observações importantes que o agente deve considerar]`;

export function AgentKnowledgeBaseTab({
  agentId,
  content,
  onChange,
}: AgentKnowledgeBaseTabProps) {
  const [textKnowledgeOpen, setTextKnowledgeOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<KnowledgeDocument | null>(null);
  const { toast } = useToast();
  
  const {
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    loadDocuments,
    uploadDocument,
    deleteDocument,
  } = useAgentKnowledge(agentId);

  const handleGenerateTemplate = () => {
    onChange(DEFAULT_KNOWLEDGE_TEMPLATE);
  };

  const handleFormatPrompt = async () => {
    if (!content.trim()) {
      toast({
        title: "Erro",
        description: "Adicione conteúdo antes de formatar",
        variant: "destructive",
      });
      return;
    }

    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-prompt', {
        body: { text: content }
      });

      if (error) throw error;

      if (data?.formattedText) {
        onChange(data.formattedText);
        toast({
          title: "Formatado!",
          description: "O conteúdo foi formatado com sucesso",
        });
      } else {
        throw new Error('Resposta inválida');
      }
    } catch (error) {
      console.error('Error formatting content:', error);
      toast({
        title: "Erro ao formatar",
        description: "Não foi possível formatar o conteúdo",
        variant: "destructive",
      });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas PDF, DOCX, TXT e MD são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 20MB",
        variant: "destructive",
      });
      return;
    }

    const success = await uploadDocument(file);
    if (success) {
      toast({
        title: "Documento enviado!",
        description: "O documento está sendo processado...",
      });
    }
  }, [uploadDocument, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDeleteDocument = async (doc: KnowledgeDocument) => {
    if (!confirm(`Tem certeza que deseja excluir "${doc.file_name}"?`)) return;
    
    const success = await deleteDocument(doc.id, doc.storage_path);
    if (success) {
      toast({
        title: "Documento excluído",
        description: "O documento foi removido com sucesso",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Pronto
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('docx')) return '📝';
    if (fileType.includes('text') || fileType.includes('plain')) return '📃';
    if (fileType.includes('markdown')) return '📑';
    return '📄';
  };

  const charCount = content.length;
  const charLimit = AI_AGENT_CHAR_LIMITS.knowledge || 5000;

  return (
    <div className="space-y-6">
      {/* Conhecimento Textual */}
      <Collapsible open={textKnowledgeOpen} onOpenChange={setTextKnowledgeOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  <CardTitle className="text-base">Conhecimento Textual</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {charCount}/{charLimit}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {charCount > charLimit && (
                    <Alert className="py-1 px-2 border-red-500/50 bg-red-500/10">
                      <AlertDescription className="text-xs text-red-600">
                        Limite excedido!
                      </AlertDescription>
                    </Alert>
                  )}
                  {textKnowledgeOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Adicione informações básicas que o agente pode consultar diretamente.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleFormatPrompt}
                    disabled={isFormatting}
                  >
                    {isFormatting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Formatar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Texto Padrão
                  </Button>
                </div>
              </div>

              <MarkdownEditor
                value={content}
                onChange={onChange}
                placeholder="Digite o conhecimento básico aqui..."
                minHeight="250px"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Documentos */}
      <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <CardTitle className="text-base">Documentos</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {documents.length} arquivo{documents.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {documentsOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie documentos (PDF, DOCX, TXT) que o agente pode consultar usando busca semântica.
              </p>

              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Enviando documento...</p>
                    <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Arraste um arquivo aqui ou clique no botão para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      PDF, DOCX, TXT ou MD • Máximo 20MB
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 relative">
                      Selecionar Arquivo
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept={Object.keys(ACCEPTED_FILE_TYPES).join(',')}
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                    </Button>
                  </>
                )}
              </div>

              {/* Documents List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length > 0 ? (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xl">{getFileIcon(doc.file_type)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {getStatusBadge(doc.status)}
                          {doc.status === 'ready' && doc.extracted_text && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewDocument(doc)}
                              title="Visualizar texto extraído"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDocument(doc)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum documento enviado</p>
                  <p className="text-xs mt-1">Envie documentos para enriquecer a base de conhecimento</p>
                </div>
              )}

            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Preview Modal */}
      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDocument && getFileIcon(previewDocument.file_type)}
              {previewDocument?.file_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg">
              {previewDocument?.extracted_text || 'Nenhum texto extraído'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
