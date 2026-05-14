import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../../lib/proxy-api";

export async function GET(request: NextRequest) {
  return proxyApiRequest(request, "/api/sessions/current");
}

export async function DELETE(request: NextRequest) {
  return proxyApiRequest(request, "/api/sessions/current");
}
