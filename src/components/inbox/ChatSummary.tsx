import { useState } from 'react';
import { 
  FileText, 
  Loader2, 
  Copy, 
  FileDown, 
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatSummaryProps {
  conversationId: string;
  contactId?: string;
}

export function ChatSummary({ conversationId, contactId }: ChatSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-chat', {
        body: { conversationId, contactId }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
      setMessageCount(data.messageCount || 0);
      toast({
        title: "Resumo gerado",
        description: `${data.messageCount || 0} mensagens analisadas`,
      });
    } catch (error: any) {
      console.error('[ChatSummary] Error:', error);
      toast({
        title: "Erro ao gerar resumo",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!summary) return;
    
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const downloadTxt = () => {
    if (!summary) return;
    
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Download iniciado", description: "Arquivo TXT salvo" });
  };

  const downloadPdf = () => {
    if (!summary) return;
    
    // Create a printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Erro", description: "Permita popups para baixar o PDF", variant: "destructive" });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Resumo do Chat</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #1a1a1a;
            }
            h1, h2, h3 {
              color: #111;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { font-size: 20px; }
            h3 { font-size: 16px; }
            ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
            li { margin: 0.3em 0; }
            strong { color: #000; }
            p { margin: 0.5em 0; }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 1px solid #ddd;
            }
            .date { color: #666; font-size: 14px; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📋 Resumo do Chat</h1>
            <p class="date">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            <p class="date">${messageCount} mensagens analisadas</p>
          </div>
          ${formatMarkdownToHtml(summary)}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Simple markdown to HTML converter
  const formatMarkdownToHtml = (text: string): string => {
    return text
      .replace(/### (.*)/g, '<h3>$1</h3>')
      .replace(/## (.*)/g, '<h2>$1</h2>')
      .replace(/# (.*)/g, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  };

  // Render markdown in React
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={index} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={index} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={index} className="text-lg font-bold mt-4 mb-2 text-foreground">{line.slice(2)}</h2>;
      }
      
      // List items
      if (line.startsWith('- ')) {
        const content = line.slice(2);
        return (
          <li key={index} className="text-sm text-muted-foreground ml-4 list-disc">
            {renderInlineMarkdown(content)}
          </li>
        );
      }
      
      // Numbered list
      const numberedMatch = line.match(/^(\d+)\. (.*)/);
      if (numberedMatch) {
        return (
          <li key={index} className="text-sm text-muted-foreground ml-4 list-decimal">
            {renderInlineMarkdown(numberedMatch[2])}
          </li>
        );
      }
      
      // Empty line
      if (line.trim() === '') {
        return <div key={index} className="h-2" />;
      }
      
      // Regular paragraph
      return (
        <p key={index} className="text-sm text-muted-foreground">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Split by bold markers
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h5 className="text-sm font-medium text-foreground">Resumo do Chat</h5>
          {summary && (
            <span className="text-xs text-muted-foreground">
              ({messageCount} msgs)
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-3 space-y-3">
        {/* Generate Button */}
        <Button
          variant={summary ? "outline" : "default"}
          size="sm"
          className="w-full justify-center gap-2"
          onClick={generateSummary}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando resumo...
            </>
          ) : summary ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Gerar novo resumo
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Gerar Resumo com IA
            </>
          )}
        </Button>

        {/* Summary Display */}
        {summary && (
          <div className="space-y-3">
            <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-3">
              <div className="prose prose-sm max-w-none">
                {renderMarkdown(summary)}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={downloadTxt}
              >
                <FileText className="w-3.5 h-3.5" />
                TXT
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={downloadPdf}
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
