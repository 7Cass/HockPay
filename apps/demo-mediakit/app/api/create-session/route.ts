import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/hockpay";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      creatorName,
      bio,
      niche,
      location,
      socials,
      audience,
      rates,
    } = body;

    if (!sessionId || !creatorName) {
      return NextResponse.json(
        { error: "sessionId and creatorName are required" },
        { status: 400 },
      );
    }

    const metadata: Record<string, unknown> = {
      type: "mediakit",
      sessionId,
      creatorName,
      bio: bio || "",
      niche: niche || "",
      location: location || "",
      socials: socials || {},
      audience: audience || {},
      rates: rates || {},
    };

    const result = await createCheckoutSession({
      amount: 990,
      description: "Media Kit Generator",
      successUrl: `${APP_URL}/success?sessionId=${sessionId}`,
      cancelUrl: APP_URL,
      metadata,
    });

    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
