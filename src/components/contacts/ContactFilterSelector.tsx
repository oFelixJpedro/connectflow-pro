import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, X, Smartphone, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

interface Department {
  id: string;
  name: string;
  whatsapp_connection_id: string;
  color?: string;
}

interface ContactFilterSelectorProps {
  connections: Connection[];
  departments: Department[];
  selectedConnectionIds: string[];
  selectedDepartmentIds: string[];
  onConnectionChange: (connectionIds: string[]) => void;
  onDepartmentChange: (departmentIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ContactFilterSelector({
  connections,
  departments,
  selectedConnectionIds,
  selectedDepartmentIds,
  onConnectionChange,
  onDepartmentChange,
  disabled = false,
  className = '',
}: ContactFilterSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Group departments by connection
  const departmentsByConnection = useMemo(() => {
    const grouped: Record<string, Department[]> = {};
    departments.forEach((dept) => {
      if (!grouped[dept.whatsapp_connection_id]) {
        grouped[dept.whatsapp_connection_id] = [];
      }
      grouped[dept.whatsapp_connection_id].push(dept);
    });
    return grouped;
  }, [departments]);

  // Filter connections and departments based on search
  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const query = searchQuery.toLowerCase();
    return connections.filter((conn) => {
      const connMatches =
        conn.name?.toLowerCase().includes(query) ||
        conn.phone_number?.includes(query);
      const depts = departmentsByConnection[conn.id] || [];
      const deptMatches = depts.some((d) => d.name.toLowerCase().includes(query));
      return connMatches || deptMatches;
    });
  }, [connections, searchQuery, departmentsByConnection]);

  // Check if "all contacts" is selected (no filters)
  const isAllSelected =
    selectedConnectionIds.length === 0 && selectedDepartmentIds.length === 0;

  // Check if a connection is selected
  const isConnectionSelected = (connectionId: string) => {
    return selectedConnectionIds.includes(connectionId);
  };

  // Check if a department is selected
  const isDepartmentSelected = (departmentId: string) => {
    return selectedDepartmentIds.includes(departmentId);
  };

  // Check if all departments of a connection are selected
  const areAllDepartmentsSelected = (connectionId: string) => {
    const depts = departmentsByConnection[connectionId] || [];
    if (depts.length === 0) return false;
    return depts.every((d) => selectedDepartmentIds.includes(d.id));
  };

  // Check if some (but not all) departments of a connection are selected
  const areSomeDepartmentsSelected = (connectionId: string) => {
    const depts = departmentsByConnection[connectionId] || [];
    const selectedCount = depts.filter((d) =>
      selectedDepartmentIds.includes(d.id)
    ).length;
    return selectedCount > 0 && selectedCount < depts.length;
  };

  // Handle selecting "All contacts"
  const handleSelectAll = () => {
    onConnectionChange([]);
    onDepartmentChange([]);
  };

  // Handle connection toggle
  const handleConnectionToggle = (connectionId: string) => {
    const depts = departmentsByConnection[connectionId] || [];
    
    if (isConnectionSelected(connectionId)) {
      // Deselect connection and all its departments
      onConnectionChange(selectedConnectionIds.filter((id) => id !== connectionId));
      const deptIdsToRemove = depts.map((d) => d.id);
      onDepartmentChange(
        selectedDepartmentIds.filter((id) => !deptIdsToRemove.includes(id))
      );
    } else {
      // Select only the connection (without departments = all departments of this connection)
      onConnectionChange([...selectedConnectionIds, connectionId]);
    }
  };

  // Handle department toggle
  const handleDepartmentToggle = (departmentId: string, connectionId: string) => {
    if (isDepartmentSelected(departmentId)) {
      // Deselect department
      const newDeptIds = selectedDepartmentIds.filter((id) => id !== departmentId);
      onDepartmentChange(newDeptIds);
      
      // Check if connection should be deselected too
      const depts = departmentsByConnection[connectionId] || [];
      const remainingSelectedDepts = depts.filter((d) => newDeptIds.includes(d.id));
      if (remainingSelectedDepts.length === 0 && !isConnectionSelected(connectionId)) {
        // No departments selected and connection not directly selected, remove from filter
      }
    } else {
      // Select department
      onDepartmentChange([...selectedDepartmentIds, departmentId]);
      
      // If connection is selected (meaning "all departments"), we need to switch to specific departments
      if (isConnectionSelected(connectionId)) {
        const depts = departmentsByConnection[connectionId] || [];
        // Select all departments except keep the logic clean
        const allDeptIds = depts.map((d) => d.id);
        const currentDeptIds = selectedDepartmentIds.filter(
          (id) => !allDeptIds.includes(id)
        );
        onDepartmentChange([...currentDeptIds, departmentId]);
        onConnectionChange(selectedConnectionIds.filter((id) => id !== connectionId));
      }
    }
  };

  // Handle "Select all departments" toggle for a connection
  const handleSelectAllDepartments = (connectionId: string) => {
    const depts = departmentsByConnection[connectionId] || [];
    const deptIds = depts.map((d) => d.id);
    
    if (areAllDepartmentsSelected(connectionId)) {
      // Deselect all departments of this connection
      onDepartmentChange(
        selectedDepartmentIds.filter((id) => !deptIds.includes(id))
      );
    } else {
      // Select all departments of this connection
      const otherDeptIds = selectedDepartmentIds.filter(
        (id) => !deptIds.includes(id)
      );
      onDepartmentChange([...otherDeptIds, ...deptIds]);
      // Remove connection from direct selection
      onConnectionChange(selectedConnectionIds.filter((id) => id !== connectionId));
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    onConnectionChange([]);
    onDepartmentChange([]);
  };

  // Get display text for the button
  const getDisplayText = () => {
    if (isAllSelected) {
      return 'Todos os contatos';
    }
    
    const parts: string[] = [];
    
    if (selectedConnectionIds.length > 0) {
      parts.push(`${selectedConnectionIds.length} conexão(ões)`);
    }
    
    if (selectedDepartmentIds.length > 0) {
      parts.push(`${selectedDepartmentIds.length} departamento(s)`);
    }
    
    return parts.join(', ') || 'Todos os contatos';
  };

  // Get selected items for badges
  const getSelectedItems = () => {
    const items: { type: 'connection' | 'department'; id: string; name: string; color?: string }[] = [];
    
    selectedConnectionIds.forEach((id) => {
      const conn = connections.find((c) => c.id === id);
      if (conn) {
        items.push({
          type: 'connection',
          id: conn.id,
          name: conn.name || conn.phone_number,
        });
      }
    });
    
    selectedDepartmentIds.forEach((id) => {
      const dept = departments.find((d) => d.id === id);
      if (dept) {
        items.push({
          type: 'department',
          id: dept.id,
          name: dept.name,
          color: dept.color,
        });
      }
    });
    
    return items;
  };

  const selectedItems = getSelectedItems();

  // Count departments for a connection that are selected
  const getSelectedDepartmentCount = (connectionId: string) => {
    const depts = departmentsByConnection[connectionId] || [];
    return depts.filter((d) => selectedDepartmentIds.includes(d.id)).length;
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="w-full justify-between min-w-[220px]"
          >
            <div className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{getDisplayText()}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="min-w-[280px] max-h-[400px] overflow-hidden flex flex-col bg-popover"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conexão ou departamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1 max-h-[300px]">
            {/* All contacts option */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                handleSelectAll();
              }}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Todos os contatos</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Connections with departments */}
            {filteredConnections.map((connection) => {
              const depts = departmentsByConnection[connection.id] || [];
              const isConnSelected = isConnectionSelected(connection.id);
              const selectedDeptCount = getSelectedDepartmentCount(connection.id);
              const hasDepartments = depts.length > 0;

              if (!hasDepartments) {
                // Connection without departments - simple item
                return (
                  <DropdownMenuItem
                    key={connection.id}
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleConnectionToggle(connection.id);
                    }}
                  >
                    <Checkbox
                      checked={isConnSelected}
                      className="pointer-events-none"
                    />
                    <Smartphone className="h-4 w-4" />
                    <span className="flex-1 truncate">
                      {connection.name || connection.phone_number}
                    </span>
                  </DropdownMenuItem>
                );
              }

              // Connection with departments - submenu
              return (
                <DropdownMenuSub key={connection.id}>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isConnSelected || areAllDepartmentsSelected(connection.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleConnectionToggle(connection.id);
                      }}
                    />
                    <Smartphone className="h-4 w-4" />
                    <span className="flex-1 truncate">
                      {connection.name || connection.phone_number}
                    </span>
                    {(isConnSelected || selectedDeptCount > 0) && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {isConnSelected ? 'Todos' : selectedDeptCount}
                      </Badge>
                    )}
                  </DropdownMenuSubTrigger>
                  
                  <DropdownMenuSubContent className="min-w-[200px] bg-popover">
                    {/* Select all departments */}
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleConnectionToggle(connection.id);
                      }}
                    >
                      <Checkbox
                        checked={isConnSelected}
                        className="pointer-events-none"
                      />
                      <span className="font-medium">Selecionar todos</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Individual departments */}
                    {depts.map((dept) => (
                      <DropdownMenuItem
                        key={dept.id}
                        className="flex items-center gap-2 cursor-pointer"
                        onSelect={(e) => {
                          e.preventDefault();
                          handleDepartmentToggle(dept.id, connection.id);
                        }}
                      >
                        <Checkbox
                          checked={isDepartmentSelected(dept.id) || isConnSelected}
                          className="pointer-events-none"
                        />
                        {dept.color && (
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: dept.color }}
                          />
                        )}
                        <span className="truncate">{dept.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}

            {filteredConnections.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma conexão encontrada
              </div>
            )}
          </div>

          {/* Clear filters */}
          {!isAllSelected && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                onSelect={(e) => {
                  e.preventDefault();
                  handleClearFilters();
                }}
              >
                <X className="h-4 w-4" />
                <span>Limpar seleção</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected badges */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map((item) => (
            <Badge
              key={`${item.type}-${item.id}`}
              variant="secondary"
              className="text-xs flex items-center gap-1 pr-1"
            >
              {item.type === 'connection' ? (
                <Smartphone className="h-3 w-3" />
              ) : item.color ? (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              ) : null}
              <span className="truncate max-w-[100px]">{item.name}</span>
              <button
                type="button"
                className="ml-1 hover:bg-muted rounded p-0.5"
                onClick={() => {
                  if (item.type === 'connection') {
                    handleConnectionToggle(item.id);
                  } else {
                    const dept = departments.find((d) => d.id === item.id);
                    if (dept) {
                      handleDepartmentToggle(item.id, dept.whatsapp_connection_id);
                    }
                  }
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
