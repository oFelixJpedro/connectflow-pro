import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Developer {
  id: string;
  email: string;
}

interface DeveloperAuthContextType {
  developer: Developer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const DeveloperAuthContext = createContext<DeveloperAuthContextType | undefined>(undefined);

export function DeveloperAuthProvider({ children }: { children: ReactNode }) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount via httpOnly cookie
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('developer-auth', {
        body: { action: 'verify' }
      });

      if (error || !data?.valid) {
        setDeveloper(null);
      } else {
        setDeveloper(data.developer);
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
      setDeveloper(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('developer-auth', {
        body: { action: 'login', email, password }
      });

      if (error) {
        return { success: false, error: 'Erro ao conectar com o servidor' };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      if (data.success) {
        // Cookie is set automatically by the server via Set-Cookie header
        // No localStorage needed!
        setDeveloper(data.developer);
        return { success: true };
      }

      return { success: false, error: 'Resposta inválida do servidor' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to delete httpOnly cookie
      await supabase.functions.invoke('developer-auth', {
        body: { action: 'logout' }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state regardless of server response
      setDeveloper(null);
    }
  };

  return (
    <DeveloperAuthContext.Provider
      value={{
        developer,
        isLoading,
        isAuthenticated: !!developer,
        login,
        logout,
        checkAuth
      }}
    >
      {children}
    </DeveloperAuthContext.Provider>
  );
}

export function useDeveloperAuth() {
  const context = useContext(DeveloperAuthContext);
  if (context === undefined) {
    throw new Error('useDeveloperAuth must be used within a DeveloperAuthProvider');
  }
  return context;
}

// Note: getDeveloperToken is no longer needed since token is in httpOnly cookie
// Keeping for backwards compatibility but it always returns null now
export function getDeveloperToken(): string | null {
  // Token is now stored in httpOnly cookie - JavaScript cannot access it
  // This function is deprecated and will return null
  console.warn('getDeveloperToken is deprecated. Token is now stored in httpOnly cookie.');
  return null;
}
