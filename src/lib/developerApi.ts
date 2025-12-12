// Helper to call developer Edge Functions with cookie auth
// Do NOT use supabase.functions.invoke - it sends Supabase Auth JWT which conflicts with developer token

const getSupabaseUrl = () => {
  return import.meta.env.VITE_SUPABASE_URL || 'https://stjtkvanmlidurmwpdpc.supabase.co';
};

export const callDeveloperFunction = async (functionName: string, body: any): Promise<{ data: any; error: string | null }> => {
  try {
    const supabaseUrl = getSupabaseUrl();
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include' // CRITICAL: Send cookies
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { data: null, error: data.error || data.detail || 'Erro na requisição' };
    }
    
    // Also check for error in response body
    if (data.error) {
      return { data: null, error: data.error };
    }
    
    return { data, error: null };
  } catch (err) {
    console.error('Error calling developer function:', functionName, err);
    return { data: null, error: 'Erro de conexão' };
  }
};

// Convenience wrappers for common functions
export const developerData = (body: any) => callDeveloperFunction('developer-data', body);
export const developerActions = (body: any) => callDeveloperFunction('developer-actions', body);
export const developerImpersonate = (body: any) => callDeveloperFunction('developer-impersonate', body);
