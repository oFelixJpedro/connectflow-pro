import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Calendar, 
  Users, 
  MessageSquare, 
  Folder,
  Pencil,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  created_at: string;
  trial_ends_at: string | null;
}

interface CompanyDetails extends Company {
  connections_count: number;
  departments_count: number;
  users_count: number;
  conversations_count: number;
}

interface CompanyModalProps {
  company: Company;
  onClose: () => void;
  onRefresh: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CompanyModal({ company, onClose, onRefresh, onEdit, onDelete }: CompanyModalProps) {
  const [details, setDetails] = useState<CompanyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCompanyDetails();
  }, [company.id]);

  const loadCompanyDetails = async () => {
    try {
      setIsLoading(true);

      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-data', {
        body: { action: 'get_company_details', company_id: company.id },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) throw error;

      setDetails({
        ...company,
        users_count: data.users_count || 0,
        connections_count: data.connections_count || 0,
        departments_count: data.departments_count || 0,
        conversations_count: data.conversations_count || 0
      });
    } catch (err) {
      console.error('Error loading company details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      free: 'Gratuito',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return labels[plan] || plan;
  };

  const getStatusBadge = () => {
    if (!company.active) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (company.trial_ends_at && new Date(company.trial_ends_at) < new Date()) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {company.name}
          </DialogTitle>
          <DialogDescription>{company.slug}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : details && (
          <div className="space-y-4">
            {/* Status and Plan */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge()}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Plano</p>
                <p className="font-medium">{getPlanLabel(details.plan)}</p>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Criado em
                </p>
                <p className="font-medium text-sm">
                  {format(new Date(details.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              {details.trial_ends_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Expira em</p>
                  <p className="font-medium text-sm">
                    {format(new Date(details.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Usuários</p>
                  <p className="font-medium">{details.users_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Conexões</p>
                  <p className="font-medium">{details.connections_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Departamentos</p>
                  <p className="font-medium">{details.departments_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Conversas</p>
                  <p className="font-medium">{details.conversations_count}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}