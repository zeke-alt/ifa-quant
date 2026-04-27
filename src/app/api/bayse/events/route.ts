import { NextResponse } from "next/server";
import { bayseRead } from "@/lib/bayse-server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const endpoint = `/v1/pm/events${queryString ? `?${queryString}` : ""}`;
    
    const data = await bayseRead(endpoint);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/events GET]", err);
    return NextResponse.json({ message: "Failed to reach Bayse API" }, { status: 502 });
  }
}