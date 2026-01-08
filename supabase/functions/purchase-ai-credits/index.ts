import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-AI-CREDITS] ${step}${detailsStr}`);
};

// Credit type to Stripe price ID mapping
const CREDIT_PRICES: Record<string, { priceId: string; tokens: number; label: string }> = {
  standard_text: { 
    priceId: 'price_1SmwnLHOTrHw8gZfdOT522AO', 
    tokens: 1_000_000, 
    label: 'IA Padrão (1M tokens)' 
  },
  advanced_text: { 
    priceId: 'price_1SmwnuHOTrHw8gZfq0UOFw5i', 
    tokens: 1_000_000, 
    label: 'IA Avançada (1M tokens)' 
  },
  standard_audio: { 
    priceId: 'price_1SmwofHOTrHw8gZfFYwctv9f', 
    tokens: 1_000_000, 
    label: 'IA Áudio Padrão (1M tokens)' 
  },
  advanced_audio: { 
    priceId: 'price_1Smwp8HOTrHw8gZfewtYZfZv', 
    tokens: 1_000_000, 
    label: 'IA Áudio Avançado (1M tokens)' 
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get request body
    const { creditType, quantity = 1 } = await req.json();
    
    if (!creditType || !CREDIT_PRICES[creditType]) {
      throw new Error(`Invalid credit type: ${creditType}`);
    }
    
    logStep("Credit type requested", { creditType, quantity });

    // Get user's company
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error("Company not found for user");
    }

    logStep("Company found", { companyId: profile.company_id });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    }

    const creditConfig = CREDIT_PRICES[creditType];
    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: creditConfig.priceId,
          quantity: quantity,
        },
      ],
      mode: "payment",
      success_url: `${origin}/ai-agents?credits=success&type=${creditType}`,
      cancel_url: `${origin}/ai-agents?credits=cancelled`,
      metadata: {
        credit_type: creditType,
        tokens: String(creditConfig.tokens * quantity),
        company_id: profile.company_id,
        user_id: user.id,
        purchase_type: 'ai_credits',
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
