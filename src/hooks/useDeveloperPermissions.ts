import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeveloperAuth } from '@/contexts/DeveloperAuthContext';
import { toast } from 'sonner';

type PermissionRequestType = 'edit_company' | 'edit_user' | 'access_user' | 'delete_company' | 'delete_user';

interface UsePermissionRequestResult {
  requestPermission: (
    type: PermissionRequestType,
    targetCompanyId: string | null,
    targetUserId: string | null,
    approverId: string
  ) => Promise<{ requestId: string } | null>;
  cancelRequest: (requestId: string) => Promise<void>;
  isRequesting: boolean;
}

export function useDeveloperPermissions(): UsePermissionRequestResult {
  const [isRequesting, setIsRequesting] = useState(false);
  const { isAuthenticated } = useDeveloperAuth();

  const requestPermission = async (
    type: PermissionRequestType,
    targetCompanyId: string | null,
    targetUserId: string | null,
    approverId: string
  ): Promise<{ requestId: string } | null> => {
    setIsRequesting(true);
    
    try {
      if (!isAuthenticated) {
        toast.error('Sessão expirada. Faça login novamente.');
        return null;
      }

      // Token is now in httpOnly cookie - no need to pass it manually
      // supabase.functions.invoke will send cookies automatically
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: {
          action: 'create_permission_request',
          request_type: type,
          target_company_id: targetCompanyId,
          target_user_id: targetUserId,
          approver_id: approverId
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao criar solicitação de permissão');
        return null;
      }

      return { requestId: data.request_id };
    } catch (err) {
      console.error('Error requesting permission:', err);
      toast.error('Erro ao solicitar permissão');
      return null;
    } finally {
      setIsRequesting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      // Token is now in httpOnly cookie
      await supabase.functions.invoke('developer-actions', {
        body: {
          action: 'cancel_permission_request',
          request_id: requestId
        }
      });
    } catch (err) {
      console.error('Error cancelling request:', err);
    }
  };

  return {
    requestPermission,
    cancelRequest,
    isRequesting
  };
}
