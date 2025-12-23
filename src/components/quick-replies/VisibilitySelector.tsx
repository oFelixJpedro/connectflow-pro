import { useEffect, useState, useMemo } from 'react';
import { Globe, User, Building2, Wifi } from 'lucide-react';
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
  whatsapp_connection_id: string;
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
    icon: <Wifi className="w-4 h-4" />,
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
  
  // Local state for connection selection when choosing department
  const [selectedConnectionForDepartment, setSelectedConnectionForDepartment] = useState<string | null>(null);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load departments and connections based on user role
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.company_id || !profile?.id) return;
      
      setLoading(true);
      
      try {
        // Load departments with whatsapp_connection_id
        if (isAdminOrOwner) {
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name, whatsapp_connection_id')
            .eq('active', true)
            .order('name');
          setDepartments(deptData || []);
        } else {
          const { data: userDepts } = await supabase
            .from('department_users')
            .select('department_id')
            .eq('user_id', profile.id);
          
          if (userDepts && userDepts.length > 0) {
            const deptIds = userDepts.map(d => d.department_id);
            const { data: deptData } = await supabase
              .from('departments')
              .select('id, name, whatsapp_connection_id')
              .in('id', deptIds)
              .eq('active', true)
              .order('name');
            setDepartments(deptData || []);
          }
        }

        // Load connections
        if (isAdminOrOwner) {
          const { data: connData } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', profile.company_id)
            .eq('status', 'connected')
            .order('name');
          setConnections(connData || []);
        } else {
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

  // Initialize selectedConnectionForDepartment when editing
  useEffect(() => {
    if (visibility === 'department' && selectedDepartmentId) {
      const dept = departments.find(d => d.id === selectedDepartmentId);
      if (dept) {
        setSelectedConnectionForDepartment(dept.whatsapp_connection_id);
      }
    }
  }, [visibility, selectedDepartmentId, departments]);

  // Group departments by connection
  const departmentsByConnection = useMemo(() => {
    const grouped: Record<string, Department[]> = {};
    departments.forEach((dept) => {
      const connId = dept.whatsapp_connection_id;
      if (!grouped[connId]) grouped[connId] = [];
      grouped[connId].push(dept);
    });
    return grouped;
  }, [departments]);

  // Get connections that have departments
  const connectionsWithDepartments = useMemo(() => {
    return connections.filter(conn => departmentsByConnection[conn.id]?.length > 0);
  }, [connections, departmentsByConnection]);

  // Filtered departments based on selected connection
  const filteredDepartments = useMemo(() => {
    if (!selectedConnectionForDepartment) return [];
    return departmentsByConnection[selectedConnectionForDepartment] || [];
  }, [departmentsByConnection, selectedConnectionForDepartment]);

  const hasDepartments = departments.length > 0;
  const hasConnections = connections.length > 0;

  const renderDropdown = (option: typeof visibilityOptions[0]) => {
    if (option.value === 'department' && visibility === 'department' && hasDepartments) {
      return (
        <div className="mt-2 ml-7 space-y-2">
          {/* Connection selector for department filtering */}
          <Select 
            value={selectedConnectionForDepartment || ''} 
            onValueChange={(v) => {
              setSelectedConnectionForDepartment(v || null);
              onDepartmentChange(null); // Clear department when connection changes
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a conexão" />
            </SelectTrigger>
            <SelectContent>
              {connectionsWithDepartments.map((conn) => (
                <SelectItem key={conn.id} value={conn.id} className="items-start">
                  <div className="flex flex-col items-start text-left">
                    <span>{conn.name}</span>
                    <span className="text-xs text-muted-foreground">{conn.phone_number}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department selector - only shows after connection is selected */}
          {selectedConnectionForDepartment && filteredDepartments.length > 0 && (
            <Select 
              value={selectedDepartmentId || ''} 
              onValueChange={(v) => onDepartmentChange(v || null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {filteredDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedConnectionForDepartment && filteredDepartments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum departamento encontrado para esta conexão
            </p>
          )}
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
                <SelectItem key={conn.id} value={conn.id} className="items-start">
                  <div className="flex flex-col items-start text-left">
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
          onValueChange={(v) => {
            onVisibilityChange(v as QuickReplyVisibility);
            // Reset selections when changing visibility type
            if (v !== 'department') {
              setSelectedConnectionForDepartment(null);
              onDepartmentChange(null);
            }
            if (v !== 'connection') {
              onConnectionChange(null);
            }
          }}
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
