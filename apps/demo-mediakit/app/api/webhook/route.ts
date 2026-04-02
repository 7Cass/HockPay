import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/hmac";
import { saveMediaKit } from "@/store/mediakit-store";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hockpay-signature");
    const timestamp = req.headers.get("x-hockpay-timestamp");

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 400 },
      );
    }

    const secret = process.env.HOCKPAY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    const isValid = verifyWebhookSignature(
      secret,
      rawBody,
      parseInt(timestamp, 10),
      signature,
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type;
    const data = payload.data;

    if (
      eventType === "payment.confirmed" &&
      data?.metadata?.type === "mediakit"
    ) {
      const metadata = data.metadata as Record<string, unknown>;
      const sessionId = metadata.sessionId as string;

      if (sessionId) {
        saveMediaKit({
          sessionId,
          status: "ready",
          data: metadata,
          createdAt: new Date(),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
