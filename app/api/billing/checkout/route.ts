import { NextResponse } from "next/server";

import { planForUser } from "@/lib/quota";
import { getServerSession } from "@/lib/server-auth";
import { getStripeServerClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.isDisabled) {
    return NextResponse.redirect(new URL("/login?disabled=1", request.url));
  }

  const formData = await request.formData();
  const planId = String(formData.get("planId") ?? "free");
  const plan = planForUser(planId);
  const stripe = getStripeServerClient();

  if (!stripe || !plan.stripeLookupKey) {
    return NextResponse.redirect(
      new URL(`/billing?billing=not-configured&plan=${plan.id}`, request.url)
    );
  }

  const origin = new URL(request.url).origin;
  const sessionCheckout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: await resolveStripePriceId(stripe, plan.stripeLookupKey),
        quantity: 1
      }
    ],
    success_url: `${origin}/billing?billing=success`,
    cancel_url: `${origin}/billing?billing=cancel`,
    customer_email: session.email,
    metadata: {
      planId: plan.id,
      userId: session.id ?? ""
    }
  });

  return NextResponse.redirect(sessionCheckout.url ?? `${origin}/billing`, 303);
}

async function resolveStripePriceId(
  stripe: NonNullable<ReturnType<typeof getStripeServerClient>>,
  lookupKey: string
) {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1
  });

  const price = prices.data[0];
  if (!price) {
    throw new Error(`未找到 Stripe 价格: ${lookupKey}`);
  }

  return price.id;
}
