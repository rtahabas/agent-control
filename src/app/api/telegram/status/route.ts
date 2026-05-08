import { NextResponse } from "next/server";
import { getConfig } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getConfig());
}
