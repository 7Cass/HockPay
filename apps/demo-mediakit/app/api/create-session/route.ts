import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/hockpay";
import { studyCaseConfig } from "@/study-case.config";
import { upsertPendingMediaKit } from "@/store/mediakit-store";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, creatorName } = body;

    if (!sessionId || !creatorName) {
      return NextResponse.json(
        { error: "sessionId and creatorName are required" },
        { status: 400 },
      );
    }

    const metadata = studyCaseConfig.buildMetadata(body);
    upsertPendingMediaKit(sessionId, metadata);

    const result = await createCheckoutSession({
      // O sessionId ja e unico por tentativa de compra; reaproveita-lo evita
      // duas sessoes quando o navegador reenvia o POST.
      idempotencyKey: `mediakit-${sessionId}`,
      amount: studyCaseConfig.amountInCents,
      description: studyCaseConfig.productName,
      successUrl: `${APP_URL}${studyCaseConfig.successPath}?sessionId=${sessionId}`,
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
