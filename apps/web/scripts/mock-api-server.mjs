/**
 * Local mock API server for development.
 *
 * Start with: node scripts/mock-api-server.mjs
 * Then set API_BASE_URL=http://localhost:3001 in .env.local and run pnpm dev.
 *
 * Handles the same endpoints the real API exposes, returning static fixture data.
 * Uses only Node.js built-ins — no external dependencies.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? 3001);

const MOCK_ACCOUNT = {
  id: "mock-dev-user",
  displayName: "開発ユーザー",
  handle: "dev",
};

const now = () => new Date().toISOString();
const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

const MOCK_TIMELINE = {
  items: [
    {
      post: {
        id: "mock-post-1",
        author: MOCK_ACCOUNT,
        publicText: "春の野に 霞たなびき うら悲し この夕影に 鶯鳴くも",
        createdAt: ago(10),
      },
      replies: [
        {
          id: "mock-reply-1",
          postId: "mock-post-1",
          author: { id: "mock-user-2", displayName: "花見太郎" },
          publicText: "うぐひすの 声にぞ春は 知られける",
          createdAt: ago(8),
        },
        {
          id: "mock-reply-2",
          postId: "mock-post-1",
          author: { id: "mock-user-3", displayName: "風詠み花子" },
          publicText: "霞立つ 長き春日を ひとりにて",
          createdAt: ago(5),
        },
      ],
    },
    {
      post: {
        id: "mock-post-2",
        author: { id: "mock-user-2", displayName: "花見太郎" },
        publicText: "山川に 風のかけたる しがらみは 流れもあへぬ 紅葉なりけり",
        createdAt: ago(30),
      },
      replies: [],
    },
    {
      post: {
        id: "mock-post-3",
        author: { id: "mock-user-3", displayName: "風詠み花子" },
        publicText: "奥山に 紅葉踏みわけ 鳴く鹿の 声聞くときぞ 秋はかなしき",
        createdAt: ago(60),
      },
      replies: [
        {
          id: "mock-reply-3",
          postId: "mock-post-3",
          author: MOCK_ACCOUNT,
          publicText: "秋の夜の 長さをひとり 寝てや明かさむ",
          createdAt: ago(45),
        },
      ],
    },
  ],
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

function notFound(res) {
  json(res, 404, { error: { code: "not_found", message: "Not found." } });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // GET /api/sessions/current
  if (method === "GET" && path === "/api/sessions/current") {
    return json(res, 200, { authenticated: true, account: MOCK_ACCOUNT });
  }

  // DELETE /api/sessions/current (logout — keep authenticated for simplicity)
  if (method === "DELETE" && path === "/api/sessions/current") {
    return json(res, 200, { authenticated: false });
  }

  // GET /api/timeline
  if (method === "GET" && path === "/api/timeline") {
    return json(res, 200, MOCK_TIMELINE);
  }

  // POST /api/posts
  if (method === "POST" && path === "/api/posts") {
    await readBody(req);
    const jobId = `mock-job-${Date.now()}`;
    return json(res, 201, {
      post: {
        id: `mock-post-${Date.now()}`,
        author: MOCK_ACCOUNT,
        publicText: "春の海 ひねもすのたり のたりかな",
        createdAt: now(),
      },
    });
  }

  // POST /api/posts/:postId/replies
  const repliesMatch = path.match(/^\/api\/posts\/([^/]+)\/replies$/);
  if (method === "POST" && repliesMatch) {
    await readBody(req);
    return json(res, 201, {
      reply: {
        id: `mock-reply-${Date.now()}`,
        postId: repliesMatch[1],
        author: MOCK_ACCOUNT,
        publicText: "春の夜の 夢ばかりなる 手枕に",
        createdAt: now(),
      },
    });
  }

  // DELETE /api/public-conversions/:id
  const deleteMatch = path.match(/^\/api\/public-conversions\/([^/]+)$/);
  if (method === "DELETE" && deleteMatch) {
    return noContent(res);
  }

  // GET /api/transform-jobs/:id
  const jobMatch = path.match(/^\/api\/transform-jobs\/([^/]+)$/);
  if (method === "GET" && jobMatch) {
    return json(res, 200, {
      job: {
        id: jobMatch[1],
        state: "succeeded",
        publishedPostId: `mock-post-${Date.now()}`,
      },
    });
  }

  return notFound(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
  console.log("Set API_BASE_URL=http://localhost:" + PORT + " in .env.local, then run pnpm dev");
});
