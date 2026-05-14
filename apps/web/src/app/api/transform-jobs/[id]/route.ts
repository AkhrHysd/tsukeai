import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../../lib/proxy-api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  return proxyApiRequest(request, `/api/transform-jobs/${id}`);
}
