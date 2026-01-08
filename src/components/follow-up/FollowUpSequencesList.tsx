import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreVertical, Play, Pause, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFollowUpSequences } from '@/hooks/useFollowUpSequences';
import { FollowUpSequenceForm } from './FollowUpSequenceForm';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FOLLOWUP_TYPE_LABELS, 
  STATUS_CONFIG,
  DELAY_UNIT_LABELS,
  type FollowUpSequence 
} from '@/types/follow-up';

export function FollowUpSequencesList() {
  const { sequences, isLoading, toggleStatus, deleteSequence } = useFollowUpSequences();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSequence, setEditingSequence] = useState<FollowUpSequence | null>(null);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FollowUpSequence | null>(null);

  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (sequence: FollowUpSequence) => {
    setEditingSequence(sequence);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteSequence(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleToggleStatus = async (sequence: FollowUpSequence) => {
    const newStatus = sequence.status === 'active' ? 'paused' : 'active';
    await toggleStatus(sequence.id, newStatus);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar sequências..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setEditingSequence(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Sequência
        </Button>
      </div>

      {/* Sequences List */}
      {filteredSequences.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'Nenhuma sequência encontrada' : 'Nenhuma sequência de follow-up criada'}
            </p>
            {!searchQuery && (
              <Button 
                variant="link" 
                onClick={() => setShowForm(true)}
                className="mt-2"
              >
                Criar primeira sequência
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSequences.map((sequence) => (
            <Collapsible
              key={sequence.id}
              open={expandedSequence === sequence.id}
              onOpenChange={(open) => setExpandedSequence(open ? sequence.id : null)}
            >
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {expandedSequence === sequence.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{sequence.name}</h3>
                          <Badge 
                            variant="outline" 
                            className={`${STATUS_CONFIG[sequence.status].color} text-white border-0`}
                          >
                            {STATUS_CONFIG[sequence.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Tipo: {FOLLOWUP_TYPE_LABELS[sequence.follow_up_type]} • {' '}
                          {sequence.steps?.length || 0} etapas • {' '}
                          {sequence.active_contacts_count || 0} contatos ativos
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleStatus(sequence)}>
                          {sequence.status === 'active' ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(sequence)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteConfirm(sequence)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CollapsibleContent className="mt-4 pt-4 border-t border-border">
                    {sequence.description && (
                      <p className="text-sm text-muted-foreground mb-4">{sequence.description}</p>
                    )}
                    
                    {sequence.steps && sequence.steps.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Etapas:</p>
                        {sequence.steps.map((step, index) => (
                          <div 
                            key={step.id}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm"
                          >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <span className="text-muted-foreground">
                                Após {step.delay_value} {DELAY_UNIT_LABELS[step.delay_unit]}
                              </span>
                              {sequence.follow_up_type === 'manual' && step.manual_content && (
                                <p className="text-foreground mt-1 truncate max-w-md">
                                  {step.manual_content}
                                </p>
                              )}
                              {sequence.follow_up_type !== 'manual' && step.ai_instruction && (
                                <p className="text-foreground mt-1 truncate max-w-md italic">
                                  "{step.ai_instruction}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma etapa configurada</p>
                    )}
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Form Modal/Sheet */}
      <FollowUpSequenceForm
        open={showForm}
        onOpenChange={setShowForm}
        sequence={editingSequence}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a sequência "{deleteConfirm?.name}"? 
              Esta ação não pode ser desfeita e todos os follow-ups programados serão cancelados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
