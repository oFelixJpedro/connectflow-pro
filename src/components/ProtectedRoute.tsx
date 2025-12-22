import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ForcePasswordChangeModal } from '@/components/auth/ForcePasswordChangeModal';
import { TrialExpiredModal } from '@/components/subscription/TrialExpiredModal';
import { SubscriptionBlockedModal } from '@/components/subscription/SubscriptionBlockedModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, needsPasswordChange, clearPasswordChangeFlag, profile, company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  // Check subscription status
  const checkSubscriptionStatus = () => {
    if (!company) return { blocked: false, reason: null };

    const subscriptionStatus = (company as any).subscription_status || 'trial';
    const trialEndsAt = company.trial_ends_at;
    const plan = company.plan;

    // Lifetime plan never expires
    if (plan === 'lifetime') {
      return { blocked: false, reason: null };
    }

    // Active subscription
    if (subscriptionStatus === 'active') {
      return { blocked: false, reason: null };
    }

    // Cancelled subscription
    if (subscriptionStatus === 'cancelled') {
      return { blocked: true, reason: 'cancelled' as const };
    }

    // Expired subscription
    if (subscriptionStatus === 'expired') {
      return { blocked: true, reason: 'expired' as const };
    }

    // Trial period - check if expired
    if (subscriptionStatus === 'trial' && trialEndsAt) {
      const trialEndDate = new Date(trialEndsAt);
      const now = new Date();
      
      if (now > trialEndDate) {
        return { blocked: true, reason: 'trial_expired' as const };
      }
    }

    return { blocked: false, reason: null };
  };

  const { blocked, reason } = checkSubscriptionStatus();

  const handleSubscribe = () => {
    // TODO: Navigate to pricing page when implemented
    // For now, open WhatsApp
    window.open('https://wa.me/5500000000000?text=Olá! Gostaria de assinar o ChatGo.', '_blank');
  };

  // Show blocked modals
  if (blocked && company) {
    if (reason === 'trial_expired') {
      return (
        <>
          {children}
          <TrialExpiredModal
            open={true}
            companyName={company.name}
            onSubscribe={handleSubscribe}
          />
        </>
      );
    }

    if (reason === 'cancelled' || reason === 'expired') {
      return (
        <>
          {children}
          <SubscriptionBlockedModal
            open={true}
            companyName={company.name}
            reason={reason}
            onSubscribe={handleSubscribe}
          />
        </>
      );
    }
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
