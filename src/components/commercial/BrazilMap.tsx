import { useState, useMemo } from 'react';
import BrazilHeatmap, { Tooltip } from 'react-brazil-heatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Handshake } from 'lucide-react';
import { StateCode, getStateName, STATE_CODES } from '@/lib/dddMapping';

interface BrazilMapProps {
  contactsByState: Partial<Record<StateCode, number>>;
  dealsByState: Partial<Record<StateCode, number>>;
}

type MapFilter = 'contacts' | 'deals';

export function BrazilMap({ contactsByState, dealsByState }: BrazilMapProps) {
  const [filter, setFilter] = useState<MapFilter>('contacts');

  const dataByState = useMemo(() => {
    return filter === 'contacts' ? contactsByState : dealsByState;
  }, [filter, contactsByState, dealsByState]);

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
    return max > 0 ? max : 1; // Use 1 as fallback to ensure proper scaling
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

  const tooltipContent = (meta: { name: string; value: number }) => (
    <div className="p-2">
      <p className="font-semibold text-sm">{meta.name}</p>
      <p className="text-xs">
        {filter === 'contacts' ? 'Contatos' : 'Contratos'}: {meta.value}
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
          <Select value={filter} onValueChange={(v) => setFilter(v as MapFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contacts">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contatos por estado
                </div>
              </SelectItem>
              <SelectItem value="deals">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4" />
                  Contratos fechados
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Map */}
          <div className="relative flex items-center justify-center min-h-[300px] brazil-map-container">
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
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Total de {filter === 'contacts' ? 'Contatos' : 'Contratos'}
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
                    Nenhum dado disponível
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
