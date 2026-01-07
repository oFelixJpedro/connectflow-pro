import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization");

    // Handle OAuth callback (no auth required)
    if (url.searchParams.has("code")) {
      return handleOAuthCallback(req, url);
    }

    // For other actions, require auth
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "authorize") {
      return handleAuthorize(req);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleAuthorize(req: Request) {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

  if (!GOOGLE_CLIENT_ID) {
    return new Response(
      JSON.stringify({ 
        error: "Google Calendar integration not configured",
        message: "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets" 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Build OAuth URL
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;
  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  // Get user info for state
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid user" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // State contains user_id for callback
  const state = btoa(JSON.stringify({ user_id: user.id }));

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleOAuthCallback(req: Request, url: URL) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(generateCallbackHtml(false, error), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !state) {
    return new Response(generateCallbackHtml(false, "Missing parameters"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const stateData = JSON.parse(atob(state));
    const userId = stateData.user_id;

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(generateCallbackHtml(false, "Google credentials not configured"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return new Response(generateCallbackHtml(false, "Failed to exchange token"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokens = await tokenResponse.json();

    // Get user email from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Get user's company_id
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return new Response(generateCallbackHtml(false, "User profile not found"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Store tokens (upsert)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    const { error: upsertError } = await supabase
      .from("calendar_google_tokens")
      .upsert({
        company_id: profile.company_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        google_email: userInfo.email,
        connected_by: userId,
      }, {
        onConflict: "company_id",
      });

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return new Response(generateCallbackHtml(false, "Failed to save connection"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(generateCallbackHtml(true), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(generateCallbackHtml(false, "An error occurred"), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function generateCallbackHtml(success: boolean, error?: string) {
  const message = success 
    ? "Google Calendar conectado com sucesso!" 
    : `Erro: ${error || "Falha na conexão"}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? "Sucesso" : "Erro"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${success ? "Conectado!" : "Erro"}</h1>
    <p>${message}</p>
    <p style="margin-top: 16px; font-size: 14px;">Esta janela será fechada automaticamente...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'google-calendar-connected', success: ${success} }, '*');
    }
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>
  `;
}
