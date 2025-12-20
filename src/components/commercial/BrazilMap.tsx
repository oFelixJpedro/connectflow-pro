import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Handshake } from 'lucide-react';
import { StateCode, getStateName, STATE_CODES } from '@/lib/dddMapping';
import { cn } from '@/lib/utils';

interface BrazilMapProps {
  contactsByState: Partial<Record<StateCode, number>>;
  dealsByState: Partial<Record<StateCode, number>>;
}

type MapFilter = 'contacts' | 'deals';

// SVG paths for Brazilian states (simplified)
const STATE_PATHS: Record<StateCode, string> = {
  AC: 'M50,280 L90,280 L90,320 L50,320 Z',
  AL: 'M450,240 L470,240 L470,260 L450,260 Z',
  AP: 'M280,80 L320,80 L320,130 L280,130 Z',
  AM: 'M100,150 L200,150 L200,250 L100,250 Z',
  BA: 'M380,200 L450,200 L450,300 L380,300 Z',
  CE: 'M420,140 L460,140 L460,180 L420,180 Z',
  DF: 'M310,280 L330,280 L330,295 L310,295 Z',
  ES: 'M420,320 L450,320 L450,360 L420,360 Z',
  GO: 'M280,260 L350,260 L350,330 L280,330 Z',
  MA: 'M340,120 L400,120 L400,180 L340,180 Z',
  MT: 'M180,230 L280,230 L280,340 L180,340 Z',
  MS: 'M220,340 L290,340 L290,420 L220,420 Z',
  MG: 'M340,290 L420,290 L420,380 L340,380 Z',
  PA: 'M200,100 L340,100 L340,200 L200,200 Z',
  PB: 'M450,180 L490,180 L490,200 L450,200 Z',
  PR: 'M270,400 L350,400 L350,450 L270,450 Z',
  PE: 'M430,200 L490,200 L490,230 L430,230 Z',
  PI: 'M380,140 L420,140 L420,210 L380,210 Z',
  RJ: 'M390,370 L430,370 L430,400 L390,400 Z',
  RN: 'M460,160 L500,160 L500,185 L460,185 Z',
  RS: 'M270,450 L350,450 L350,530 L270,530 Z',
  RO: 'M120,260 L180,260 L180,330 L120,330 Z',
  RR: 'M140,60 L200,60 L200,130 L140,130 Z',
  SC: 'M310,440 L370,440 L370,480 L310,480 Z',
  SP: 'M300,360 L390,360 L390,420 L300,420 Z',
  SE: 'M450,255 L475,255 L475,275 L450,275 Z',
  TO: 'M300,180 L360,180 L360,260 L300,260 Z',
};

export function BrazilMap({ contactsByState, dealsByState }: BrazilMapProps) {
  const [filter, setFilter] = useState<MapFilter>('contacts');
  const [hoveredState, setHoveredState] = useState<StateCode | null>(null);

  const dataByState = useMemo(() => {
    return filter === 'contacts' ? contactsByState : dealsByState;
  }, [filter, contactsByState, dealsByState]);

  const maxValue = useMemo(() => {
    return Math.max(...Object.values(dataByState), 1);
  }, [dataByState]);

  const getStateColor = (state: StateCode) => {
    const value = dataByState[state] || 0;
    if (value === 0) return 'hsl(var(--muted))';
    
    const intensity = value / maxValue;
    // Blue gradient from light to dark
    const lightness = 80 - (intensity * 50); // 80% to 30%
    return `hsl(217, 91%, ${lightness}%)`;
  };

  const sortedStates = useMemo(() => {
    return STATE_CODES
      .filter(code => dataByState[code] && dataByState[code] > 0)
      .sort((a, b) => (dataByState[b] || 0) - (dataByState[a] || 0))
      .slice(0, 5);
  }, [dataByState]);

  const total = useMemo(() => {
    return Object.values(dataByState).reduce((sum, val) => sum + (val || 0), 0);
  }, [dataByState]);

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
          <div className="relative">
            <svg
              viewBox="0 0 550 580"
              className="w-full h-auto max-h-[400px]"
            >
              {STATE_CODES.map((state) => (
                <g key={state}>
                  <path
                    d={STATE_PATHS[state]}
                    fill={getStateColor(state)}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    className={cn(
                      "transition-all duration-200 cursor-pointer",
                      hoveredState === state && "brightness-110 stroke-primary stroke-2"
                    )}
                    onMouseEnter={() => setHoveredState(state)}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                  {dataByState[state] && dataByState[state] > 0 && (
                    <text
                      x={parseInt(STATE_PATHS[state].match(/M(\d+)/)?.[1] || '0') + 20}
                      y={parseInt(STATE_PATHS[state].match(/,(\d+)/)?.[1] || '0') + 25}
                      fill="hsl(var(--foreground))"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {state}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            
            {/* Tooltip */}
            {hoveredState && (
              <div className="absolute top-2 left-2 bg-popover border rounded-lg p-2 shadow-lg z-10">
                <p className="font-semibold text-sm">{getStateName(hoveredState)}</p>
                <p className="text-muted-foreground text-xs">
                  {filter === 'contacts' ? 'Contatos' : 'Contratos'}: {dataByState[hoveredState] || 0}
                </p>
              </div>
            )}
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
