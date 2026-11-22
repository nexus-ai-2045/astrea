import { NextRequest } from "next/server";
import { scoreSession, type SessionMessage } from "@/lib/session-scorer";
import { saveScore, getSession } from "@/lib/db";
import {
  SCORE_RATE_LIMIT,
  clientFingerprint,
  consumeRateLimit,
  tooManyRequests,
} from "@/lib/rate-limit";
import { MAX_MESSAGE_CHARS, parseSessionId } from "@/lib/validation";

export const runtime = "nodejs";

/** クライアント直渡し messages の上限 (LLM は呼ばないが DB と CPU を守る)。 */
const MAX_INLINE_MESSAGES = 100;

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

function parseInlineMessages(value: unknown): SessionMessage[] | null {
  if (!Array.isArray(value) || value.length > MAX_INLINE_MESSAGES) return null;
  const messages: SessionMessage[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const candidate = entry as Record<string, unknown>;
    if (candidate.role !== "user" && candidate.role !== "assistant") return null;
    if (
      typeof candidate.content !== "string" ||
      candidate.content.length > MAX_MESSAGE_CHARS
    ) {
      return null;
    }
    messages.push({
      role: candidate.role,
      content: candidate.content,
    } as SessionMessage);
  }
  return messages;
}

/**
 * セッション採点API — PDCA Phase 1
 * POST /api/fortune/chat/score
 * Body: { sessionId: string } or { messages: SessionMessage[] }
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("invalid JSON body");
    }
    const payload = (body ?? {}) as Record<string, unknown>;

    const perClient = await consumeRateLimit({
      bucket: `score:${clientFingerprint(request.headers)}`,
      ...SCORE_RATE_LIMIT,
    });
    if (!perClient.allowed) return tooManyRequests(perClient);

    let messages: SessionMessage[];
    let sessionId: string | null = null;

    if (payload.sessionId !== undefined) {
      const parsed = parseSessionId(payload.sessionId);
      if (!parsed.ok) return badRequest(parsed.error);
      sessionId = parsed.value;
      const session = await getSession(sessionId);
      if (!session) {
        return Response.json({ error: "Session not found" }, { status: 404 });
      }
      messages = session.messages;
    } else {
      const inline = parseInlineMessages(payload.messages);
      if (!inline) return badRequest("sessionId or messages required");
      messages = inline;
    }

    const result = scoreSession(messages);

    // sessionIdがあればスコアをDBに保存
    if (sessionId) {
      await saveScore(
        sessionId,
        result.score,
        [`positiveCount: ${result.signals.positiveCount}`],
        [`negativeCount: ${result.signals.negativeCount}`],
        result.messageCount,
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error("[score] request failed:", error);
    return Response.json({ error: "scoring failed" }, { status: 500 });
  }
}
