import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../../../lib/proxy-api";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;

  return proxyApiRequest(request, `/api/posts/${postId}/replies`);
}
