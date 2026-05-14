import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../../lib/proxy-api";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  return proxyApiRequest(request, `/api/auth/${path.join("/")}`);
}
