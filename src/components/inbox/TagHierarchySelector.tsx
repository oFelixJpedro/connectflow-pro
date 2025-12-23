import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronsUpDown, X, Tag as TagIcon, Link, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';

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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [hoveredDepartmentId, setHoveredDepartmentId] = useState<string | null>(null);
  const [isHoverLocked, setIsHoverLocked] = useState(false);

  const isAllConnections = selectedConnectionId === ALL_CONNECTIONS_ID;
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        // Load all tags
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

        // Global tags (no department)
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

        // Load departments to map tags to connections
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

        // Load connections
        const { data: connections } = await supabase
          .from('whatsapp_connections')
          .select('id, name')
          .in('id', connectionIds)
          .order('name');

        // Load departments
        const { data: departments } = await supabase
          .from('departments')
          .select('id, name, color, whatsapp_connection_id')
          .in('whatsapp_connection_id', connectionIds)
          .eq('active', true)
          .order('name');

        // Map tags to departments
        const departmentIds = (departments || []).map(d => d.id);
        const deptTags = allTags.filter(t => t.department_id && departmentIds.includes(t.department_id));

        // Build hierarchy
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

  // All tags flat
  const allTags = useMemo(() => [
    ...globalTags,
    ...connectionsWithData.flatMap(c => c.tags),
  ], [globalTags, connectionsWithData]);

  // Selected tags with details
  const selectedTags = useMemo(() => 
    allTags.filter(t => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  // Filter by search
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

  const handleTagToggle = (tagId: string) => {
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

  const getTagsByConnection = (connectionId: string) => {
    const conn = connectionsWithData.find(c => c.id === connectionId);
    return conn?.tags || [];
  };

  const hasTags = allTags.length > 0;

  if (!hasTags && !isLoading) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
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
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-popover" 
          align="start"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Buscar tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>

          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {/* Global tags section */}
              {filteredGlobalTags.length > 0 && (
                <>
                  <div className="px-2 py-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Tags Globais
                    </p>
                  </div>
                  {filteredGlobalTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      <Checkbox
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <Label className="text-sm cursor-pointer truncate">
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                  {filteredConnections.length > 0 && (
                    <div className="my-2 border-t border-border" />
                  )}
                </>
              )}

              {/* Connections with departments and tags */}
              {filteredConnections.map((connection) => (
                <HoverCard 
                  key={connection.id}
                  openDelay={150}
                  closeDelay={100}
                  open={hoveredConnectionId === connection.id}
                  onOpenChange={(isOpen) => {
                    if (isOpen) {
                      if (!isHoverLocked) {
                        setHoveredConnectionId(connection.id);
                        setHoveredDepartmentId(null);
                      }
                    } else {
                      setHoveredConnectionId(null);
                      setIsHoverLocked(true);
                      setTimeout(() => setIsHoverLocked(false), 100);
                    }
                  }}
                >
                  <HoverCardTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                        "hover:bg-accent",
                        connection.tags.some(t => selectedTagIds.includes(t.id)) && "bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{connection.name}</span>
                        {connection.tags.filter(t => selectedTagIds.includes(t.id)).length > 0 && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {connection.tags.filter(t => selectedTagIds.includes(t.id)).length}
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent 
                    side="right" 
                    align="start" 
                    sideOffset={8}
                    className="w-56 p-0 bg-popover"
                  >
                    <div className="p-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Departamentos
                      </p>
                    </div>
                    <ScrollArea className="max-h-48">
                      <div className="p-2 space-y-1">
                        {connection.departments.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Nenhum departamento
                          </p>
                        ) : (
                          connection.departments.map((dept) => {
                            const deptTags = getTagsByDepartment(dept.id);
                            if (deptTags.length === 0) return null;
                            
                            return (
                              <HoverCard
                                key={dept.id}
                                openDelay={150}
                                closeDelay={100}
                                open={hoveredDepartmentId === dept.id}
                                onOpenChange={(isOpen) => {
                                  if (isOpen) {
                                    setHoveredDepartmentId(dept.id);
                                  } else {
                                    setHoveredDepartmentId(null);
                                  }
                                }}
                              >
                                <HoverCardTrigger asChild>
                                  <div
                                    className={cn(
                                      "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                                      "hover:bg-accent",
                                      deptTags.some(t => selectedTagIds.includes(t.id)) && "bg-accent/50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: dept.color || '#6366F1' }}
                                      />
                                      <span className="text-sm truncate">{dept.name}</span>
                                      {deptTags.filter(t => selectedTagIds.includes(t.id)).length > 0 && (
                                        <Badge variant="secondary" className="text-xs shrink-0">
                                          {deptTags.filter(t => selectedTagIds.includes(t.id)).length}
                                        </Badge>
                                      )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent 
                                  side="right" 
                                  align="start" 
                                  sideOffset={8}
                                  className="w-52 p-0 bg-popover"
                                >
                                  <div className="p-2 border-b border-border">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                      Tags
                                    </p>
                                  </div>
                                  <ScrollArea className="max-h-40">
                                    <div className="p-2 space-y-1">
                                      {deptTags.map((tag) => (
                                        <div
                                          key={tag.id}
                                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                                          onClick={() => handleTagToggle(tag.id)}
                                        >
                                          <Checkbox
                                            checked={selectedTagIds.includes(tag.id)}
                                            onCheckedChange={() => handleTagToggle(tag.id)}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: tag.color }}
                                          />
                                          <Label className="text-sm cursor-pointer truncate">
                                            {tag.name}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </HoverCardContent>
                </HoverCard>
              ))}

              {filteredGlobalTags.length === 0 && filteredConnections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag disponível'}
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Clear button */}
          {selectedTagIds.length > 0 && (
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onChange([])}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected tags badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs px-2 py-0.5 gap-1"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              {tag.name}
              <X
                className="h-3 w-3 cursor-pointer hover:opacity-70"
                onClick={(e) => handleRemoveTag(tag.id, e)}
              />
            </Badge>
          ))}
          {selectedTags.length > 3 && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              +{selectedTags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
