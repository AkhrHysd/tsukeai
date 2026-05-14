import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../lib/proxy-api";

export async function POST(request: NextRequest) {
  return proxyApiRequest(request, "/api/posts");
}
