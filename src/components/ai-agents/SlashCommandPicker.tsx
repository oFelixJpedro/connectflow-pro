import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Tag, 
  Bot, 
  User, 
  Kanban, 
  Bell, 
  Building2, 
  StopCircle,
  Search,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  insertText: string;
  needsSelection: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'add_tag',
    label: 'Adicionar Etiqueta',
    description: 'Adiciona uma tag ao contato',
    icon: Tag,
    iconColor: 'text-pink-500',
    insertText: '/adicionar_etiqueta:',
    needsSelection: true,
  },
  {
    id: 'transfer_agent',
    label: 'Transferir para Agente',
    description: 'Transfere para outro agente de IA',
    icon: Bot,
    iconColor: 'text-emerald-500',
    insertText: '/transferir_agente:',
    needsSelection: true,
  },
  {
    id: 'transfer_user',
    label: 'Transferir para Usuário',
    description: 'Transfere para um atendente humano',
    icon: User,
    iconColor: 'text-blue-500',
    insertText: '/transferir_usuario:',
    needsSelection: true,
  },
  {
    id: 'change_crm_stage',
    label: 'Mudar Etapa no CRM',
    description: 'Move o contato para outra etapa do funil',
    icon: Kanban,
    iconColor: 'text-purple-500',
    insertText: '/mudar_etapa_crm:',
    needsSelection: true,
  },
  {
    id: 'notify_team',
    label: 'Notificar Equipe',
    description: 'Envia notificação para a equipe',
    icon: Bell,
    iconColor: 'text-amber-500',
    insertText: '/notificar_equipe:',
    needsSelection: true,
  },
  {
    id: 'assign_department',
    label: 'Atribuir Departamento',
    description: 'Move a conversa para um departamento',
    icon: Building2,
    iconColor: 'text-cyan-500',
    insertText: '/atribuir_departamento:',
    needsSelection: true,
  },
  {
    id: 'deactivate_agent',
    label: 'Desativar Agente',
    description: 'Desativa o agente de IA permanentemente',
    icon: StopCircle,
    iconColor: 'text-red-500',
    insertText: '/desativar_agente',
    needsSelection: false,
  },
];

interface SlashCommandPickerProps {
  position: { x: number; y: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  searchTerm?: string;
}

export function SlashCommandPicker({ 
  position, 
  onSelect, 
  onClose,
  searchTerm = ''
}: SlashCommandPickerProps) {
  const [search, setSearch] = useState(searchTerm);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = useMemo(() => {
    if (!search) return SLASH_COMMANDS;
    const searchLower = search.toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description.toLowerCase().includes(searchLower)
    );
  }, [search]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: position.y + 8,
      }}
    >
      {/* Search Input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              // Remove "/" do valor para não interferir na busca
              const cleanValue = e.target.value.replace(/\//g, '');
              setSearch(cleanValue);
            }}
            onKeyDown={(e) => {
              // Previne "/" de ser digitada no campo de busca
              if (e.key === '/') {
                e.preventDefault();
              }
            }}
            placeholder="Buscar comando..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Commands List */}
      <div className="max-h-[280px] overflow-y-auto">
        <div className="p-1">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum comando encontrado
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => onSelect(cmd)}
                  className={cn(
                    'w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors',
                    index === selectedIndex 
                      ? 'bg-accent text-accent-foreground' 
                      : 'hover:bg-accent/50'
                  )}
                >
                  <div className={cn('mt-0.5', cmd.iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{cmd.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
