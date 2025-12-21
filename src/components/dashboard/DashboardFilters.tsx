import { useState, useEffect } from 'react';
import { Globe, User, Phone, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FilterType = 'general' | 'agent' | 'connection';

export interface DashboardFilter {
  type: FilterType;
  agentId?: string;
  connectionId?: string;
  departmentId?: string;
}

interface Agent {
  id: string;
  full_name: string;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

interface Department {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  isAdmin: boolean;
}

export function DashboardFilters({ filter, onFilterChange, isAdmin }: DashboardFiltersProps) {
  const { company } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingSecondary, setLoadingSecondary] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Load agents and connections data
  useEffect(() => {
    if (!company?.id || !isAdmin) return;

    const loadSecondaryData = async () => {
      setLoadingSecondary(true);
      try {
        if (filter.type === 'agent' && agents.length === 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_id', company.id)
            .eq('active', true)
            .order('full_name');
          setAgents(data || []);
        } else if (filter.type === 'connection' && connections.length === 0) {
          const { data } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', company.id)
            .eq('status', 'connected')
            .order('name');
          setConnections(data || []);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoadingSecondary(false);
      }
    };

    loadSecondaryData();
  }, [filter.type, company?.id, isAdmin, agents.length, connections.length]);

  // Load departments when a connection is selected
  useEffect(() => {
    if (!filter.connectionId) {
      setDepartments([]);
      return;
    }

    const loadDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const { data } = await supabase
          .from('departments')
          .select('id, name')
          .eq('whatsapp_connection_id', filter.connectionId)
          .eq('active', true)
          .order('name');
        setDepartments(data || []);
      } catch (error) {
        console.error('Error loading departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, [filter.connectionId]);

  // Don't render anything for non-admin users
  if (!isAdmin) return null;

  const handleTypeChange = (type: FilterType) => {
    onFilterChange({ type });
  };

  const handleSecondaryChange = (value: string) => {
    const newFilter: DashboardFilter = { type: filter.type };
    if (filter.type === 'agent') {
      newFilter.agentId = value;
    } else if (filter.type === 'connection') {
      newFilter.connectionId = value;
      // Reset department when connection changes
    }
    onFilterChange(newFilter);
  };

  const handleDepartmentChange = (value: string) => {
    onFilterChange({
      ...filter,
      departmentId: value === 'all' ? undefined : value,
    });
  };

  const getSecondaryValue = () => {
    if (filter.type === 'agent') return filter.agentId || '';
    if (filter.type === 'connection') return filter.connectionId || '';
    return '';
  };

  const getSecondaryPlaceholder = () => {
    if (filter.type === 'agent') return 'Selecionar atendente...';
    if (filter.type === 'connection') return 'Selecionar conexão...';
    return '';
  };

  const getSecondaryOptions = () => {
    if (filter.type === 'agent') {
      return agents.map(a => ({ value: a.id, label: a.full_name }));
    }
    if (filter.type === 'connection') {
      return connections.map(c => ({ value: c.id, label: `${c.name} (${c.phone_number})` }));
    }
    return [];
  };

  const getEmptyMessage = () => {
    if (filter.type === 'agent') return 'Nenhum atendente encontrado';
    if (filter.type === 'connection') return 'Nenhuma conexão ativa';
    return '';
  };

  const secondaryOptions = getSecondaryOptions();
  const showSecondaryDropdown = filter.type !== 'general';
  const showDepartmentDropdown = filter.type === 'connection' && filter.connectionId;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Primary Filter Type */}
      <Select value={filter.type} onValueChange={(v) => handleTypeChange(v as FilterType)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecionar filtro" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="general">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Geral
            </div>
          </SelectItem>
          <SelectItem value="agent">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Por Atendente
            </div>
          </SelectItem>
          <SelectItem value="connection">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Por Conexão
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Secondary Filter (Agent or Connection) */}
      {showSecondaryDropdown && (
        <Select 
          value={getSecondaryValue()} 
          onValueChange={handleSecondaryChange}
          disabled={loadingSecondary}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={getSecondaryPlaceholder()} />
          </SelectTrigger>
          <SelectContent>
            {secondaryOptions.length === 0 ? (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                {getEmptyMessage()}
              </div>
            ) : (
              secondaryOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {/* Tertiary Filter (Department - only when connection is selected) */}
      {showDepartmentDropdown && (
        <Select 
          value={filter.departmentId || 'all'} 
          onValueChange={handleDepartmentChange}
          disabled={loadingDepartments}
        >
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <SelectValue placeholder="Departamento..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                Todos departamentos
              </div>
            </SelectItem>
            {departments.length === 0 ? (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                Nenhum departamento
              </div>
            ) : (
              departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
