import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Department {
  id: string;
  name: string;
  color: string;
}

interface DepartmentSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  connectionId?: string;
}

export function DepartmentSelector({ position, onSelect, onClose, connectionId }: DepartmentSelectorProps) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!profile?.company_id) return;
      
      try {
        let query = supabase
          .from('departments')
          .select(`
            id,
            name,
            color,
            whatsapp_connections!inner(company_id)
          `)
          .eq('active', true)
          .order('name');
        
        if (connectionId) {
          query = query.eq('whatsapp_connection_id', connectionId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Filter by company
        const filtered = (data || []).filter(d => {
          const conn = d.whatsapp_connections as any;
          return conn.company_id === profile.company_id;
        });
        
        setDepartments(filtered.map(d => ({
          id: d.id,
          name: d.name,
          color: d.color || '#3B82F6'
        })));
      } catch (err) {
        console.error('Error fetching departments:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDepartments();
  }, [profile?.company_id, connectionId]);

  const filteredDepartments = useMemo(() => {
    if (!search) return departments;
    const searchLower = search.toLowerCase();
    return departments.filter(d => d.name.toLowerCase().includes(searchLower));
  }, [departments, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredDepartments.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredDepartments.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredDepartments.length) % filteredDepartments.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredDepartments[selectedIndex]) {
            handleSelect(filteredDepartments[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredDepartments, selectedIndex, onClose]);

  const handleSelect = (deptName: string) => {
    const slug = deptName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    onSelect(slug);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: position.y + 8,
      }}
    >
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar departamento..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="max-h-60">
        <div className="p-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum departamento encontrado
            </div>
          ) : (
            filteredDepartments.map((dept, index) => (
              <button
                key={dept.id}
                onClick={() => handleSelect(dept.name)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50'
                )}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dept.color }}
                />
                <span className="text-sm truncate">{dept.name}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
