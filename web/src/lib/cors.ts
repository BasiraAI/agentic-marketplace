import { NextResponse } from "next/server";

const PUBLIC_GET_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function publicGetHeaders(): Record<string, string> {
  return { ...PUBLIC_GET_HEADERS };
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: PUBLIC_GET_HEADERS });
}
