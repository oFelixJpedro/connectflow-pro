import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs for each credit type (same as purchase-ai-credits)
const CREDIT_PRICES: Record<string, { priceId: string; tokens: number; amountCents: number }> = {
  standard_text: { 
    priceId: 'price_1RZGEYRxOJXpNgcWpU3O6Dcu', 
    tokens: 1_000_000,
    amountCents: 1000
  },
  advanced_text: { 
    priceId: 'price_1RZGFtRxOJXpNgcWgYIR2Bmt', 
    tokens: 1_000_000,
    amountCents: 3000
  },
  standard_audio: { 
    priceId: 'price_1RZGGORxOJXpNgcWMYLdLzVf', 
    tokens: 1_000_000,
    amountCents: 6000
  },
  advanced_audio: { 
    priceId: 'price_1RZGGsRxOJXpNgcWighmyq1H', 
    tokens: 1_000_000,
    amountCents: 12000
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[AUTO-RECHARGE] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { companyId, creditType } = await req.json();
    
    if (!companyId || !creditType) {
      throw new Error("companyId and creditType are required");
    }
    
    logStep("Processing auto-recharge", { companyId, creditType });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get company's credit settings and Stripe info
    const { data: credits, error: creditsError } = await supabase
      .from('ai_credits')
      .select('auto_recharge_enabled, auto_recharge_types, stripe_payment_method_id')
      .eq('company_id', companyId)
      .single();

    if (creditsError || !credits) {
      throw new Error("Could not fetch credit settings");
    }

    // Validate auto-recharge is enabled for this credit type
    if (!credits.auto_recharge_enabled) {
      logStep("Auto-recharge not enabled for company");
      return new Response(
        JSON.stringify({ success: false, reason: 'auto_recharge_disabled' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credits.auto_recharge_types?.includes(creditType)) {
      logStep("Credit type not in auto-recharge list", { creditType, configured: credits.auto_recharge_types });
      return new Response(
        JSON.stringify({ success: false, reason: 'credit_type_not_configured' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credits.stripe_payment_method_id) {
      logStep("No payment method configured");
      return new Response(
        JSON.stringify({ success: false, reason: 'no_payment_method' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company's Stripe customer ID
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', companyId)
      .single();

    if (companyError || !company?.stripe_customer_id) {
      throw new Error("Company has no Stripe customer ID");
    }

    const priceInfo = CREDIT_PRICES[creditType];
    if (!priceInfo) {
      throw new Error(`Invalid credit type: ${creditType}`);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    logStep("Creating PaymentIntent for auto-recharge", {
      customerId: company.stripe_customer_id,
      amount: priceInfo.amountCents,
      creditType
    });

    // Create a PaymentIntent with the saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInfo.amountCents,
      currency: 'brl',
      customer: company.stripe_customer_id,
      payment_method: credits.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        purchase_type: 'ai_credits',
        credit_type: creditType,
        tokens: priceInfo.tokens.toString(),
        company_id: companyId,
        is_auto_recharge: 'true'
      }
    });

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id, 
      status: paymentIntent.status 
    });

    if (paymentIntent.status === 'succeeded') {
      // Add credits immediately
      const { error: addError } = await supabase.rpc('add_ai_credits', {
        p_company_id: companyId,
        p_credit_type: creditType,
        p_tokens: priceInfo.tokens,
        p_transaction_type: 'auto_recharge',
        p_stripe_payment_intent_id: paymentIntent.id,
        p_amount_paid_cents: priceInfo.amountCents,
        p_metadata: { auto_recharge: true }
      });

      if (addError) {
        logStep("Error adding credits after payment", { error: addError.message });
        throw new Error("Payment succeeded but failed to add credits");
      }

      logStep("Auto-recharge completed successfully", {
        creditType,
        tokens: priceInfo.tokens,
        amountCents: priceInfo.amountCents
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          tokensAdded: priceInfo.tokens,
          amountCharged: priceInfo.amountCents 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Check if it's a Stripe card error
    const stripeError = error as { type?: string; message?: string };
    if (stripeError.type === 'StripeCardError') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'payment_failed',
          error: stripeError.message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
