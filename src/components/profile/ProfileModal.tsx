import { useState, useRef, useEffect } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Loader2, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileMetadata {
  signature?: string;
  bio?: string;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [signature, setSignature] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url);
      
      // Parse metadata for signature and bio
      const metadata = profile.metadata as ProfileMetadata | null;
      setSignature(metadata?.signature || '');
      setBio(metadata?.bio || '');
      
      // Reset file state
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [isOpen, profile]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setAvatarFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validate name
    if (!fullName.trim() || fullName.trim().length < 3) {
      toast.error('O nome deve ter pelo menos 3 caracteres');
      return;
    }

    setIsSaving(true);

    try {
      let newAvatarUrl = avatarUrl;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop() || 'jpg';
        const sanitizedName = sanitizeFileName(`avatar_${Date.now()}.${fileExt}`);
        const filePath = `${profile.company_id}/${profile.id}/${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Erro ao fazer upload da foto');
          setIsSaving(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        newAvatarUrl = urlData.publicUrl;
      }

      // Build new metadata
      const currentMetadata = (profile.metadata as ProfileMetadata) || {};
      const newMetadata = {
        ...currentMetadata,
        signature: signature.trim() || undefined,
        bio: bio.trim() || undefined,
      };

      // Update profile
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        avatar_url: newAvatarUrl,
        metadata: newMetadata,
      });

      if (error) {
        toast.error('Erro ao salvar perfil');
        console.error('Update error:', error);
        return;
      }

      toast.success('Perfil atualizado com sucesso!');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = avatarPreview || avatarUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">Meu Perfil</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <div className="px-6 py-6 space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                  <AvatarImage src={displayAvatar || undefined} />
                  <AvatarFallback className="text-2xl bg-muted">
                    {getInitials(fullName || profile?.full_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-full",
                    "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
                    "cursor-pointer"
                  )}
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Clique na foto para alterar
              </p>
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Este nome será exibido em todo o sistema
              </p>
            </div>

            {/* Email Field (read-only) */}
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>

            {/* Signature Field */}
            <div className="space-y-2">
              <Label htmlFor="signature">Assinatura personalizada</Label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Ex: Dr. João Silva, Atendente Maria"
                maxLength={50}
              />
              <div className="flex justify-between">
                <p className="text-xs text-muted-foreground">
                  Esta assinatura pode ser usada nas suas mensagens
                </p>
                <span className="text-xs text-muted-foreground">
                  {signature.length}/50
                </span>
              </div>
            </div>

            {/* Bio Field */}
            <div className="space-y-2">
              <Label htmlFor="bio">Sobre você</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte um pouco sobre você..."
                maxLength={300}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">
                  {bio.length}/300
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
