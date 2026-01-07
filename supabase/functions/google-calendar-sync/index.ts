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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let companyId: string | null = null;

    // Check if this is an authenticated request or a cron job
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader) {
      // Authenticated user request
      const token = authHeader.replace("Bearer ", "");
      const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      companyId = profile?.company_id;
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "sync") {
      if (!companyId) {
        return new Response(JSON.stringify({ error: "Company not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncCompanyCalendar(supabase, companyId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron job: sync all companies
    if (action === "sync-all") {
      const { data: tokens } = await supabase
        .from("calendar_google_tokens")
        .select("company_id");

      let totalSynced = 0;
      for (const token of tokens || []) {
        try {
          const result = await syncCompanyCalendar(supabase, token.company_id);
          totalSynced += result.synced || 0;
        } catch (err) {
          console.error(`Error syncing company ${token.company_id}:`, err);
        }
      }

      return new Response(JSON.stringify({ synced: totalSynced }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function syncCompanyCalendar(supabase: any, companyId: string) {
  // Get stored tokens
  const { data: tokenData, error: tokenError } = await supabase
    .from("calendar_google_tokens")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (tokenError || !tokenData) {
    return { synced: 0, error: "No Google Calendar connection found" };
  }

  // Check if token needs refresh
  let accessToken = tokenData.access_token;
  const expiresAt = new Date(tokenData.expires_at);
  
  if (expiresAt < new Date()) {
    // Refresh token
    const refreshed = await refreshAccessToken(tokenData.refresh_token);
    if (!refreshed) {
      return { synced: 0, error: "Failed to refresh token" };
    }

    accessToken = refreshed.access_token;
    
    // Update stored token
    await supabase
      .from("calendar_google_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("company_id", companyId);
  }

  let synced = 0;

  // 1. Push local events to Google Calendar
  const { data: localEvents } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("company_id", companyId)
    .is("google_event_id", null)
    .eq("google_calendar_synced", false);

  for (const event of localEvents || []) {
    try {
      const googleEvent = await createGoogleEvent(accessToken, event);
      if (googleEvent?.id) {
        await supabase
          .from("calendar_events")
          .update({ 
            google_event_id: googleEvent.id,
            google_calendar_synced: true,
          })
          .eq("id", event.id);
        synced++;
      }
    } catch (err) {
      console.error(`Error pushing event ${event.id}:`, err);
    }
  }

  // 2. Pull events from Google Calendar (optional - commented for now)
  // This would fetch events from Google and create local copies
  // Uncomment if bidirectional sync is needed
  /*
  const googleEvents = await fetchGoogleEvents(accessToken);
  for (const gEvent of googleEvents) {
    // Check if already exists locally
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("google_event_id", gEvent.id)
      .single();

    if (!existing) {
      // Create local event from Google event
      await supabase.from("calendar_events").insert({
        company_id: companyId,
        title: gEvent.summary || "Evento do Google",
        description: gEvent.description,
        start_date: gEvent.start.dateTime || gEvent.start.date,
        end_date: gEvent.end.dateTime || gEvent.end.date,
        all_day: !!gEvent.start.date,
        location: gEvent.location,
        google_event_id: gEvent.id,
        google_calendar_synced: true,
        created_by: tokenData.connected_by,
      });
      synced++;
    }
  }
  */

  return { synced };
}

async function refreshAccessToken(refreshToken: string) {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Token refresh failed:", await response.text());
    return null;
  }

  return response.json();
}

async function createGoogleEvent(accessToken: string, event: any) {
  const googleEvent = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: event.all_day
      ? { date: event.start_date.split("T")[0] }
      : { dateTime: event.start_date, timeZone: "America/Sao_Paulo" },
    end: event.all_day
      ? { date: event.end_date.split("T")[0] }
      : { dateTime: event.end_date, timeZone: "America/Sao_Paulo" },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEvent),
    }
  );

  if (!response.ok) {
    console.error("Failed to create Google event:", await response.text());
    return null;
  }

  return response.json();
}

async function fetchGoogleEvents(accessToken: string) {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: oneMonthAgo.toISOString(),
    timeMax: oneMonthAhead.toISOString(),
    maxResults: "100",
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch Google events:", await response.text());
    return [];
  }

  const data = await response.json();
  return data.items || [];
}
