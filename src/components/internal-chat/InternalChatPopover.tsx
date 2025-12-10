import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Users, Send, ArrowLeft, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInternalChat } from '@/hooks/useInternalChat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function InternalChatPopover() {
  const {
    rooms,
    messages,
    teamMembers,
    selectedRoom,
    setSelectedRoom,
    isLoading,
    isLoadingMessages,
    sendMessage,
    getOrCreateDirectRoom,
  } = useInternalChat();

  const [isOpen, setIsOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'team'>('chats');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const success = await sendMessage(messageInput.trim());
    if (success) {
      setMessageInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectTeamMember = async (memberId: string) => {
    await getOrCreateDirectRoom(memberId);
    setActiveTab('chats');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'away':
        return 'text-yellow-500';
      case 'busy':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return format(date, 'HH:mm', { locale: ptBR });
    }
    return format(date, 'dd/MM HH:mm', { locale: ptBR });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span className="hidden md:inline text-sm">Chat Interno</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 internal-chat-popover"
        align="center"
        sideOffset={8}
      >
        {/* Header */}
        <div className="internal-chat-header p-3 border-b">
          <div className="flex items-center gap-2">
            {selectedRoom && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setSelectedRoom(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">
              {selectedRoom ? selectedRoom.name || 'Chat Direto' : 'Chat da Equipe'}
            </span>
          </div>
        </div>

        {selectedRoom ? (
          /* Chat View */
          <div className="flex flex-col h-[400px]">
            <ScrollArea className="flex-1 p-3">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                  <p className="text-xs">Seja o primeiro a enviar!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      {!msg.isOwnMessage && (
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={msg.senderAvatar || undefined} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                            {getInitials(msg.senderName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[70%] ${
                          msg.isOwnMessage
                            ? 'internal-chat-message-own'
                            : 'internal-chat-message-other'
                        }`}
                      >
                        {!msg.isOwnMessage && selectedRoom.type === 'general' && (
                          <p className="text-xs font-medium text-emerald-700 mb-1">
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm break-words">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.isOwnMessage ? 'text-emerald-100' : 'text-muted-foreground'
                          }`}
                        >
                          {formatMessageTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 border-t bg-muted/30">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-background internal-chat-input"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="internal-chat-send-button"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Room List View */
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chats' | 'team')}>
            <TabsList className="w-full rounded-none border-b bg-transparent h-10">
              <TabsTrigger
                value="chats"
                className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Conversas
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
              >
                <Users className="w-4 h-4 mr-2" />
                Equipe
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chats" className="m-0">
              <ScrollArea className="h-[350px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma conversa ainda</p>
                    <p className="text-xs text-center">
                      Clique em "Equipe" para iniciar um chat
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                        onClick={() => setSelectedRoom(room)}
                      >
                        <Avatar className="w-10 h-10">
                          {room.type === 'general' ? (
                            <AvatarFallback className="bg-emerald-100 text-emerald-700">
                              <Users className="w-5 h-5" />
                            </AvatarFallback>
                          ) : (
                            <>
                              <AvatarImage
                                src={room.participants?.find(p => p.id !== room.id)?.avatarUrl || undefined}
                              />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700">
                                {getInitials(room.name || 'CD')}
                              </AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">
                              {room.name || 'Chat Direto'}
                            </p>
                            {room.lastMessage && (
                              <span className="text-xs text-muted-foreground">
                                {formatMessageTime(room.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          {room.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">
                              {room.type === 'general' && (
                                <span className="font-medium">{room.lastMessage.senderName}: </span>
                              )}
                              {room.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="team" className="m-0">
              <ScrollArea className="h-[350px]">
                {teamMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Users className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Nenhum membro da equipe</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {teamMembers.map((member) => (
                      <button
                        key={member.id}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                        onClick={() => handleSelectTeamMember(member.id)}
                      >
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={member.avatarUrl || undefined} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700">
                              {getInitials(member.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle
                            className={`absolute bottom-0 right-0 w-3 h-3 fill-current ${getStatusColor(member.status)}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          Chat
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
