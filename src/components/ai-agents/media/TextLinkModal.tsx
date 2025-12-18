import { useState } from 'react';
import { Type, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ContentType = 'text' | 'link';

interface TextLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ContentType;
  onCreate: (mediaKey: string, content: string) => Promise<boolean>;
}

export function TextLinkModal({ open, onOpenChange, contentType, onCreate }: TextLinkModalProps) {
  const [mediaKey, setMediaKey] = useState('');
  const [content, setContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isText = contentType === 'text';

  const handleSubmit = async () => {
    if (!mediaKey.trim() || !content.trim()) {
      return;
    }

    setIsCreating(true);
    const success = await onCreate(mediaKey.trim(), content.trim());
    setIsCreating(false);

    if (success) {
      setMediaKey('');
      setContent('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setMediaKey('');
    setContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isText ? (
              <Type className="w-5 h-5 text-gray-500" />
            ) : (
              <Link2 className="w-5 h-5 text-cyan-500" />
            )}
            Adicionar {isText ? 'Texto Fixo' : 'Link'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Chave *</Label>
            <Input
              value={mediaKey}
              onChange={(e) => setMediaKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder={isText ? "ex: aviso-horario" : "ex: link-contrato"}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Será usado como: {`{{${contentType}:${mediaKey || 'chave'}}}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{isText ? 'Texto' : 'URL do Link'} *</Label>
            {isText ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite o texto que será enviado..."
                rows={4}
              />
            ) : (
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!mediaKey.trim() || !content.trim() || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
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
