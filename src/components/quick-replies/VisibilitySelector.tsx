import { useEffect, useState } from 'react';
import { Globe, User, Building2, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
    label: 'Departamento',
    icon: <Building2 className="w-4 h-4" />,
    description: 'Visível para membros do departamento',
  },
  {
    value: 'connection',
    label: 'Conexão',
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
}: VisibilitySelectorProps) {
  const { profile, userRole } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load departments and connections based on user role
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.company_id || !profile?.id) return;
      
      setLoading(true);
      
      try {
        // Load departments
        if (isAdminOrOwner) {
          // Admin/owner sees all departments in the company
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name')
            .eq('active', true)
            .order('name');
          setDepartments(deptData || []);
        } else {
          // Regular user sees only their departments
          const { data: userDepts } = await supabase
            .from('department_users')
            .select('department_id')
            .eq('user_id', profile.id);
          
          if (userDepts && userDepts.length > 0) {
            const deptIds = userDepts.map(d => d.department_id);
            const { data: deptData } = await supabase
              .from('departments')
              .select('id, name')
              .in('id', deptIds)
              .eq('active', true)
              .order('name');
            setDepartments(deptData || []);
          }
        }

        // Load connections
        if (isAdminOrOwner) {
          // Admin/owner sees all connections in the company
          const { data: connData } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', profile.company_id)
            .eq('status', 'connected')
            .order('name');
          setConnections(connData || []);
        } else {
          // Regular user sees only their connections
          const { data: userConns } = await supabase
            .from('connection_users')
            .select('connection_id')
            .eq('user_id', profile.id);
          
          if (userConns && userConns.length > 0) {
            const connIds = userConns.map(c => c.connection_id);
            const { data: connData } = await supabase
              .from('whatsapp_connections')
              .select('id, name, phone_number')
              .in('id', connIds)
              .eq('company_id', profile.company_id)
              .eq('status', 'connected')
              .order('name');
            setConnections(connData || []);
          }
        }
      } catch (error) {
        console.error('Error loading visibility data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profile?.company_id, profile?.id, isAdminOrOwner]);

  const hasDepartments = departments.length > 0;
  const hasConnections = connections.length > 0;

  const renderDropdown = (option: typeof visibilityOptions[0]) => {
    if (option.value === 'department' && visibility === 'department' && hasDepartments) {
      return (
        <div className="mt-2 ml-7">
          <Select 
            value={selectedDepartmentId || ''} 
            onValueChange={(v) => onDepartmentChange(v || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o departamento" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    
    if (option.value === 'connection' && visibility === 'connection' && hasConnections) {
      return (
        <div className="mt-2 ml-7">
          <Select 
            value={selectedConnectionId || ''} 
            onValueChange={(v) => onConnectionChange(v || null)}
          >
            <SelectTrigger className="w-full">
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
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Visibilidade</Label>
        <RadioGroup 
          value={visibility} 
          onValueChange={(v) => onVisibilityChange(v as QuickReplyVisibility)}
          className="space-y-2"
        >
          {visibilityOptions.map((option) => {
            const isDisabled = 
              (option.value === 'department' && !hasDepartments) ||
              (option.value === 'connection' && !hasConnections);
            
            return (
              <div key={option.value}>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem 
                    value={option.value} 
                    id={`visibility-${option.value}`}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                  <Label 
                    htmlFor={`visibility-${option.value}`}
                    className={`flex-1 cursor-pointer ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isDisabled 
                        ? (option.value === 'department' 
                            ? 'Nenhum departamento disponível' 
                            : 'Nenhuma conexão disponível')
                        : option.description
                      }
                    </p>
                  </Label>
                </div>
                {renderDropdown(option)}
              </div>
            );
          })}
        </RadioGroup>
      </div>
    </div>
  );
}
