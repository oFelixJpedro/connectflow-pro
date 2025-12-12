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
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  // Check file extension first (more reliable for markdown)
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'md' || ext === 'markdown') {
      return <FileCode className="w-10 h-10 text-purple-500" />;
    }
  }
  
  if (!mimeType) return <File className="w-10 h-10 text-slate-400" />;
  
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
  
  // Excel/Spreadsheets
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('sheet')) {
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
    return <FileText className="w-10 h-10 text-slate-500" />;
  }
  
  // Default
  return <File className="w-10 h-10 text-slate-400" />;
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
              ? 'bg-gradient-to-br from-blue-100 to-blue-200'
              : 'bg-slate-100'
          )}
        >
          {/* Error state */}
          {isFailed ? (
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-lg",
                isOutbound ? "bg-blue-200/50" : "bg-slate-200/50"
              )}>
                <FileX className="w-8 h-8 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isOutbound ? "text-blue-900" : "text-slate-900"
                )}>
                  Documento indisponível
                </p>
                <p className={cn(
                  "text-xs",
                  isOutbound ? "text-blue-800/70" : "text-slate-600"
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
                isOutbound ? "bg-blue-200/50" : "bg-slate-200/50"
              )}>
                {getFileIcon(fileName, mimeType)}
              </div>
              
              {/* File info */}
              <div className="flex-1 min-w-0">
                <p 
                  className={cn(
                    "text-sm font-semibold truncate",
                    isOutbound ? "text-blue-900" : "text-slate-900"
                  )}
                  title={displayName}
                >
                  {truncatedName}
                </p>
                <p className={cn(
                  "text-xs mt-0.5",
                  isOutbound ? "text-blue-800/70" : "text-slate-600"
                )}>
                  {metaString || 'Documento'}
                </p>
              </div>
              
              {/* Download button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className={cn(
                  "h-9 w-9 rounded-full flex-shrink-0",
                  isOutbound 
                    ? "hover:bg-blue-300/50 text-blue-700"
                    : "hover:bg-slate-200 text-slate-600"
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
              "whitespace-pre-wrap break-words",
              isOutbound 
                ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900 border-t border-blue-200/50"
                : "bg-slate-100 text-slate-900 border-t border-slate-200/50"
            )}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
