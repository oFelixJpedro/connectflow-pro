import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeveloperAuth, getDeveloperToken } from '@/contexts/DeveloperAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LogOut, 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  Building2, 
  Users, 
  Plus,
  Eye,
  Trash2,
  Key,
  UserCog
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import CompanyModal from './components/CompanyModal';
import UserModal from './components/UserModal';
import CreateCompanyModal from './components/CreateCompanyModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import PermissionWaitingModal from './components/PermissionWaitingModal';
import { useDeveloperPermissions } from '@/hooks/useDeveloperPermissions';

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  created_at: string;
  trial_ends_at: string | null;
  users_count?: number;
}

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

export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const { developer, isAuthenticated, isLoading: authLoading, logout } = useDeveloperAuth();
  const { requestPermission, isRequesting } = useDeveloperPermissions();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [companyUsers, setCompanyUsers] = useState<Record<string, User[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set());
  
  // Modal states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserCompany, setSelectedUserCompany] = useState<Company | null>(null);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  
  // Action modal states
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ user: User; company: Company } | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<{
    requestId: string;
    type: 'edit_company' | 'edit_user' | 'access_user' | 'delete_company' | 'delete_user';
    targetName: string;
    onApproved: () => void;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/developer');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCompanies();
    }
  }, [isAuthenticated]);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      
      // Fetch companies with user count
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          slug,
          plan,
          active,
          created_at,
          trial_ends_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user counts for each company
      const companiesWithCounts = await Promise.all(
        (companiesData || []).map(async (company) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);
          
          return {
            ...company,
            users_count: count || 0
          };
        })
      );

      setCompanies(companiesWithCounts);
    } catch (err) {
      console.error('Error loading companies:', err);
      toast.error('Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompanyUsers = async (companyId: string) => {
    if (companyUsers[companyId]) return;

    setLoadingUsers(prev => new Set([...prev, companyId]));
    
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, active, needs_password_change, created_at, last_seen_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (users || []).map(async (user) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          return {
            ...user,
            role: roleData?.role || 'agent'
          };
        })
      );

      setCompanyUsers(prev => ({
        ...prev,
        [companyId]: usersWithRoles
      }));
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  const toggleCompanyExpand = async (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
      await loadCompanyUsers(companyId);
    }
    
    setExpandedCompanies(newExpanded);
  };

  const handleLogout = () => {
    logout();
    navigate('/developer');
  };

  // Action handlers
  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    
    setActionLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { action: 'reset_password', user_id: resetPasswordUser.id },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao resetar senha');
        return;
      }

      toast.success('Senha resetada com sucesso');
      setResetPasswordUser(null);
      
      // Refresh users
      const companyId = Object.keys(companyUsers).find(cId => 
        companyUsers[cId]?.some(u => u.id === resetPasswordUser.id)
      );
      if (companyId) {
        setCompanyUsers(prev => {
          const newState = { ...prev };
          delete newState[companyId];
          return newState;
        });
        await loadCompanyUsers(companyId);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('Erro ao resetar senha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompany) return;
    
    setActionLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { action: 'delete_company', company_id: deleteCompany.id },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao excluir empresa');
        return;
      }

      toast.success('Empresa excluída com sucesso');
      setDeleteCompany(null);
      loadCompanies();
    } catch (err) {
      console.error('Delete company error:', err);
      toast.error('Erro ao excluir empresa');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    
    setActionLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { 
          action: 'delete_user', 
          user_id: deleteUser.user.id,
          company_id: deleteUser.company.id 
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao excluir usuário');
        return;
      }

      toast.success('Usuário excluído com sucesso');
      setDeleteUser(null);
      
      // Refresh
      setCompanyUsers(prev => {
        const newState = { ...prev };
        delete newState[deleteUser.company.id];
        return newState;
      });
      loadCompanies();
    } catch (err) {
      console.error('Delete user error:', err);
      toast.error('Erro ao excluir usuário');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccessAsUser = async (user: User, company: Company) => {
    // Find company owner to request permission
    const owner = companyUsers[company.id]?.find(u => u.role === 'owner');
    if (!owner) {
      toast.error('Proprietário da empresa não encontrado');
      return;
    }

    const result = await requestPermission('access_user', company.id, user.id, user.id);
    if (!result) return;

    setPermissionRequest({
      requestId: result.requestId,
      type: 'access_user',
      targetName: user.full_name,
      onApproved: async () => {
        // After approval, get impersonation token
        const token = getDeveloperToken();
        const { data, error } = await supabase.functions.invoke('developer-impersonate', {
          body: { action: 'impersonate', target_user_id: user.id },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (error || data?.error) {
          toast.error(data?.error || 'Erro ao acessar como usuário');
          setPermissionRequest(null);
          return;
        }

        // Store impersonation token and redirect
        localStorage.setItem('impersonation_token', data.impersonation_token);
        localStorage.setItem('impersonation_user', JSON.stringify(data.user));
        toast.success(`Acessando como ${user.full_name}`);
        setPermissionRequest(null);
        window.open('/dashboard', '_blank');
      }
    });
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      free: { variant: 'outline', label: 'Gratuito' },
      starter: { variant: 'secondary', label: 'Starter' },
      professional: { variant: 'default', label: 'Professional' },
      enterprise: { variant: 'default', label: 'Enterprise' },
    };
    const config = variants[plan] || { variant: 'outline', label: plan };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (active: boolean, trialEndsAt: string | null) => {
    if (!active) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
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

  const getUserStatusBadge = (user: User) => {
    if (!user.active) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (user.needs_password_change) {
      return <Badge variant="secondary">Senha Padrão</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Developer Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{developer?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Empresas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie todas as empresas e usuários do sistema
            </p>
          </div>
          <Button onClick={() => setShowCreateCompany(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Nenhuma empresa cadastrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map(company => (
                    <React.Fragment key={company.id}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleCompanyExpand(company.id)}
                          >
                            {expandedCompanies.has(company.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <button
                            className="font-medium hover:text-primary hover:underline text-left"
                            onClick={() => setSelectedCompany(company)}
                          >
                            {company.name}
                          </button>
                          <p className="text-xs text-muted-foreground">{company.slug}</p>
                        </TableCell>
                        <TableCell>{getPlanBadge(company.plan)}</TableCell>
                        <TableCell>{getStatusBadge(company.active, company.trial_ends_at)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {company.users_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedCompany(company)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteCompany(company)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Users */}
                      {expandedCompanies.has(company.id) && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-0">
                            <div className="pl-12 pr-4 py-2">
                              {loadingUsers.has(company.id) ? (
                                <div className="py-4 space-y-2">
                                  {[1, 2].map(i => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                  ))}
                                </div>
                              ) : companyUsers[company.id]?.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4">
                                  Nenhum usuário cadastrado
                                </p>
                              ) : (
                                <Table>
                                  <TableBody>
                                    {companyUsers[company.id]?.map(user => (
                                      <TableRow key={user.id} className="border-muted">
                                        <TableCell className="w-10">
                                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                                            {user.full_name.charAt(0).toUpperCase()}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <p className="font-medium text-sm">{user.full_name}</p>
                                          <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </TableCell>
                                        <TableCell>{getRoleBadge(user.role || 'agent')}</TableCell>
                                        <TableCell>{getUserStatusBadge(user)}</TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => {
                                                setSelectedUser(user);
                                                setSelectedUserCompany(company);
                                              }}
                                            >
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              title="Acessar como usuário"
                                              onClick={() => handleAccessAsUser(user, company)}
                                            >
                                              <UserCog className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              title="Resetar senha"
                                              onClick={() => setResetPasswordUser(user)}
                                            >
                                              <Key className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                              title="Excluir usuário"
                                              onClick={() => setDeleteUser({ user, company })}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modals */}
      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onRefresh={loadCompanies}
        />
      )}

      {selectedUser && selectedUserCompany && (
        <UserModal
          user={selectedUser}
          company={selectedUserCompany}
          onClose={() => {
            setSelectedUser(null);
            setSelectedUserCompany(null);
          }}
          onRefresh={() => {
            loadCompanies();
            // Clear cached users to force reload
            setCompanyUsers(prev => {
              const newState = { ...prev };
              delete newState[selectedUserCompany.id];
              return newState;
            });
          }}
        />
      )}

      {showCreateCompany && (
        <CreateCompanyModal
          onClose={() => setShowCreateCompany(false)}
          onSuccess={() => {
            setShowCreateCompany(false);
            loadCompanies();
          }}
        />
      )}

      {/* Delete Company Modal */}
      {deleteCompany && (
        <DeleteConfirmModal
          type="company"
          name={deleteCompany.name}
          details={[
            'Todos os usuários',
            'Todas as conexões WhatsApp',
            'Todas as conversas e mensagens',
            'Todos os contatos',
            'Todas as configurações'
          ]}
          isLoading={actionLoading}
          onConfirm={handleDeleteCompany}
          onCancel={() => setDeleteCompany(null)}
        />
      )}

      {/* Delete User Modal */}
      {deleteUser && (
        <DeleteConfirmModal
          type="user"
          name={deleteUser.user.full_name}
          details={[
            'Perfil do usuário',
            'Histórico de atividades',
            'Configurações pessoais'
          ]}
          isLoading={actionLoading}
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteUser(null)}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          userName={resetPasswordUser.full_name}
          isLoading={actionLoading}
          onConfirm={handleResetPassword}
          onCancel={() => setResetPasswordUser(null)}
        />
      )}

      {/* Permission Waiting Modal */}
      {permissionRequest && (
        <PermissionWaitingModal
          requestId={permissionRequest.requestId}
          requestType={permissionRequest.type}
          targetName={permissionRequest.targetName}
          onApproved={permissionRequest.onApproved}
          onDenied={() => setPermissionRequest(null)}
          onCancelled={() => setPermissionRequest(null)}
        />
      )}
    </div>
  );
}