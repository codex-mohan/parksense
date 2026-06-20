import { NextResponse } from "next/server";

const BACKEND_URL = process.env.PARKSENSE_BACKEND_URL || "http://localhost:8002";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Backend error: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot reach ParkSense backend at ${BACKEND_URL}. Is it running?` },
      { status: 503 },
    );
  }
}
