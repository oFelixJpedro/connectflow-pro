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
  User as UserIcon, 
  Calendar, 
  Clock,
  Pencil,
  Trash2,
  Key,
  UserCog,
  Building2,
  Folder
} from 'lucide-react';
import { developerData } from '@/lib/developerApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  needs_password_change: boolean;
  created_at: string;
  last_seen_at: string | null;
  role?: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface UserDetails extends User {
  departments: string[];
}

interface UserModalProps {
  user: User;
  company: Company;
  onClose: () => void;
  onRefresh: () => void;
  onAccessAsUser?: () => void;
  onResetPassword?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function UserModal({ 
  user, 
  company, 
  onClose, 
  onRefresh,
  onAccessAsUser,
  onResetPassword,
  onEdit,
  onDelete 
}: UserModalProps) {
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserDetails();
  }, [user.id]);

  const loadUserDetails = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await developerData({ action: 'get_user_details', user_id: user.id });

      if (error) throw new Error(error);

      setDetails({
        ...user,
        departments: data?.departments || []
      });
    } catch (err) {
      console.error('Error loading user details:', err);
      // Still show user info even if departments fail
      setDetails({
        ...user,
        departments: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      owner: { variant: 'default', label: 'Proprietário' },
      admin: { variant: 'secondary', label: 'Admin' },
      supervisor: { variant: 'outline', label: 'Supervisor' },
      agent: { variant: 'outline', label: 'Atendente' },
      viewer: { variant: 'outline', label: 'Visualizador' },
    };
    const config = variants[role] || { variant: 'outline', label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = () => {
    if (!user.active) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (user.needs_password_change) {
      return <Badge variant="secondary">Senha Padrão</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {user.full_name}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : details && (
          <div className="space-y-4">
            {/* Company Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{company.name}</span>
            </div>

            {/* Status and Role */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge()}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Cargo</p>
                {getRoleBadge(details.role || 'agent')}
              </div>
            </div>

            <Separator />

            {/* Departments */}
            {details.departments.length > 0 && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <Folder className="h-3 w-3" />
                    Departamentos
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {details.departments.map((dept, i) => (
                      <Badge key={i} variant="outline">{dept}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

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
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Último acesso
                </p>
                <p className="font-medium text-sm">
                  {details.last_seen_at 
                    ? format(new Date(details.last_seen_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : 'Nunca'
                  }
                </p>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onAccessAsUser}>
                <UserCog className="h-4 w-4 mr-1" />
                Acessar
              </Button>
              <Button variant="outline" size="sm" onClick={onResetPassword}>
                <Key className="h-4 w-4 mr-1" />
                Resetar Senha
              </Button>
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
