import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ForcePasswordChangeModal } from '@/components/auth/ForcePasswordChangeModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, needsPasswordChange, clearPasswordChangeFlag, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page, but save the attempted location
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Show forced password change modal if needed
  if (needsPasswordChange && profile) {
    return (
      <>
        {children}
        <ForcePasswordChangeModal
          open={true}
          userEmail={profile.email}
          onSuccess={clearPasswordChangeFlag}
        />
      </>
    );
  }

  return <>{children}</>;
}
