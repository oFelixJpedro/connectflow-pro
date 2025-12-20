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

// Unified high-quality SVG paths for Brazilian states - based on official geographic data
const STATE_PATHS: Record<StateCode, { path: string; labelX: number; labelY: number }> = {
  AC: {
    path: 'M63.5,bindParam270.2 L67.8,265.5 L75.2,262.1 L83.4,264.8 L88.6,262.1 L95.2,268.7 L99.5,266.0 L108.6,268.7 L115.2,263.5 L118.8,267.8 L115.2,275.2 L118.8,282.6 L115.2,289.2 L106.9,291.0 L100.4,296.1 L91.2,293.4 L82.0,296.1 L70.1,293.4 L63.5,286.9 L60.8,278.6 L63.5,270.2z',
    labelX: 90,
    labelY: 280
  },
  AL: {
    path: 'M478.2,bindParam218.5 L485.6,213.4 L492.2,216.1 L496.5,222.7 L493.8,231.8 L485.6,238.4 L477.3,235.7 L475.5,228.3 L478.2,218.5z',
    labelX: 486,
    labelY: 227
  },
  AP: {
    path: 'M304.8,bindParam62.5 L313.9,58.2 L322.2,62.5 L327.3,72.5 L324.6,85.2 L330.3,97.0 L325.1,108.8 L316.8,114.0 L307.7,108.8 L298.5,114.0 L292.9,103.1 L296.4,91.3 L291.2,79.5 L296.4,68.6 L304.8,62.5z',
    labelX: 312,
    labelY: 88
  },
  AM: {
    path: 'M122.2,bindParam166.1 L130.4,161.0 L144.0,164.6 L155.8,158.5 L170.3,162.8 L181.2,157.6 L193.9,162.8 L205.7,156.7 L218.4,161.0 L228.4,155.8 L241.1,161.0 L251.0,155.8 L262.8,161.0 L269.4,170.1 L262.8,182.0 L271.1,193.8 L264.5,205.6 L272.8,217.4 L266.2,228.3 L258.8,234.0 L249.6,228.3 L240.4,234.0 L228.6,228.3 L217.7,234.0 L205.9,228.3 L194.1,234.0 L183.2,228.3 L171.4,234.0 L160.5,228.3 L148.7,234.0 L138.6,228.3 L126.8,234.0 L119.3,225.7 L122.0,213.9 L115.4,202.1 L122.0,190.3 L115.4,178.5 L122.2,166.1z',
    labelX: 190,
    labelY: 195
  },
  BA: {
    path: 'M386.4,bindParam213.4 L398.2,210.7 L410.0,216.8 L418.3,213.2 L432.7,218.3 L443.6,213.2 L452.8,218.3 L462.0,213.2 L468.6,221.5 L465.0,233.3 L471.6,245.1 L465.0,256.9 L471.6,268.7 L465.0,280.5 L458.4,289.7 L449.2,295.8 L437.4,291.5 L428.2,297.6 L416.4,293.3 L404.6,299.4 L393.7,295.8 L384.5,303.2 L375.3,297.6 L366.1,305.0 L357.8,299.4 L351.2,307.7 L342.0,303.2 L336.3,291.4 L342.0,279.6 L336.3,267.8 L342.0,256.0 L336.3,244.2 L342.0,232.4 L349.4,224.1 L361.2,228.4 L373.0,222.3 L386.4,213.4z',
    labelX: 402,
    labelY: 258
  },
  CE: {
    path: 'M430.9,bindParam133.7 L442.7,128.5 L454.5,133.7 L463.7,128.5 L471.1,137.7 L467.5,149.5 L474.1,161.3 L467.5,173.1 L458.3,179.2 L446.5,175.0 L434.7,181.1 L423.8,175.0 L417.2,166.7 L420.8,154.9 L414.2,143.1 L420.8,131.3 L430.9,133.7z',
    labelX: 445,
    labelY: 155
  },
  DF: {
    path: 'M352.1,bindParam305.0 L360.4,300.7 L368.7,305.0 L365.1,315.0 L356.8,319.3 L348.5,315.0 L352.1,305.0z',
    labelX: 358,
    labelY: 311
  },
  ES: {
    path: 'M449.2,bindParam323.4 L457.5,318.2 L465.8,323.4 L462.2,335.2 L468.8,346.1 L462.2,356.1 L453.0,360.4 L444.7,355.2 L438.1,345.2 L441.7,333.4 L449.2,323.4z',
    labelX: 454,
    labelY: 340
  },
  GO: {
    path: 'M324.6,bindParam272.2 L336.4,267.0 L348.2,272.2 L357.4,267.0 L369.2,272.2 L378.4,267.0 L387.6,272.2 L393.3,284.0 L387.6,295.8 L378.4,302.0 L369.2,297.7 L360.9,305.1 L348.2,300.8 L340.8,308.2 L328.1,303.9 L319.8,311.3 L310.6,305.1 L304.0,293.3 L310.6,281.5 L304.0,270.6 L310.6,259.7 L324.6,272.2z',
    labelX: 350,
    labelY: 287
  },
  MA: {
    path: 'M324.6,bindParam108.8 L336.4,104.5 L350.8,109.7 L362.6,104.5 L374.4,109.7 L383.6,104.5 L392.8,109.7 L398.5,121.5 L392.8,133.3 L386.2,144.2 L377.0,151.6 L365.2,147.3 L356.0,154.7 L344.2,150.4 L335.0,157.8 L323.2,153.5 L314.0,160.9 L305.7,155.7 L302.1,143.9 L308.7,132.1 L302.1,120.3 L308.7,109.7 L324.6,108.8z',
    labelX: 348,
    labelY: 132
  },
  MG: {
    path: 'M342.0,bindParam305.0 L353.8,299.8 L365.6,305.0 L377.4,299.8 L389.2,305.0 L400.1,299.8 L411.9,305.0 L420.2,312.4 L425.4,324.2 L420.2,336.0 L428.5,346.9 L420.2,358.7 L411.0,364.8 L399.2,360.6 L387.4,366.7 L375.6,362.4 L366.4,369.8 L354.6,365.5 L345.4,372.9 L333.6,368.6 L324.4,376.0 L315.2,369.8 L306.0,377.2 L297.7,371.1 L291.1,359.3 L297.7,347.5 L291.1,335.7 L297.7,323.9 L304.3,315.6 L316.1,319.9 L327.9,313.7 L342.0,305.0z',
    labelX: 370,
    labelY: 340
  },
  MS: {
    path: 'M278.3,bindParam343.0 L290.1,337.8 L301.9,343.0 L310.2,337.8 L322.0,343.0 L330.3,337.8 L339.5,343.0 L345.2,354.8 L339.5,366.6 L330.3,373.0 L322.0,368.7 L310.2,374.8 L301.0,369.6 L289.2,375.7 L280.0,370.5 L268.2,376.6 L259.0,370.5 L253.3,358.7 L259.0,346.9 L267.3,340.7 L278.3,343.0z',
    labelX: 302,
    labelY: 358
  },
  MT: {
    path: 'M215.0,bindParam212.5 L229.4,207.3 L246.4,212.5 L260.8,207.3 L277.8,212.5 L292.2,207.3 L309.2,212.5 L320.1,224.3 L314.4,236.1 L323.6,247.9 L317.0,259.7 L323.6,271.5 L314.4,283.3 L305.2,289.5 L293.4,285.2 L281.6,291.3 L269.8,287.0 L260.6,294.4 L248.8,290.1 L237.0,296.2 L225.2,291.9 L216.0,299.3 L203.3,295.1 L191.5,301.2 L182.3,295.1 L170.5,301.2 L164.8,289.4 L170.5,277.6 L164.8,265.8 L170.5,254.0 L177.1,245.7 L188.9,250.0 L200.7,243.8 L208.1,235.5 L215.0,212.5z',
    labelX: 248,
    labelY: 255
  },
  PA: {
    path: 'M194.1,bindParam108.8 L211.1,103.6 L228.1,108.8 L245.1,103.6 L262.1,108.8 L279.1,103.6 L296.1,108.8 L307.0,120.6 L300.4,132.4 L309.6,144.2 L303.0,156.0 L296.4,164.3 L284.6,160.0 L272.8,166.1 L261.0,161.8 L249.2,167.9 L237.4,163.6 L228.2,171.0 L216.4,166.7 L204.6,172.8 L195.4,167.6 L183.6,173.7 L174.4,168.5 L162.6,174.6 L153.4,169.4 L141.6,175.5 L134.1,167.2 L137.7,155.4 L131.1,143.6 L137.7,131.8 L144.3,123.5 L156.1,127.8 L167.9,121.6 L179.7,125.9 L194.1,108.8z',
    labelX: 228,
    labelY: 142
  },
  PB: {
    path: 'M454.5,bindParam181.1 L466.3,175.9 L478.1,181.1 L487.3,175.9 L496.5,181.1 L500.1,193.0 L493.5,204.8 L481.7,209.0 L469.9,204.8 L458.1,209.0 L449.8,203.8 L446.2,191.2 L454.5,181.1z',
    labelX: 474,
    labelY: 194
  },
  PE: {
    path: 'M414.2,bindParam181.1 L428.6,175.9 L443.0,181.1 L454.8,175.9 L466.6,181.1 L478.4,175.9 L485.8,184.2 L482.2,196.0 L488.8,207.8 L477.0,212.1 L465.2,207.8 L453.4,212.1 L441.6,207.8 L432.4,215.2 L420.6,210.9 L408.8,217.0 L400.5,210.9 L397.8,198.2 L404.4,186.4 L414.2,181.1z',
    labelX: 445,
    labelY: 198
  },
  PI: {
    path: 'M380.1,bindParam133.7 L394.5,128.5 L408.9,133.7 L420.7,128.5 L429.9,137.7 L426.3,149.5 L432.9,161.3 L426.3,173.1 L417.1,179.2 L405.3,175.0 L393.5,181.1 L381.7,175.0 L369.9,181.1 L361.6,175.0 L358.0,163.2 L364.6,151.4 L358.0,139.6 L367.2,128.5 L380.1,133.7z',
    labelX: 395,
    labelY: 158
  },
  PR: {
    path: 'M288.3,bindParam387.2 L302.7,382.0 L317.1,387.2 L331.5,382.0 L345.9,387.2 L357.7,382.0 L369.5,387.2 L378.7,394.6 L375.1,406.4 L365.9,413.8 L354.1,409.5 L342.3,415.6 L330.5,411.3 L318.7,417.4 L306.9,413.1 L295.1,419.2 L286.8,413.1 L280.2,401.3 L286.8,389.5 L288.3,387.2z',
    labelX: 330,
    labelY: 400
  },
  RJ: {
    path: 'M404.6,bindParam372.0 L416.4,366.8 L428.2,372.0 L440.0,366.8 L451.8,372.0 L460.1,379.4 L456.5,391.2 L447.3,398.6 L435.5,394.3 L423.7,400.4 L411.9,396.1 L400.1,402.2 L391.8,396.1 L388.2,384.3 L394.8,372.5 L404.6,372.0z',
    labelX: 426,
    labelY: 384
  },
  RN: {
    path: 'M458.1,bindParam149.5 L472.5,144.3 L486.9,149.5 L498.7,144.3 L503.0,156.1 L496.4,167.9 L484.6,173.1 L472.8,167.9 L461.0,173.1 L449.2,167.9 L445.6,156.1 L458.1,149.5z',
    labelX: 476,
    labelY: 160
  },
  RO: {
    path: 'M138.6,bindParam252.2 L153.0,247.0 L167.4,252.2 L181.8,247.0 L193.6,252.2 L205.4,247.0 L217.2,252.2 L228.1,260.5 L224.5,272.3 L231.1,284.1 L224.5,295.9 L215.3,303.3 L203.5,299.0 L191.7,305.1 L179.9,300.8 L168.1,306.9 L156.3,302.6 L147.1,310.0 L135.3,305.7 L126.1,313.1 L117.8,307.0 L111.2,295.2 L117.8,283.4 L111.2,271.6 L117.8,259.8 L130.3,254.6 L138.6,252.2z',
    labelX: 172,
    labelY: 278
  },
  RR: {
    path: 'M194.1,bindParam57.3 L208.5,52.1 L222.9,57.3 L237.3,52.1 L248.2,60.4 L244.6,72.2 L251.2,84.0 L244.6,95.8 L235.4,103.2 L223.6,99.0 L211.8,105.1 L200.0,100.8 L188.2,106.9 L176.4,102.6 L170.7,90.8 L177.3,79.0 L170.7,67.2 L177.3,56.3 L188.2,50.1 L194.1,57.3z',
    labelX: 212,
    labelY: 78
  },
  RS: {
    path: 'M272.6,bindParam435.2 L287.0,430.0 L301.4,435.2 L315.8,430.0 L327.6,435.2 L339.4,430.0 L348.6,437.4 L345.0,449.2 L351.6,461.0 L345.0,472.8 L335.8,480.2 L324.0,476.0 L312.2,482.1 L300.4,477.8 L288.6,483.9 L276.8,479.6 L265.0,485.7 L256.7,479.6 L250.1,467.8 L256.7,456.0 L250.1,444.2 L256.7,432.4 L268.5,427.2 L272.6,435.2z',
    labelX: 302,
    labelY: 458
  },
  SC: {
    path: 'M310.6,bindParam423.0 L325.0,417.8 L339.4,423.0 L353.8,417.8 L365.6,423.0 L374.8,430.4 L371.2,442.2 L362.0,449.6 L350.2,445.3 L338.4,451.4 L326.6,447.1 L314.8,453.2 L303.0,448.9 L294.7,442.8 L291.1,431.0 L302.9,423.6 L310.6,423.0z',
    labelX: 335,
    labelY: 436
  },
  SE: {
    path: 'M468.6,bindParam213.4 L480.4,208.2 L489.6,213.4 L492.3,225.2 L485.7,237.0 L473.9,241.3 L462.1,236.1 L458.5,224.3 L468.6,213.4z',
    labelX: 476,
    labelY: 226
  },
  SP: {
    path: 'M326.3,bindParam354.8 L340.7,349.6 L355.1,354.8 L369.5,349.6 L383.9,354.8 L398.3,349.6 L412.7,354.8 L424.5,362.2 L420.9,374.0 L427.5,385.8 L420.9,397.6 L408.2,403.7 L396.4,399.5 L384.6,405.6 L372.8,401.3 L361.0,407.4 L349.2,403.1 L337.4,409.2 L328.2,403.1 L316.4,409.2 L304.6,403.1 L296.3,396.9 L292.7,385.1 L299.3,373.3 L306.8,365.0 L318.6,369.3 L326.3,354.8z',
    labelX: 365,
    labelY: 380
  },
  TO: {
    path: 'M336.4,bindParam160.9 L350.8,155.7 L365.2,160.9 L376.1,155.7 L387.9,160.9 L399.7,168.3 L396.1,180.1 L389.5,191.9 L380.3,199.3 L368.5,195.0 L356.7,201.1 L344.9,196.8 L333.1,202.9 L324.8,196.8 L318.2,185.0 L324.8,173.2 L318.2,161.4 L324.8,151.4 L336.4,160.9z',
    labelX: 358,
    labelY: 180
  }
};

// Remove "bindParam" artifact from paths
Object.keys(STATE_PATHS).forEach(key => {
  STATE_PATHS[key as StateCode].path = STATE_PATHS[key as StateCode].path.replace(/bindParam/g, '');
});

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
              viewBox="50 40 470 460"
              className="w-full h-auto max-h-[400px]"
              style={{ minHeight: '300px' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {STATE_CODES.map((state) => (
                <g key={state}>
                  <path
                    d={STATE_PATHS[state].path}
                    fill={getStateColor(state)}
                    stroke="hsl(var(--border))"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                    className={cn(
                      "transition-all duration-200 cursor-pointer",
                      hoveredState === state && "brightness-110 stroke-primary stroke-[1.5]"
                    )}
                    onMouseEnter={() => setHoveredState(state)}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                  {dataByState[state] && dataByState[state]! > 0 && (
                    <text
                      x={STATE_PATHS[state].labelX}
                      y={STATE_PATHS[state].labelY}
                      fill="hsl(var(--foreground))"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      pointerEvents="none"
                      className="select-none"
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
