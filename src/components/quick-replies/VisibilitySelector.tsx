import { Globe, User, Users, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';

interface Department {
  id: string;
  name: string;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

interface VisibilitySelectorProps {
  visibility: QuickReplyVisibility;
  onVisibilityChange: (visibility: QuickReplyVisibility) => void;
  selectedDepartmentId: string | null;
  onDepartmentChange: (departmentId: string | null) => void;
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string | null) => void;
  userDepartments: Department[];
  connections: Connection[];
}

const visibilityOptions: {
  value: QuickReplyVisibility;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: 'all',
    label: 'Todos da empresa',
    icon: <Globe className="w-4 h-4" />,
    description: 'Visível para todos os usuários',
  },
  {
    value: 'personal',
    label: 'Apenas eu',
    icon: <User className="w-4 h-4" />,
    description: 'Visível apenas para você',
  },
  {
    value: 'department',
    label: 'Meu departamento',
    icon: <Users className="w-4 h-4" />,
    description: 'Visível para membros do departamento',
  },
  {
    value: 'connection',
    label: 'Conexão específica',
    icon: <Smartphone className="w-4 h-4" />,
    description: 'Visível para usuários da conexão',
  },
];

export function VisibilitySelector({
  visibility,
  onVisibilityChange,
  selectedDepartmentId,
  onDepartmentChange,
  selectedConnectionId,
  onConnectionChange,
  userDepartments,
  connections,
}: VisibilitySelectorProps) {
  const hasDepartments = userDepartments.length > 0;
  const hasConnections = connections.length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Visibilidade</Label>
        <Select value={visibility} onValueChange={(v) => onVisibilityChange(v as QuickReplyVisibility)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibilityOptions.map((option) => {
              const isDisabled = 
                (option.value === 'department' && !hasDepartments) ||
                (option.value === 'connection' && !hasConnections);
              
              return (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={isDisabled}
                >
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {isDisabled 
                          ? (option.value === 'department' 
                              ? 'Você não está em nenhum departamento' 
                              : 'Nenhuma conexão disponível')
                          : option.description
                        }
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Department selector */}
      {visibility === 'department' && hasDepartments && (
        <div className="space-y-2">
          <Label>Departamento</Label>
          <Select 
            value={selectedDepartmentId || ''} 
            onValueChange={(v) => onDepartmentChange(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o departamento" />
            </SelectTrigger>
            <SelectContent>
              {userDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Connection selector */}
      {visibility === 'connection' && hasConnections && (
        <div className="space-y-2">
          <Label>Conexão</Label>
          <Select 
            value={selectedConnectionId || ''} 
            onValueChange={(v) => onConnectionChange(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a conexão" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  <div className="flex flex-col">
                    <span>{conn.name}</span>
                    <span className="text-xs text-muted-foreground">{conn.phone_number}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
