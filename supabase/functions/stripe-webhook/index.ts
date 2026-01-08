import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Plan mapping based on Stripe price IDs
const PLAN_MAPPING: Record<string, { plan: string; maxConnections: number; maxUsers: number; maxAgents: number }> = {
  'price_1Sh1ldHOTrHw8gZfWCxrSpBo': { plan: 'monthly', maxConnections: 1, maxUsers: 3, maxAgents: 1 },
  'price_1Sh1srHOTrHw8gZfAF7nujIj': { plan: 'semiannual', maxConnections: 1, maxUsers: 3, maxAgents: 1 },
  'price_1Sh1uIHOTrHw8gZfCY7VVZEy': { plan: 'annual', maxConnections: 1, maxUsers: 3, maxAgents: 1 },
};

const EXTRA_CONNECTION_PRICE = 'price_1Sh23yHOTrHw8gZfN1V0ZBMP';
const COMMERCIAL_MANAGER_PRICE = 'price_1Sh24PHOTrHw8gZfVI7mSliT';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

Deno.serve(async (req: Request) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { error: errorMessage });
      return new Response(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is an AI credits purchase
        if (session.metadata?.purchase_type === 'ai_credits') {
          await handleAICreditsPurchase(supabaseAdmin, session);
        } else {
          await handleCheckoutCompleted(stripe, supabaseAdmin, session);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(stripe, supabaseAdmin, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabaseAdmin, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabaseAdmin, invoice);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook handler", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Handle AI credits purchase
async function handleAICreditsPurchase(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  logStep("Processing AI credits purchase", { sessionId: session.id });

  const creditType = session.metadata?.credit_type;
  const tokensStr = session.metadata?.tokens;
  const companyId = session.metadata?.company_id;

  if (!creditType || !tokensStr || !companyId) {
    logStep("Missing metadata for AI credits purchase", { 
      creditType, 
      tokens: tokensStr, 
      companyId 
    });
    return;
  }

  const tokens = parseInt(tokensStr, 10);
  const amountPaidCents = session.amount_total || 0;

  // Add credits using the database function
  const { data: result, error } = await supabase.rpc('add_ai_credits', {
    p_company_id: companyId,
    p_credit_type: creditType,
    p_tokens: tokens,
    p_transaction_type: 'purchase',
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: session.payment_intent as string,
    p_amount_paid_cents: amountPaidCents,
    p_metadata: { customer_email: session.customer_email }
  });

  if (error) {
    logStep("Error adding AI credits", { error: error.message });
    return;
  }

  logStep("AI credits added successfully", { 
    companyId, 
    creditType, 
    tokens, 
    result 
  });
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  logStep("Processing checkout.session.completed", { sessionId: session.id });

  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!customerEmail) {
    logStep("No customer email found in session");
    return;
  }

  // Find company by owner email
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("email", customerEmail)
    .single();

  if (profileError || !profile?.company_id) {
    logStep("Could not find company for email", { email: customerEmail, error: profileError?.message });
    return;
  }

  const companyId = profile.company_id;
  logStep("Found company", { companyId, email: customerEmail });

  // Get subscription details
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logStep("No subscription ID in session");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  const updateData = buildCompanyUpdateData(subscription);
  updateData.stripe_customer_id = session.customer as string;
  updateData.stripe_subscription_id = subscriptionId;
  
  // Invalidate subscription cache so next check gets fresh data
  updateData.subscription_cache = null;
  updateData.subscription_cache_updated_at = null;

  const { error: updateError } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", companyId);

  if (updateError) {
    logStep("Error updating company", { error: updateError.message });
  } else {
    logStep("Company updated successfully (cache invalidated)", { companyId, updateData });
  }
}

async function handleSubscriptionUpdated(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  logStep("Processing customer.subscription.updated", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  
  if (customer.deleted) {
    logStep("Customer was deleted");
    return;
  }

  const customerEmail = (customer as Stripe.Customer).email;
  if (!customerEmail) {
    logStep("No email found for customer");
    return;
  }

  // Find company by Stripe customer ID or owner email
  let companyId: string | null = null;

  // First try by stripe_customer_id
  const { data: companyByStripe } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (companyByStripe) {
    companyId = companyByStripe.id;
  } else {
    // Fallback to email lookup
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("email", customerEmail)
      .single();

    if (profile?.company_id) {
      companyId = profile.company_id;
    }
  }

  if (!companyId) {
    logStep("Could not find company", { customerId, email: customerEmail });
    return;
  }

  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['items.data.price'],
  });

  const updateData = buildCompanyUpdateData(fullSubscription);
  
  // Invalidate subscription cache
  updateData.subscription_cache = null;
  updateData.subscription_cache_updated_at = null;

  const { error: updateError } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", companyId);

  if (updateError) {
    logStep("Error updating company", { error: updateError.message });
  } else {
    logStep("Subscription updated for company (cache invalidated)", { companyId, status: updateData.subscription_status });
  }
}

async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

  const { data: company, error: findError } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (findError || !company) {
    logStep("Company not found for subscription", { subscriptionId: subscription.id });
    return;
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      subscription_status: "cancelled",
      plan: "free",
      max_connections: 1,
      max_users: 1,
      max_ai_agents: 0,
      commercial_manager_enabled: false,
      // Sync AI settings to disable pixel when subscription is cancelled
      ai_optimization_settings: {
        commercial_pixel_enabled: false,
        behavior_analysis_enabled: false,
        evaluation_frequency: 'disabled'
      },
      // Invalidate cache
      subscription_cache: null,
      subscription_cache_updated_at: null,
    })
    .eq("id", company.id);

  if (updateError) {
    logStep("Error updating company on cancellation", { error: updateError.message });
  } else {
    logStep("Subscription cancelled for company (cache invalidated)", { companyId: company.id });
  }
}

async function handlePaymentSucceeded(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
) {
  logStep("Processing invoice.payment_succeeded", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const { data: company, error: findError } = await supabase
    .from("companies")
    .select("id, subscription_status")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (findError || !company) {
    logStep("Company not found for invoice", { subscriptionId });
    return;
  }

  // If was past_due, restore to active
  if (company.subscription_status === "past_due") {
    const { error: updateError } = await supabase
      .from("companies")
      .update({ subscription_status: "active" })
      .eq("id", company.id);

    if (!updateError) {
      logStep("Payment recovered, status restored to active", { companyId: company.id });
    }
  }
}

async function handlePaymentFailed(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
) {
  logStep("Processing invoice.payment_failed", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const { data: company, error: findError } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (findError || !company) {
    logStep("Company not found for failed invoice", { subscriptionId });
    return;
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ subscription_status: "past_due" })
    .eq("id", company.id);

  if (!updateError) {
    logStep("Payment failed, status set to past_due", { companyId: company.id });
  }
}

// deno-lint-ignore no-explicit-any
function buildCompanyUpdateData(subscription: Stripe.Subscription): Record<string, any> {
  let basePlan = "free";
  let maxConnections = 1;
  let maxUsers = 3;
  let maxAgents = 1;
  let extraConnections = 0;
  let commercialManagerEnabled = false;

  // Process subscription items
  for (const item of subscription.items.data) {
    const priceId = typeof item.price === 'string' ? item.price : item.price.id;
    const quantity = item.quantity || 1;

    // Check if it's a base plan
    if (PLAN_MAPPING[priceId]) {
      const planConfig = PLAN_MAPPING[priceId];
      basePlan = planConfig.plan;
      maxConnections = planConfig.maxConnections;
      maxUsers = planConfig.maxUsers;
      maxAgents = planConfig.maxAgents;
    }

    // Check for extra connections
    if (priceId === EXTRA_CONNECTION_PRICE) {
      extraConnections = quantity;
    }

    // Check for commercial manager
    if (priceId === COMMERCIAL_MANAGER_PRICE) {
      commercialManagerEnabled = true;
    }
  }

  // Calculate total connections (base + extras)
  const totalConnections = maxConnections + extraConnections;

  // Map subscription status
  let subscriptionStatus = "active";
  switch (subscription.status) {
    case "active":
      subscriptionStatus = "active";
      break;
    case "past_due":
      subscriptionStatus = "past_due";
      break;
    case "canceled":
    case "unpaid":
      subscriptionStatus = "cancelled";
      break;
    case "trialing":
      subscriptionStatus = "trial";
      break;
    case "incomplete":
    case "incomplete_expired":
      subscriptionStatus = "incomplete";
      break;
    default:
      subscriptionStatus = subscription.status;
  }

  // Sync AI optimization settings based on commercial manager status
  const aiOptimizationSettings = commercialManagerEnabled 
    ? {
        commercial_pixel_enabled: true,
        behavior_analysis_enabled: true,
        evaluation_frequency: 'on_close'
      }
    : {
        commercial_pixel_enabled: false,
        behavior_analysis_enabled: false,
        evaluation_frequency: 'disabled'
      };

  return {
    plan: basePlan,
    subscription_status: subscriptionStatus,
    max_connections: totalConnections,
    max_users: maxUsers,
    max_ai_agents: maxAgents,
    commercial_manager_enabled: commercialManagerEnabled,
    ai_optimization_settings: aiOptimizationSettings,
    trial_ends_at: subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString() 
      : null,
  };
}
