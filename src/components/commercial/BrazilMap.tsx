import { useState, useMemo, useEffect } from 'react';
import BrazilHeatmap, { Tooltip } from 'react-brazil-heatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Handshake, Kanban, ChevronRight, Loader2, ChevronDown, Check, Wifi } from 'lucide-react';
import { StateCode, getStateName, STATE_CODES } from '@/lib/dddMapping';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BrazilMapProps {
  contactsByState: Partial<Record<StateCode, number>>;
  dealsByState: Partial<Record<StateCode, number>>;
}

type MapFilter = 'contacts' | 'deals' | 'crm_stage';

interface Connection {
  id: string;
  name: string;
}

interface CRMStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface CRMStageMapData {
  countByState: Partial<Record<StateCode, number>>;
  total: number;
}

// Helper to get state from phone number
const getStateFromPhone = (phone: string): StateCode | null => {
  const cleanPhone = phone.replace(/\D/g, '');
  const ddd = cleanPhone.startsWith('55') ? cleanPhone.substring(2, 4) : cleanPhone.substring(0, 2);
  
  const dddToState: Record<string, StateCode> = {
    '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
    '21': 'RJ', '22': 'RJ', '24': 'RJ',
    '27': 'ES', '28': 'ES',
    '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
    '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
    '47': 'SC', '48': 'SC', '49': 'SC',
    '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
    '61': 'DF',
    '62': 'GO', '64': 'GO',
    '63': 'TO',
    '65': 'MT', '66': 'MT',
    '67': 'MS',
    '68': 'AC',
    '69': 'RO',
    '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
    '79': 'SE',
    '81': 'PE', '87': 'PE',
    '82': 'AL',
    '83': 'PB',
    '84': 'RN',
    '85': 'CE', '88': 'CE',
    '86': 'PI', '89': 'PI',
    '91': 'PA', '93': 'PA', '94': 'PA',
    '92': 'AM', '97': 'AM',
    '95': 'RR',
    '96': 'AP',
    '98': 'MA', '99': 'MA',
  };
  
  return dddToState[ddd] || null;
};

export function BrazilMap({ contactsByState, dealsByState }: BrazilMapProps) {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<MapFilter>('contacts');
  const [menuOpen, setMenuOpen] = useState(false);
  
  // CRM selection state
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnectionName, setSelectedConnectionName] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string>('');
  
  // Cache for connections and stages
  const [connections, setConnections] = useState<Connection[]>([]);
  const [stagesCache, setStagesCache] = useState<Record<string, CRMStage[]>>({});
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingStagesFor, setLoadingStagesFor] = useState<string | null>(null);
  
  // Stage map data
  const [stageData, setStageData] = useState<CRMStageMapData | null>(null);
  const [loadingStageData, setLoadingStageData] = useState(false);

  // Fetch connections when menu opens
  useEffect(() => {
    if (menuOpen && connections.length === 0 && !loadingConnections && profile?.company_id) {
      fetchConnections();
    }
  }, [menuOpen, profile?.company_id]);

  // Fetch stage data when stage is selected
  useEffect(() => {
    if (selectedStageId) {
      fetchStageData(selectedStageId);
    }
  }, [selectedStageId]);

  const fetchConnections = async () => {
    if (!profile?.company_id) return;
    
    setLoadingConnections(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .order('name');
      
      if (!error && data) {
        setConnections(data);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const fetchStagesForConnection = async (connectionId: string) => {
    // Return cached if available
    if (stagesCache[connectionId]) return;
    
    setLoadingStagesFor(connectionId);
    try {
      // First get the board for this connection
      const { data: boardData } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('whatsapp_connection_id', connectionId)
        .single();
      
      if (boardData) {
        const { data: columnsData } = await supabase
          .from('kanban_columns')
          .select('id, name, color, position')
          .eq('board_id', boardData.id)
          .order('position');
        
        if (columnsData) {
          setStagesCache(prev => ({
            ...prev,
            [connectionId]: columnsData,
          }));
        }
      } else {
        // No board, set empty array
        setStagesCache(prev => ({
          ...prev,
          [connectionId]: [],
        }));
      }
    } catch (error) {
      console.error('Error fetching stages:', error);
    } finally {
      setLoadingStagesFor(null);
    }
  };

  const fetchStageData = async (stageId: string) => {
    setLoadingStageData(true);
    try {
      const { data: cardsData, error } = await supabase
        .from('kanban_cards')
        .select(`
          contact_id,
          contacts!inner(phone_number)
        `)
        .eq('column_id', stageId);
      
      if (!error && cardsData) {
        const countByState: Partial<Record<StateCode, number>> = {};
        let total = 0;
        
        cardsData.forEach((card: any) => {
          const phone = card.contacts?.phone_number;
          if (phone) {
            const state = getStateFromPhone(phone);
            if (state) {
              countByState[state] = (countByState[state] || 0) + 1;
              total++;
            }
          }
        });
        
        setStageData({ countByState, total });
      }
    } catch (error) {
      console.error('Error fetching stage data:', error);
    } finally {
      setLoadingStageData(false);
    }
  };

  const handleFilterSelect = (value: MapFilter) => {
    setFilter(value);
    if (value !== 'crm_stage') {
      // Reset CRM selection
      setSelectedConnectionId(null);
      setSelectedConnectionName('');
      setSelectedStageId(null);
      setSelectedStageName('');
      setStageData(null);
    }
    setMenuOpen(false);
  };

  const handleStageSelect = (connectionId: string, connectionName: string, stageId: string, stageName: string) => {
    setFilter('crm_stage');
    setSelectedConnectionId(connectionId);
    setSelectedConnectionName(connectionName);
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
    setMenuOpen(false);
  };

  const dataByState = useMemo(() => {
    if (filter === 'crm_stage' && stageData) {
      return stageData.countByState;
    }
    return filter === 'contacts' ? contactsByState : dealsByState;
  }, [filter, contactsByState, dealsByState, stageData]);

  // Convert data to the format expected by react-brazil-heatmap
  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {};
    STATE_CODES.forEach(code => {
      data[code] = dataByState[code] || 0;
    });
    return data;
  }, [dataByState]);

  // Calculate max value for domain - ensures all zeros show as white
  const maxValue = useMemo(() => {
    const values = Object.values(dataByState).filter(v => v !== undefined) as number[];
    const max = Math.max(...values, 0);
    return max > 0 ? max : 1;
  }, [dataByState]);

  // Create metadata for tooltips
  const metadata = useMemo(() => {
    const meta: Record<string, { name: string; value: number }> = {};
    STATE_CODES.forEach(code => {
      meta[code] = {
        name: getStateName(code),
        value: dataByState[code] || 0
      };
    });
    return meta;
  }, [dataByState]);

  const sortedStates = useMemo(() => {
    return STATE_CODES
      .filter(code => dataByState[code] && dataByState[code]! > 0)
      .sort((a, b) => (dataByState[b] || 0) - (dataByState[a] || 0))
      .slice(0, 5);
  }, [dataByState]);

  const total = useMemo(() => {
    return Object.values(dataByState).reduce((sum, val) => sum + (val || 0), 0);
  }, [dataByState]);

  const getFilterLabel = () => {
    if (filter === 'contacts') return 'Contatos';
    if (filter === 'deals') return 'Contratos';
    if (filter === 'crm_stage' && selectedStageName) return selectedStageName;
    return 'Etapa do CRM';
  };

  const getDropdownLabel = () => {
    if (filter === 'contacts') return 'Contatos por estado';
    if (filter === 'deals') return 'Contratos fechados';
    if (filter === 'crm_stage' && selectedStageName) {
      return `${selectedConnectionName} - ${selectedStageName}`;
    }
    return 'Por etapa do CRM';
  };

  const tooltipContent = (meta: { name: string; value: number }) => (
    <div className="p-2">
      <p className="font-semibold text-sm">{meta.name}</p>
      <p className="text-xs">
        {getFilterLabel()}: {meta.value}
      </p>
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Distribuição Geográfica
          </CardTitle>
          
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md bg-background hover:bg-accent transition-colors min-w-[180px] justify-between">
                <span className="truncate">{getDropdownLabel()}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              {/* Contatos por estado */}
              <DropdownMenuItem 
                onClick={() => handleFilterSelect('contacts')}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="flex-1">Contatos por estado</span>
                {filter === 'contacts' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              
              {/* Contratos fechados */}
              <DropdownMenuItem 
                onClick={() => handleFilterSelect('deals')}
                className="flex items-center gap-2"
              >
                <Handshake className="w-4 h-4" />
                <span className="flex-1">Contratos fechados</span>
                {filter === 'deals' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              
              {/* Por etapa do CRM - com submenus */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <Kanban className="w-4 h-4" />
                  <span>Por etapa do CRM</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[200px]">
                  {loadingConnections ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : connections.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhuma conexão encontrada
                    </div>
                  ) : (
                    connections.map(conn => (
                      <DropdownMenuSub key={conn.id}>
                        <DropdownMenuSubTrigger 
                          className="flex items-center gap-2"
                          onMouseEnter={() => fetchStagesForConnection(conn.id)}
                          onFocus={() => fetchStagesForConnection(conn.id)}
                        >
                          <Wifi className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{conn.name}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-[180px]">
                          {loadingStagesFor === conn.id ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : !stagesCache[conn.id] || stagesCache[conn.id].length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                              Nenhuma etapa
                            </div>
                          ) : (
                            stagesCache[conn.id].map(stage => (
                              <DropdownMenuItem
                                key={stage.id}
                                onClick={() => handleStageSelect(conn.id, conn.name, stage.id, stage.name)}
                                className="flex items-center gap-2"
                              >
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: stage.color }}
                                />
                                <span className="flex-1 truncate">{stage.name}</span>
                                {selectedStageId === stage.id && <Check className="h-4 w-4" />}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Map */}
          <div className="relative flex items-center justify-center min-h-[300px] brazil-map-container">
            {loadingStageData ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Carregando dados...</span>
              </div>
            ) : filter === 'crm_stage' && !selectedStageId ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground px-4 text-center">
                <Kanban className="h-8 w-8" />
                <span className="text-sm">Selecione uma conexão e etapa do CRM acima</span>
              </div>
            ) : (
              <div className="w-full max-w-[400px]">
                <BrazilHeatmap 
                  data={heatmapData} 
                  metadata={metadata}
                  colorRange={['#F8FAFC', '#1E40AF']}
                  domain={[0, maxValue]}
                >
                  <Tooltip
                    float
                    trigger="hover"
                    tooltipContent={tooltipContent}
                  />
                </BrazilHeatmap>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Total de {getFilterLabel()}
              </p>
              <p className="text-3xl font-bold text-foreground">{total}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Top 5 Estados
              </p>
              <div className="space-y-2">
                {sortedStates.map((state, index) => (
                  <div
                    key={state}
                    className="flex items-center justify-between bg-background rounded-lg p-2 border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className="font-medium">{state}</span>
                      <span className="text-muted-foreground text-sm">
                        {getStateName(state)}
                      </span>
                    </div>
                    <span className="font-semibold text-primary">
                      {dataByState[state]}
                    </span>
                  </div>
                ))}
                {sortedStates.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    {filter === 'crm_stage' && !selectedStageId 
                      ? 'Selecione uma etapa para ver os dados'
                      : 'Nenhum dado disponível'
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(217, 91%, 80%)' }} />
                <span className="text-xs text-muted-foreground">Baixo</span>
              </div>
              <div className="flex-1 h-2 rounded bg-gradient-to-r from-[hsl(217,91%,80%)] to-[hsl(217,91%,30%)]" />
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(217, 91%, 30%)' }} />
                <span className="text-xs text-muted-foreground">Alto</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
