import { NextRequest, NextResponse } from "next/server";
import { getMediaKit } from "@/store/mediakit-store";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  const record = getMediaKit(sessionId);

  if (!record) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({
    status: record.status,
    data: record.data,
  });
}
