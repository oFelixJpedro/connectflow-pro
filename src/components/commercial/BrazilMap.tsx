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

// Real SVG paths for Brazilian states
const STATE_PATHS: Record<StateCode, { path: string; labelX: number; labelY: number }> = {
  AC: {
    path: 'M118.8,240.5l-4.8-3.9l-6.8,2.2l-5.3-0.5l-3.4,3.4l-8.2,3.4l-5.8-1.9l-3.9-4.3l-10.1-2.9l-5.3,1.9l-4.3-1.5l-2.4,1.5l-8.7,0.5l-1,5.3l-5.8,5.8l0.5,8.7l4.3,4.8l-1,9.7l7.7,4.8l5.3-1.9l2.4,2.9l11.1-0.5l1.9,4.3l8.7-1l5.3-4.3l9.2,1l4.8-4.8l-1.9-5.8l4.8-7.2l10.1-2.9l1.5-8.7L118.8,240.5z',
    labelX: 68,
    labelY: 258
  },
  AL: {
    path: 'M493.7,187.4l-4.7,1l-8.4-6.1l-4.2,2.6l-2.1,5.2l-6.8,1.6l-1.6,5.7l4.7,3.1l2.6,7.3l7.3,5.2l11-13.1l4.2-4.7L493.7,187.4z',
    labelX: 481,
    labelY: 198
  },
  AP: {
    path: 'M330.4,64l-6.3,3.4l-0.5,6.8l-7.2,9.2l-13.6,4.8l-5.3,14.1l3.4,11.1l-1.5,11.6l7.2-0.5l6.8,8.7l10.6-1.9l5.8-5.8l0.5-12.6l8.2-7.2l-0.5-10.6l5.3-3.4l-0.5-10.1l-6.3-8.2L330.4,64z',
    labelX: 320,
    labelY: 105
  },
  AM: {
    path: 'M245.5,142l-12.1,1.9l-6.3,8.2l-16.5-1.5l-6.3,5.3l-1.5-6.3l-8.7-1.9l-17,6.8l-7.7-1.5l-7.2,2.4l-4.8,8.7l-13.1-1l-1,7.2l-4.8,1.5l-1,5.8l-4.8,1l-8.2,9.2l0.5,6.8l6.8,3.4l-1.9,8.2l4.3,4.3l-2.9,7.2l3.4,8.2l-4.3,5.8l-1,8.7l8.2,3.4l6.3-3.4l2.4,5.3l12.1-1l14.6,10.6l18.9-2.4l6.8-8.2l4.8,1.5l4.8-3.9l0.5-5.8l10.1-2.4l5.8,1.9l8.7-5.8l17.5,3.4l6.3-5.8l2.4,1.9l5.8-2.9l8.2,5.3l7.7-3.4l-1.9-9.2l9.7-0.5l2.9-11.6l-9.7-7.7l0.5-10.6l-6.8-2.4l-3.4-12.6l-4.8-5.3l-0.5-10.1l-8.7-8.7l2.4-3.4l-7.7-1.5l0.5-7.2l-8.7,5.8L245.5,142z',
    labelX: 175,
    labelY: 200
  },
  BA: {
    path: 'M471.8,205.3l-5.2-5.7l-7.8,0.5l-8.4-7.3l-10.4,1l-4.7,6.8l-14.1-2.6l-10.4,1l-0.5,7.3l-11.5,8.4l-27.1,3.1l-9.4,9.4l1.6,18.3l-7.3,2.6l-1,27.6l8.9,9.4l-1,11.5l10.4,7.8l12.5,0.5l4.7-11l9.9,1.6l8.4-8.9l13.6,7.8l6.8-0.5l5.2-7.3l11,2.1l3.6-5.2l-3.1-9.9l15.1-15.6l-1-5.7l4.7-13.6l8.9-8.4l-4.2-6.3l6.3-7.3L471.8,205.3z',
    labelX: 413,
    labelY: 260
  },
  CE: {
    path: 'M455.2,119l-2.6,2.6l3.6,6.3l-4.2,16.2l-12.5,13.6l-7.8-1l-11.5,6.3l-1.6-17.2l3.6-11.5l-3.1-11l6.8-9.4l7.8,5.2l8.9-5.2l6.3,0.5L455.2,119z',
    labelX: 435,
    labelY: 145
  },
  DF: {
    path: 'M370.3,282l-10.4,2.1l-2.6,8.4l5.7,7.3l10.4-2.6l2.6-8.4L370.3,282z',
    labelX: 368,
    labelY: 294
  },
  ES: {
    path: 'M453.1,303l-5.2,4.7l-14.1-2.1l-5.2,6.8l1.6,17.2l7.3,9.4l13.6-4.7l6.3-12.5l-1-12.5L453.1,303z',
    labelX: 445,
    labelY: 328
  },
  GO: {
    path: 'M366.7,250.9l-23.5,1.6l-5.2,5.7l-18.8,3.1l-2.1,8.4l6.8,6.8l-1.6,7.3l8.4,11l5.7,0.5l4.2,13.1l8.4,5.7l5.7-2.6l12.5,2.1l15.1-10.4l11,1.6l0.5-6.3l-7.8-9.9l2.6-11l-8.4-5.2l1.6-7.8l-8.9-5.2L366.7,250.9z',
    labelX: 355,
    labelY: 290
  },
  MA: {
    path: 'M385,95.3l-8.4,3.6l-1,9.4l-8.9,3.6l-6.3,8.4l-12.5-0.5l-5.7,5.2l-4.2-3.1l-11,1l-1,6.3l-6.8,3.6l2.1,9.9l-9.9,4.2l1,14.6l6.8,3.1l1.6,10.4l14.6-4.7l4.2-8.9l10.4-1.6l3.6,4.7l9.4-0.5l3.1,4.7l6.8-2.1l6.8,3.1l10.4-7.3l1-10.4l8.4-10.4l-4.7-5.2l5.2-16.2l-3.1-4.2l2.6-3.6l-4.7-6.3L385,95.3z',
    labelX: 355,
    labelY: 145
  },
  MT: {
    path: 'M309.3,200l-5.2,6.3l-17.2,5.7l-5.7-2.1l-1.6,5.2l-20.9-0.5l-22.4,3.6l-2.1-13.6l-14.1-10.4l2.6-10.4l-8.4,4.7l-2.6,5.2l-5.2-2.6l-3.1,10.4l-12,1l-1.6,8.4l-11,3.1l0.5,9.9l-7.8,4.2l-1.6,7.8l5.7,6.3l-2.1,14.1l4.2,5.2l-0.5,32.3l15.6-0.5l1.6,2.6l24.5-0.5l0.5,21.4l73.9,3.1l3.1-12l-4.2-10.4l1-12.5l4.7-4.2l6.3,2.6l5.7-6.3l-1-12l5.7-6.8l5.2,0.5l-0.5-5.7l7.8-8.4l-3.6-4.7l2.6-7.8l-4.2-9.4L309.3,200z',
    labelX: 245,
    labelY: 265
  },
  MS: {
    path: 'M316.1,312.1l-73.4-3.6l-0.5,14.1l-13.1,11.5l-0.5,9.4l-6.3,5.2l2.1,9.9l9.9,4.2l10.4,15.1l12.5,5.7l7.8-3.1l6.8,5.2l8.9-2.6l14.6,4.7l3.1-5.2l-2.1-10.4l8.4-11l-2.6-7.8l4.2-3.6l7.3-21.4L316.1,312.1z',
    labelX: 270,
    labelY: 360
  },
  MG: {
    path: 'M432.5,267.1l-6.3-4.7l-10.4,1.6l-4.2-6.3l-13.1,1.6l-7.3,6.3l-13.6-1.6l-14.6,10.4l-12.5-2.1l-5.7,2.6l-8.4-5.7l-4.2-12.5l-5.2-1l-8.4-11l1.6-7.3l-6.8-6.8l-6.3,6.3l-4.7,23.5l3.1,4.2l-3.6,16.2l4.2,4.2l16.2,5.2l10.4,10.4l8.9-4.7l7.8,9.4l14.1,1.6l9.4-5.2l5.7,6.8l16.2,7.3l11.5-5.2l2.6-8.4l6.3-1l1-10.4l9.4-3.6l5.7,1.6l5.7-5.2l-2.6-7.3L432.5,267.1z',
    labelX: 378,
    labelY: 305
  },
  PA: {
    path: 'M352.4,97.8l-7.8,3.6l-8.4-2.6l-3.6,4.7l-18.3-15.1l-3.6,4.2l-8.4-6.3l-7.3,0.5l-5.7,4.2l-10.4-1.6l-4.7,3.1l-13.1-5.7l-9.4,4.7l-2.1,7.8l-5.7-3.1l-14.6,5.7l-3.1-3.1l-11-1.6l-2.6,3.1l6.8,9.9l-3.6,4.7l5.7,7.3l-2.6,6.3l5.2,11.5l-1.6,8.4l9.2,10.1l1.5,11.6l8.7-5.8l17.5,1.5l6.3-5.3l16.5,1.5l6.3-8.2l12.1-1.9l1-6.8l6.3-1.5l8.7,8.2l5.3-3.4l6.3,2.9l15.5,0.5l4.8-4.8l8.7,1.5l3.4-7.7l5.3,0.5l3.4-5.8l-2.4-14.1l8.4-5.2l-4.2-8.9L352.4,97.8z',
    labelX: 285,
    labelY: 150
  },
  PB: {
    path: 'M492.7,156.8l-4.7,4.2l-12,1l-9.4,7.8l-15.6-1l-2.6,6.8l6.8,4.2l15.1-3.1l11.5,2.1l8.9-8.4l4.7-4.2L492.7,156.8z',
    labelX: 468,
    labelY: 170
  },
  PR: {
    path: 'M348.7,363.5l-6.3,4.2l-16.2-2.6l-5.7,3.1l-16.7,0.5l-8.4,8.9l-5.7-2.1l-5.7,4.7l0.5,12l-10.4,3.6l6.3,7.8l32.3,9.4l9.4-2.1l9.9,3.1l11.5-8.4l8.4,3.6l8.4-5.7l1.6-8.9l-7.8-11l6.3-11.5L348.7,363.5z',
    labelX: 305,
    labelY: 395
  },
  PE: {
    path: 'M493.2,175.8l-8.4,8.4l-12,0l-14.6,2.6l-5.7,4.2l-27.6-2.6l-4.7,7.8l10.4,6.8l7.8-0.5l8.4,7.3l5.2,0.5l4.7-7.3l10.4-1l14.1,3.1l7.8-3.6l3.1-6.8l4.7-1L493.2,175.8z',
    labelX: 460,
    labelY: 195
  },
  PI: {
    path: 'M419.5,120.5l-6.8,9.4l3.1,11l-3.6,11.5l2.1,19.3l9.4-7.3l9.9,4.2l12,1l4.7-7.3l27.6,2.6l2.6-7.3l-6.3-3.6l2.6-6.8l-3.6-6.3l-0.5-6.8l-10.4,4.7l-7.3-5.7l-7.3,5.7l-8.4-5.7l-7.8,2.1l-4.2-6.8L419.5,120.5z',
    labelX: 425,
    labelY: 155
  },
  RJ: {
    path: 'M428.3,343.5l-7.8,3.6l-11.5-0.5l-5.2,5.2l-17.2-1l-7.3,8.9l5.2,6.8l14.1,4.7l23-5.7l10.4-9.4l0.5-6.8L428.3,343.5z',
    labelX: 408,
    labelY: 358
  },
  RN: {
    path: 'M489.6,141.5l-4.7,4.2l-10.4,3.1l-9.4-2.1l-11.5,6.8l-1.6-7.8l4.7-8.4l12.5-1l5.7,3.6l10.4-3.6L489.6,141.5z',
    labelX: 470,
    labelY: 145
  },
  RS: {
    path: 'M327.1,410.8l-8.9,2.1l-9.4-3.1l-9.4,2.1l-32.8-9.4l-7.8,6.3l-5.2,13.1l4.2,8.4l-2.6,6.3l2.1,7.8l-9.4,13.1l7.8,15.6l5.2,1.6l6.3,6.8l12-1l10.4-5.2l1.6-8.4l7.3-2.1l3.6,4.2l9.9-7.8l-5.7-9.4l9.4-4.7l4.7-13.6l5.2,1.6l4.2-6.8l4.2,2.1l1.6-9.9L327.1,410.8z',
    labelX: 285,
    labelY: 450
  },
  RO: {
    path: 'M213.8,218l-11.5,1l-8.2,9.2l-7.2-1l-2.4,5.8l-8.2-3.4l-5.8,1.9l-4.8,7.2l1.9,5.8l-4.8,4.8l-9.2-1l-5.3,4.3l-8.7,1l-1.9-4.3l-11.1,0.5l-2.4-2.9l-5.3,1.9l-7.7-4.8l-1.5,5.8l5.3,10.6l7.7-1.9l1,7.2l4.3,1.9l-0.5,7.2l13.1,11.6l0.5,7.2l7.7,5.8l11.6-0.5l4.3-3.4l10.6,5.8l1-9.2l34.5,0.5l1-7.8l-5.2-6.8l2.1-14.1l-5.7-6.3l1.6-7.8l7.8-4.2l-0.5-9.9l11-3.1l1.6-8.4L213.8,218z',
    labelX: 165,
    labelY: 268
  },
  RR: {
    path: 'M214.4,49.7l-2.9,5.8l4.8,10.6l-1,9.7l7.7,10.6l-0.5,7.7l7.2,3.4l4.8,12.1l10.6,1l-2.4,6.8l7.2,7.2l0.5,7.7l5.3,1.5l3.4-5.8l10.6,7.7l7.2-4.8l-6.3-8.7l1.5-12.1l-3.4-11.1l5.3-14.6l13.6-4.3l7.2-9.2l0.5-6.8l-5.8-5.3l-5.3,0.5l-6.3,7.2l-5.8-7.2l-9.7,5.8l-5.8-5.3l-12.6,1.5l-9.7-6.8l-8.7,3.9l-5.3-4.8L214.4,49.7z',
    labelX: 245,
    labelY: 90
  },
  SC: {
    path: 'M354.4,410.3l-8.4,5.7l-8.4-3.6l-11.5,8.4l-10.4-3.1l2.6,9.4l-2.1,4.7l10.4,5.2l19.3-2.1l12.5,5.2l8.4-6.3l3.1-11.5l-6.8-8.9L354.4,410.3z',
    labelX: 330,
    labelY: 428
  },
  SP: {
    path: 'M383.6,308.4l-10.4,4.2l-5.2-6.8l-14.6-2.1l-6.8,9.9l-4.2,21.4l-7.3,3.6l2.6,7.8l-8.4,11l2.1,10.4l6.3,4.2l17.2,2.6l5.7-3.1l16.2,2.6l5.2-3.1l12-3.6l7.8,1l7.3-8.9l17.2,1l5.2-5.2l11.5,0.5l3.6-5.7l-15.6-6.8l-6.3-7.3l-9.4,5.2l-14.1-1.6l-7.8-9.4l-8.9,4.7l-11-10.4L383.6,308.4z',
    labelX: 360,
    labelY: 355
  },
  SE: {
    path: 'M478.4,199l-8.9,7.3l-3.1,9.4l7.3,6.8l12-7.8l0.5-7.3L478.4,199z',
    labelX: 475,
    labelY: 212
  },
  TO: {
    path: 'M375.5,168l-6.3,3.1l-3.6-4.7l-9.4,0.5l-4.7-3.6l-5.8,2.4l-4.3,8.7l-14.6,4.3l-1.5-10.6l-6.8-2.9l-2.6,15.1l-9.7,0.5l2.4,9.2l-8.2,3.4l5.2,10.4l-2.6,7.8l3.6,4.7l-7.8,8.4l0.5,5.7l-5.2-0.5l-5.7,6.8l1,12l6.3-6.3l6.8,6.8l2.1-8.4l18.8-3.1l5.2-5.7l23.5-1.6l7.8,6.8l8.4-5.2l2.6,6.3l13.1-1.6l-1.6-7.8l-10.4-7.8l1-11.5l-8.9-9.4l1-27.6L375.5,168z',
    labelX: 340,
    labelY: 215
  }
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
              viewBox="40 40 470 450"
              className="w-full h-auto max-h-[400px]"
              style={{ minHeight: '300px' }}
            >
              {STATE_CODES.map((state) => (
                <g key={state}>
                  <path
                    d={STATE_PATHS[state].path}
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
                  {dataByState[state] && dataByState[state]! > 0 && (
                    <text
                      x={STATE_PATHS[state].labelX}
                      y={STATE_PATHS[state].labelY}
                      fill="hsl(var(--foreground))"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      pointerEvents="none"
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
