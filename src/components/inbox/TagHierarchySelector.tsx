import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, X, Tag as TagIcon, Link, Globe, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Tag {
  id: string;
  name: string;
  color: string;
  departmentId: string | null;
  connectionId: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string | null;
  connectionId: string;
}

interface Connection {
  id: string;
  name: string;
}

interface ConnectionWithData extends Connection {
  departments: Department[];
  tags: Tag[];
}

interface TagHierarchySelectorProps {
  selectedConnectionId: string | null;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

function toPastelColor(hexColor: string): { background: string; text: string } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) || 128;
  const g = parseInt(hex.substr(2, 2), 16) || 128;
  const b = parseInt(hex.substr(4, 2), 16) || 128;
  
  const pastelR = Math.round(r * 0.3 + 255 * 0.7);
  const pastelG = Math.round(g * 0.3 + 255 * 0.7);
  const pastelB = Math.round(b * 0.3 + 255 * 0.7);
  
  return {
    background: `rgb(${pastelR}, ${pastelG}, ${pastelB})`,
    text: hexColor,
  };
}

export function TagHierarchySelector({
  selectedConnectionId,
  selectedTagIds,
  onChange,
  disabled = false,
  className,
}: TagHierarchySelectorProps) {
  const { profile, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionsWithData, setConnectionsWithData] = useState<ConnectionWithData[]>([]);
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAllConnections = selectedConnectionId === ALL_CONNECTIONS_ID;
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        const { data: allTags } = await supabase
          .from('tags')
          .select('id, name, color, department_id')
          .order('name');

        if (!allTags) {
          setConnectionsWithData([]);
          setGlobalTags([]);
          setIsLoading(false);
          return;
        }

        const globalTagsList = allTags
          .filter(t => !t.department_id)
          .map(t => ({
            id: t.id,
            name: t.name,
            color: t.color || '#6366F1',
            departmentId: null,
            connectionId: null,
          }));
        setGlobalTags(globalTagsList);

        let connectionIds: string[] = [];
        
        if (isAllConnections || !selectedConnectionId) {
          if (isAdminOrOwner) {
            const { data: connections } = await supabase
              .from('whatsapp_connections')
              .select('id, name')
              .eq('company_id', profile.company_id)
              .eq('active', true)
              .order('name');
            
            if (connections) {
              connectionIds = connections.map(c => c.id);
            }
          } else {
            const { data: userConnections } = await supabase
              .from('connection_users')
              .select('connection_id, whatsapp_connections(id, name)')
              .eq('user_id', profile.id);

            if (userConnections) {
              connectionIds = userConnections
                .filter(uc => uc.whatsapp_connections)
                .map(uc => (uc.whatsapp_connections as any).id);
            }
          }
        } else {
          connectionIds = [selectedConnectionId];
        }

        if (connectionIds.length === 0) {
          setConnectionsWithData([]);
          setIsLoading(false);
          return;
        }

        const { data: connections } = await supabase
          .from('whatsapp_connections')
          .select('id, name')
          .in('id', connectionIds)
          .order('name');

        const { data: departments } = await supabase
          .from('departments')
          .select('id, name, color, whatsapp_connection_id')
          .in('whatsapp_connection_id', connectionIds)
          .eq('active', true)
          .order('name');

        const departmentIds = (departments || []).map(d => d.id);
        const deptTags = allTags.filter(t => t.department_id && departmentIds.includes(t.department_id));

        const result: ConnectionWithData[] = (connections || []).map(conn => {
          const connDepts = (departments || [])
            .filter(d => d.whatsapp_connection_id === conn.id)
            .map(d => ({
              id: d.id,
              name: d.name,
              color: d.color,
              connectionId: d.whatsapp_connection_id,
            }));

          const connTags = deptTags
            .filter(t => connDepts.some(d => d.id === t.department_id))
            .map(t => ({
              id: t.id,
              name: t.name,
              color: t.color || '#6366F1',
              departmentId: t.department_id,
              connectionId: conn.id,
            }));

          return {
            id: conn.id,
            name: conn.name,
            departments: connDepts,
            tags: connTags,
          };
        });

        setConnectionsWithData(result.filter(c => c.tags.length > 0 || c.departments.length > 0));
      } catch (error) {
        console.error('[TagHierarchySelector] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedConnectionId, profile?.company_id, profile?.id, isAllConnections, isAdminOrOwner]);

  const allTags = useMemo(() => [
    ...globalTags,
    ...connectionsWithData.flatMap(c => c.tags),
  ], [globalTags, connectionsWithData]);

  const selectedTags = useMemo(() => 
    allTags.filter(t => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  const filteredGlobalTags = useMemo(() => {
    if (!searchQuery) return globalTags;
    const query = searchQuery.toLowerCase();
    return globalTags.filter(t => t.name.toLowerCase().includes(query));
  }, [globalTags, searchQuery]);

  const filteredConnections = useMemo(() => {
    if (!searchQuery) return connectionsWithData;
    const query = searchQuery.toLowerCase();
    return connectionsWithData.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.departments.some(d => d.name.toLowerCase().includes(query)) ||
      c.tags.some(t => t.name.toLowerCase().includes(query))
    );
  }, [connectionsWithData, searchQuery]);

  const handleTagToggle = (tagId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedTagIds.filter(id => id !== tagId));
  };

  const getTagsByDepartment = (departmentId: string) => {
    return connectionsWithData
      .flatMap(c => c.tags)
      .filter(t => t.departmentId === departmentId);
  };

  const hasTags = allTags.length > 0;

  if (!hasTags && !isLoading) {
    return null;
  }

  const selectedGlobalCount = globalTags.filter(t => selectedTagIds.includes(t.id)).length;

  return (
    <div className={cn("space-y-2", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || isLoading}
            className={cn(
              'w-full justify-between font-normal h-9',
              selectedTagIds.length === 0 && 'text-muted-foreground'
            )}
          >
            <span className="truncate flex items-center gap-2">
              <TagIcon className="w-4 h-4 shrink-0" />
              {selectedTagIds.length === 0
                ? 'Todas as tags'
                : selectedTagIds.length === 1
                ? selectedTags[0]?.name
                : `${selectedTagIds.length} tags`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="start">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          <div className="max-h-64 overflow-y-auto">
            {/* Global tags */}
            {filteredGlobalTags.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">Tags Globais</span>
                  {selectedGlobalCount > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {selectedGlobalCount}
                    </Badge>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px]">
                  {filteredGlobalTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <DropdownMenuItem
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => handleTagToggle(tag.id, e)}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 truncate">{tag.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {filteredGlobalTags.length > 0 && filteredConnections.length > 0 && (
              <DropdownMenuSeparator />
            )}

            {/* Connections with departments and tags */}
            {filteredConnections.map((connection) => {
              const connectionSelectedCount = connection.tags.filter(t => selectedTagIds.includes(t.id)).length;
              
              return (
                <DropdownMenuSub key={connection.id}>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                    <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{connection.name}</span>
                    {connectionSelectedCount > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {connectionSelectedCount}
                      </Badge>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[200px]">
                    {connection.departments.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        Nenhum departamento
                      </div>
                    ) : (
                      connection.departments.map((dept) => {
                        const deptTags = getTagsByDepartment(dept.id);
                        const deptSelectedCount = deptTags.filter(t => selectedTagIds.includes(t.id)).length;
                        
                        if (deptTags.length === 0) {
                          return (
                            <DropdownMenuItem
                              key={dept.id}
                              className="flex items-center gap-2 opacity-50"
                              disabled
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: dept.color || '#6366F1' }}
                              />
                              <span className="flex-1 truncate">{dept.name}</span>
                              <span className="text-xs text-muted-foreground">sem tags</span>
                            </DropdownMenuItem>
                          );
                        }

                        return (
                          <DropdownMenuSub key={dept.id}>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: dept.color || '#6366F1' }}
                              />
                              <span className="flex-1 truncate">{dept.name}</span>
                              {deptSelectedCount > 0 && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {deptSelectedCount}
                                </Badge>
                              )}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="min-w-[180px]">
                              {deptTags.map((tag) => {
                                const isSelected = selectedTagIds.includes(tag.id);
                                return (
                                  <DropdownMenuItem
                                    key={tag.id}
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={(e) => handleTagToggle(tag.id, e)}
                                  >
                                    <Checkbox checked={isSelected} className="pointer-events-none" />
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="flex-1 truncate">{tag.name}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        );
                      })
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}

            {filteredGlobalTags.length === 0 && filteredConnections.length === 0 && (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">
                  {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma tag disponível'}
                </span>
              </div>
            )}
          </div>

          {/* Clear button */}
          {selectedTagIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center justify-center gap-1 text-muted-foreground cursor-pointer"
                onClick={() => onChange([])}
              >
                <X className="w-4 h-4" />
                Limpar seleção
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.slice(0, 3).map((tag) => {
            const pastelStyle = toPastelColor(tag.color);
            return (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs px-2 py-0.5 gap-1"
                style={{
                  backgroundColor: pastelStyle.background,
                  color: pastelStyle.text,
                }}
              >
                {tag.name}
                <button
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="ml-0.5 hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {selectedTags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{selectedTags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
