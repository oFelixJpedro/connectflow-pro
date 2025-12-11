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
  logout: () => void;
}

const DeveloperAuthContext = createContext<DeveloperAuthContextType | undefined>(undefined);

const DEVELOPER_TOKEN_KEY = 'developer_auth_token';

export function DeveloperAuthProvider({ children }: { children: ReactNode }) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem(DEVELOPER_TOKEN_KEY);
    if (token) {
      verifyToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('developer-auth', {
        body: { action: 'verify' },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error || !data?.valid) {
        localStorage.removeItem(DEVELOPER_TOKEN_KEY);
        setDeveloper(null);
      } else {
        setDeveloper(data.developer);
      }
    } catch (err) {
      console.error('Token verification failed:', err);
      localStorage.removeItem(DEVELOPER_TOKEN_KEY);
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

      if (data.success && data.token) {
        localStorage.setItem(DEVELOPER_TOKEN_KEY, data.token);
        setDeveloper(data.developer);
        return { success: true };
      }

      return { success: false, error: 'Resposta inválida do servidor' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const logout = () => {
    localStorage.removeItem(DEVELOPER_TOKEN_KEY);
    setDeveloper(null);
  };

  return (
    <DeveloperAuthContext.Provider
      value={{
        developer,
        isLoading,
        isAuthenticated: !!developer,
        login,
        logout
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

export function getDeveloperToken(): string | null {
  return localStorage.getItem(DEVELOPER_TOKEN_KEY);
}