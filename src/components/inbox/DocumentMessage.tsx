import { cn } from '@/lib/utils';
import { 
  Download, 
  FileText, 
  File, 
  FileSpreadsheet, 
  Presentation, 
  Archive,
  FileX,
  AlertCircle,
  FileCode,
  Clock,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LinkifyText } from '@/components/ui/linkify-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Loading indicator for inbound document (processing)
function InboundDocumentLoading() {
  return (
    <div className="max-w-[350px] rounded-xl bg-muted/60 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-2 text-center">Carregando documento...</p>
    </div>
  );
}

// Status indicator for document messages
function DocumentStatusIndicator({ status, isOutbound }: { status?: string; isOutbound?: boolean }) {
  if (!isOutbound || !status) return null;
  
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    pending: {
      icon: <Clock className="w-3 h-3 animate-pulse" />,
      label: 'Enviando...',
      className: 'text-amber-500',
    },
    sent: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Enviado',
      className: 'text-muted-foreground',
    },
    delivered: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Entregue',
      className: 'text-muted-foreground',
    },
    read: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Lido',
      className: 'text-blue-500',
    },
    failed: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Falha no envio',
      className: 'text-destructive',
    },
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1", config.className)}>
          {config.icon}
          {(status === 'pending' || status === 'failed') && (
            <span className="text-[10px] font-medium">
              {status === 'pending' ? 'Enviando...' : 'Falhou'}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface DocumentMessageProps {
  src: string;
  isOutbound: boolean;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  status?: string;
  errorMessage?: string;
  caption?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName?: string, mimeType?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext) {
      // Special handling for markdown
      if (ext === 'md' || ext === 'markdown') return 'Markdown';
      return ext.toUpperCase();
    }
  }
  
  if (mimeType) {
    const mimeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'text/plain': 'TXT',
      'text/markdown': 'Markdown',
      'text/x-markdown': 'Markdown',
      'application/zip': 'ZIP',
      'application/x-rar-compressed': 'RAR',
      'application/x-7z-compressed': '7Z',
    };
    return mimeMap[mimeType] || 'FILE';
  }
  
  return 'FILE';
}

function getFileIcon(fileName?: string, mimeType?: string) {
  // Check file extension first (more reliable)
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'md' || ext === 'markdown') {
      return <FileCode className="w-10 h-10 text-purple-500" />;
    }
    // CSV and Excel by extension
    if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
      return <FileSpreadsheet className="w-10 h-10 text-green-500" />;
    }
  }
  
  if (!mimeType) return <File className="w-10 h-10 text-muted-foreground" />;
  
  // Markdown by mimetype
  if (mimeType.includes('markdown')) {
    return <FileCode className="w-10 h-10 text-purple-500" />;
  }
  
  // PDF
  if (mimeType === 'application/pdf') {
    return <FileText className="w-10 h-10 text-red-500" />;
  }
  
  // Word documents
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="w-10 h-10 text-blue-500" />;
  }
  
  // Excel/Spreadsheets/CSV
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType === 'text/csv') {
    return <FileSpreadsheet className="w-10 h-10 text-green-500" />;
  }
  
  // PowerPoint
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return <Presentation className="w-10 h-10 text-orange-500" />;
  }
  
  // Archives
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('archive')) {
    return <Archive className="w-10 h-10 text-purple-500" />;
  }
  
  // Text files
  if (mimeType.includes('text')) {
    return <FileText className="w-10 h-10 text-muted-foreground" />;
  }
  
  // Default
  return <File className="w-10 h-10 text-muted-foreground" />;
}

export function DocumentMessage({
  src,
  isOutbound,
  fileName,
  fileSize,
  mimeType,
  pageCount,
  status,
  errorMessage,
  caption,
}: DocumentMessageProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  const handleOpenInNewTab = () => {
    if (src) {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  const isFailed = status === 'failed';
  const displayName = fileName || 'Documento';
  const truncatedName = displayName.length > 30 
    ? `${displayName.substring(0, 27)}...` 
    : displayName;
  const fileExt = getFileExtension(fileName, mimeType);

  // Build meta info string
  const metaParts: string[] = [];
  if (fileSize) metaParts.push(formatFileSize(fileSize));
  if (fileExt) metaParts.push(fileExt);
  if (pageCount) metaParts.push(`${pageCount} págs`);
  const metaString = metaParts.join(' • ');

  // Inbound media loading state (waiting for media processing)
  const isInboundLoading = !isOutbound && !src && status !== 'failed';
  if (isInboundLoading) {
    return <InboundDocumentLoading />;
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'max-w-[350px] overflow-hidden cursor-pointer transition-all hover:shadow-md',
          caption ? '' : 'rounded-xl'
        )}
        onClick={handleOpenInNewTab}
      >
        {/* Main card */}
        <div
          className={cn(
            'p-4',
            caption ? 'rounded-t-xl' : 'rounded-xl',
            isOutbound 
              ? 'bg-primary/10 dark:bg-primary/20'
              : 'bg-muted'
          )}
        >
          {/* Error state */}
            {isFailed ? (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-lg",
                  isOutbound ? "bg-primary/20" : "bg-muted-foreground/10"
                )}>
                  <FileX className="w-8 h-8 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isOutbound ? "text-primary-foreground dark:text-primary" : "text-foreground"
                  )}>
                    Documento indisponível
                  </p>
                  <p className={cn(
                    "text-xs",
                    isOutbound ? "text-primary-foreground/70 dark:text-primary/70" : "text-muted-foreground"
                  )}>
                    {errorMessage || 'Falha ao carregar'}
                  </p>
                </div>
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              </div>
          ) : (
              <div className="flex items-center gap-3">
                {/* File icon */}
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0",
                  isOutbound ? "bg-primary/20" : "bg-muted-foreground/10"
                )}>
                  {getFileIcon(fileName, mimeType)}
                </div>
                
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p 
                    className={cn(
                      "text-sm font-semibold truncate",
                      isOutbound ? "text-foreground" : "text-foreground"
                    )}
                    title={displayName}
                  >
                    {truncatedName}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-xs",
                      isOutbound ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {metaString || 'Documento'}
                    </p>
                    <DocumentStatusIndicator status={status} isOutbound={isOutbound} />
                  </div>
                </div>
                
                {/* Download button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className={cn(
                    "h-9 w-9 rounded-full flex-shrink-0",
                    isOutbound 
                      ? "hover:bg-primary/20 text-primary"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                  title="Baixar documento"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
          )}
        </div>

        {/* Caption */}
        {caption && (
          <div 
            className={cn(
              "px-4 py-3 rounded-b-xl text-sm leading-relaxed",
              isOutbound 
                ? "bg-primary/10 dark:bg-primary/20 text-foreground border-t border-primary/20"
                : "bg-muted text-foreground border-t border-border"
            )}
          >
            <LinkifyText text={caption} />
          </div>
        )}
      </div>
    </div>
  );
}
