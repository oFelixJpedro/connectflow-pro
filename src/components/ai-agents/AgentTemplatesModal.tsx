import { Bot, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useState } from 'react';

interface AgentTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelected: (templateId: string) => void;
}

export function AgentTemplatesModal({
  open,
  onOpenChange,
  onTemplateSelected,
}: AgentTemplatesModalProps) {
  const { templates } = useAIAgents();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Modelos de Agentes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Bot className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum modelo disponível</h3>
                <p className="text-muted-foreground text-sm">
                  Os modelos de agentes estarão disponíveis em breve.
                </p>
                <Badge variant="outline" className="mt-4">Em breve</Badge>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum modelo encontrado para "{searchQuery}"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => onTemplateSelected(template.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold line-clamp-1">{template.name}</h3>
                          {template.category && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {template.category}
                            </Badge>
                          )}
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Usado {template.usage_count} vezes
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
