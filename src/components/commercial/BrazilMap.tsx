import { useState, useMemo } from 'react';
import BrazilHeatmap, { Tooltip } from 'react-brazil-heatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Handshake, Layers, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { StateCode, getStateName, STATE_CODES } from '@/lib/dddMapping';
import { useCRMStageMapData } from '@/hooks/useCRMStageMapData';

interface BrazilMapProps {
  contactsByState: Partial<Record<StateCode, number>>;
  dealsByState: Partial<Record<StateCode, number>>;
}

type MapFilter = 'contacts' | 'deals' | 'crm_stage';
type CRMSelectionStep = 'connection' | 'stage';

export function BrazilMap({ contactsByState, dealsByState }: BrazilMapProps) {
  const [filter, setFilter] = useState<MapFilter>('contacts');
  const [crmSelectionStep, setCrmSelectionStep] = useState<CRMSelectionStep>('connection');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnectionName, setSelectedConnectionName] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string>('');

  const { connections, stages, stageData, loading, loadingStages } = useCRMStageMapData(
    selectedConnectionId,
    selectedStageId
  );

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

  const tooltipContent = (meta: { name: string; value: number }) => (
    <div className="p-2">
      <p className="font-semibold text-sm">{meta.name}</p>
      <p className="text-xs">
        {getFilterLabel()}: {meta.value}
      </p>
    </div>
  );

  const handleFilterChange = (value: MapFilter) => {
    setFilter(value);
    if (value !== 'crm_stage') {
      // Reset CRM selection when switching away
      setCrmSelectionStep('connection');
      setSelectedConnectionId(null);
      setSelectedConnectionName('');
      setSelectedStageId(null);
      setSelectedStageName('');
    }
  };

  const handleConnectionSelect = (connectionId: string, connectionName: string) => {
    setSelectedConnectionId(connectionId);
    setSelectedConnectionName(connectionName);
    setCrmSelectionStep('stage');
    setSelectedStageId(null);
    setSelectedStageName('');
  };

  const handleStageSelect = (stageId: string, stageName: string) => {
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
  };

  const handleBackToConnections = () => {
    setCrmSelectionStep('connection');
    setSelectedConnectionId(null);
    setSelectedConnectionName('');
    setSelectedStageId(null);
    setSelectedStageName('');
  };

  const renderCRMSelector = () => {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-background w-[280px]">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          {crmSelectionStep === 'stage' && (
            <button
              onClick={handleBackToConnections}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-medium">
            {crmSelectionStep === 'connection' ? 'Selecionar Conexão' : selectedConnectionName}
          </span>
        </div>

        {/* Content */}
        <div className="max-h-[200px] overflow-y-auto">
          {crmSelectionStep === 'connection' && (
            <div className="p-1">
              {connections.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhuma conexão encontrada
                </div>
              ) : (
                connections.map(conn => (
                  <button
                    key={conn.id}
                    onClick={() => handleConnectionSelect(conn.id, conn.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                  >
                    <span>{conn.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          )}

          {crmSelectionStep === 'stage' && (
            <div className="p-1">
              {loadingStages ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : stages.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhuma etapa encontrada para esta conexão
                </div>
              ) : (
                stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => handleStageSelect(stage.id, stage.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors ${
                      selectedStageId === stage.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="flex-1 text-left">{stage.name}</span>
                    {selectedStageId === stage.id && (
                      <Badge variant="secondary" className="text-xs">
                        Selecionado
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Distribuição Geográfica
          </CardTitle>
          <Select value={filter} onValueChange={(v) => handleFilterChange(v as MapFilter)}>
            <SelectTrigger className="w-auto min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contacts">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Users className="w-4 h-4" />
                  Contatos por estado
                </div>
              </SelectItem>
              <SelectItem value="deals">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Handshake className="w-4 h-4" />
                  Contratos fechados
                </div>
              </SelectItem>
              <SelectItem value="crm_stage">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Layers className="w-4 h-4" />
                  Por etapa do CRM
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filter === 'crm_stage' && (
          <div className="flex justify-end mt-2">
            {renderCRMSelector()}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Map */}
          <div className="relative flex items-center justify-center min-h-[300px] brazil-map-container">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Carregando dados...</span>
              </div>
            ) : filter === 'crm_stage' && !selectedStageId ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground px-4 text-center">
                <Layers className="h-8 w-8" />
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
