import { useState } from 'react';
import { MoreVertical, Download, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Participant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ChatRoom {
  id: string;
  name: string | null;
  type: 'general' | 'group' | 'direct';
  description?: string | null;
  participants?: Participant[];
}

interface ChatActionsProps {
  room: ChatRoom;
  currentUserName?: string;
  onGroupInfoClick?: () => void;
}

const escapeHTML = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const generateInternalChatHTML = (
  roomName: string,
  roomType: 'general' | 'group' | 'direct',
  participants: Participant[],
  exportDate: string,
  messages: any[]
): string => {
  const roomTypeLabels: Record<string, string> = {
    general: 'Chat Geral',
    group: 'Grupo',
    direct: 'Conversa Direta',
  };

  let messagesHTML = '';

  messages.forEach((msg) => {
    const timestamp = new Date(msg.created_at).toLocaleString('pt-BR');
    const senderName = msg.profiles?.full_name || 'Usuário';

    let contentHTML = '';

    // Handle mentions in text
    const processMentions = (text: string, mentions: any[]): string => {
      if (!mentions || mentions.length === 0) return escapeHTML(text);
      
      let processedText = text;
      mentions.forEach((mention: any) => {
        const mentionPattern = new RegExp(`@${mention.name}`, 'g');
        processedText = processedText.replace(
          mentionPattern,
          `<span class="mention">@${escapeHTML(mention.name)}</span>`
        );
      });
      return processedText;
    };

    switch (msg.message_type) {
      case 'text':
        const textContent = processMentions(msg.content || '', msg.mentions || []);
        contentHTML = `<p>${textContent}</p>`;
        break;

      case 'image':
        contentHTML = `
          <p>📷 Imagem</p>
          ${msg.media_url ? `
            <a href="${msg.media_url}" target="_blank" class="media-link">
              <img src="${msg.media_url}" class="media-preview" alt="Imagem" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <span style="display:none;">⚠️ Imagem não disponível</span>
            </a>
            <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Abrir imagem em nova aba</a>
          ` : '<p><em>Mídia não disponível</em></p>'}
        `;
        break;

      case 'video':
        contentHTML = `
          <p>🎬 Vídeo</p>
          ${msg.media_url ? `
            <video controls class="media-preview" src="${msg.media_url}"></video>
            <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar vídeo</a>
          ` : '<p><em>Mídia não disponível</em></p>'}
        `;
        break;

      case 'audio':
        contentHTML = `
          <p>🎵 Áudio</p>
          ${msg.media_url ? `
            <audio controls src="${msg.media_url}"></audio>
            <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar áudio</a>
          ` : '<p><em>Mídia não disponível</em></p>'}
        `;
        break;

      case 'document':
        const fileName = msg.content || 'documento';
        contentHTML = `
          <p>📄 Documento: ${escapeHTML(fileName)}</p>
          ${msg.media_url ? `
            <a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar documento</a>
          ` : '<p><em>Documento não disponível</em></p>'}
        `;
        break;

      default:
        contentHTML = `<p>${escapeHTML(msg.content || `[${msg.message_type}]`)}</p>`;
    }

    messagesHTML += `
      <div class="message">
        <div class="sender">${escapeHTML(senderName)}</div>
        <div class="timestamp">${timestamp}</div>
        ${contentHTML}
      </div>
    `;
  });

  const participantsList = participants.map(p => escapeHTML(p.fullName)).join(', ');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Interno - ${escapeHTML(roomName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 24px;
    }
    header h1 {
      font-size: 1.5rem;
      margin-bottom: 8px;
    }
    header .badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    header .info {
      font-size: 0.9rem;
      opacity: 0.9;
      line-height: 1.6;
    }
    main {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .message {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;
    }
    .message .sender {
      font-weight: 600;
      color: #059669;
      font-size: 0.9rem;
      margin-bottom: 2px;
    }
    .message .timestamp {
      font-size: 0.75rem;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .message p {
      color: #1f2937;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .mention {
      background: #d1fae5;
      color: #059669;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .media-preview {
      max-width: 100%;
      max-height: 300px;
      border-radius: 8px;
      margin: 8px 0;
    }
    .media-link {
      color: #059669;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .media-link:hover {
      text-decoration: underline;
    }
    audio, video {
      max-width: 100%;
      margin: 8px 0;
    }
    footer {
      text-align: center;
      padding: 16px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 0.85rem;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">${roomTypeLabels[roomType]}</span>
      <h1>${escapeHTML(roomName)}</h1>
      <div class="info">
        <p><strong>Participantes:</strong> ${participantsList || 'Equipe'}</p>
        <p><strong>Exportado em:</strong> ${exportDate}</p>
        <p><strong>Total de mensagens:</strong> ${messages.length}</p>
      </div>
    </header>
    <main>
      ${messagesHTML || '<p style="text-align: center; color: #6b7280;">Nenhuma mensagem para exibir.</p>'}
    </main>
    <footer>
      Exportado do Chat Interno
    </footer>
  </div>
</body>
</html>`;
};

export function ChatActions({ room, currentUserName, onGroupInfoClick }: ChatActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportChat = async () => {
    setIsExporting(true);

    try {
      // Fetch all messages for this room
      const { data: messages, error } = await supabase
        .from('internal_chat_messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          media_mime_type,
          created_at,
          sender_id,
          mentions,
          profiles:sender_id (full_name, avatar_url)
        `)
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Erro ao exportar conversa');
        return;
      }

      // Determine room name for export
      let roomName = room.name || 'Chat';
      if (room.type === 'general') {
        roomName = 'Chat Geral';
      } else if (room.type === 'direct' && room.participants?.length) {
        const otherParticipant = room.participants.find(p => p.fullName !== currentUserName);
        roomName = `Conversa com ${otherParticipant?.fullName || 'Usuário'}`;
      }

      const exportDate = new Date().toLocaleString('pt-BR');
      const participants = room.participants || [];

      const html = generateInternalChatHTML(
        roomName,
        room.type,
        participants,
        exportDate,
        messages || []
      );

      // Create and download file
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const sanitizedName = roomName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `chat_interno_${sanitizedName}_${dateStr}.html`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Conversa exportada com sucesso!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar conversa');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportChat} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar conversa'}
        </DropdownMenuItem>
        
        {room.type === 'group' && onGroupInfoClick && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onGroupInfoClick}>
              <Info className="h-4 w-4 mr-2" />
              Informações do grupo
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
