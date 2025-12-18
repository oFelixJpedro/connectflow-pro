import { useState, useRef } from 'react';
import { Image, Video, Mic, FileText, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { cn } from '@/lib/utils';

type MediaType = 'image' | 'video' | 'audio' | 'document';

interface MediaUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaType: MediaType;
  onUpload: (mediaKey: string, file: File) => Promise<boolean>;
}

const mediaConfig: Record<MediaType, {
  icon: typeof Image;
  title: string;
  accept: string;
  maxSize: number;
  color: string;
}> = {
  image: {
    icon: Image,
    title: 'Imagem',
    accept: 'image/jpeg,image/png,image/gif,image/webp',
    maxSize: 5 * 1024 * 1024, // 5MB
    color: 'text-blue-500',
  },
  video: {
    icon: Video,
    title: 'Vídeo',
    accept: 'video/mp4,video/webm,video/quicktime',
    maxSize: 50 * 1024 * 1024, // 50MB
    color: 'text-purple-500',
  },
  audio: {
    icon: Mic,
    title: 'Áudio',
    accept: 'audio/mpeg,audio/mp3,audio/ogg,audio/opus,audio/wav,audio/webm,audio/mp4',
    maxSize: 10 * 1024 * 1024, // 10MB
    color: 'text-green-500',
  },
  document: {
    icon: FileText,
    title: 'Documento',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt',
    maxSize: 20 * 1024 * 1024, // 20MB
    color: 'text-orange-500',
  },
};

export function MediaUploadModal({ open, onOpenChange, mediaType, onUpload }: MediaUploadModalProps) {
  const [mediaKey, setMediaKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    clearRecording,
  } = useAudioRecorder();

  const config = mediaConfig[mediaType];
  const Icon = config.icon;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > config.maxSize) {
        alert(`Arquivo muito grande. Máximo: ${config.maxSize / 1024 / 1024}MB`);
        return;
      }
      setFile(selectedFile);
      setShowRecorder(false);
      clearRecording();
    }
  };

  const handleSubmit = async () => {
    if (!mediaKey.trim()) {
      alert('Digite uma chave para a mídia');
      return;
    }

    let fileToUpload = file;

    // If audio was recorded, convert blob to file
    if (mediaType === 'audio' && audioBlob && !file) {
      fileToUpload = new File([audioBlob], `${mediaKey}.webm`, { type: 'audio/webm' });
    }

    if (!fileToUpload) {
      alert('Selecione ou grave um arquivo');
      return;
    }

    setIsUploading(true);
    const success = await onUpload(mediaKey.trim(), fileToUpload);
    setIsUploading(false);

    if (success) {
      setMediaKey('');
      setFile(null);
      clearRecording();
      setShowRecorder(false);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    cancelRecording();
    setMediaKey('');
    setFile(null);
    setShowRecorder(false);
    onOpenChange(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", config.color)} />
            Adicionar {config.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Chave da mídia *</Label>
            <Input
              value={mediaKey}
              onChange={(e) => setMediaKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="ex: boas-vindas, tutorial-1"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use apenas letras, números, hífens e underscores. Será usado como: {`{{${mediaType}:${mediaKey || 'chave'}}}`}
            </p>
          </div>

          {/* File upload area */}
          {!showRecorder && (
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-muted/50",
                  file ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                )}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <Icon className={cn("w-6 h-6", config.color)} />
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique ou arraste um arquivo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo: {config.maxSize / 1024 / 1024}MB
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={config.accept}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Audio recorder (only for audio type) */}
          {mediaType === 'audio' && (
            <>
              {!showRecorder && !file && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowRecorder(true)}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Gravar áudio
                </Button>
              )}

              {showRecorder && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Gravador</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        cancelRecording();
                        setShowRecorder(false);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {audioUrl ? (
                    <div className="space-y-2">
                      <audio src={audioUrl} controls className="w-full" />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            clearRecording();
                          }}
                        >
                          Gravar novamente
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className={cn(
                          "text-2xl font-mono",
                          isRecording && !isPaused && "text-red-500 animate-pulse"
                        )}>
                          {formatTime(recordingTime)}
                        </div>
                        {isRecording && !isPaused && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-xs text-red-500">Gravando...</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center gap-2">
                        {!isRecording ? (
                          <Button onClick={startRecording} variant="destructive">
                            <Mic className="w-4 h-4 mr-2" />
                            Iniciar
                          </Button>
                        ) : (
                          <>
                            <Button onClick={isPaused ? resumeRecording : pauseRecording} variant="outline">
                              {isPaused ? 'Continuar' : 'Pausar'}
                            </Button>
                            <Button onClick={stopRecording} variant="default">
                              Parar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!mediaKey.trim() || (!file && !audioBlob) || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
