// このテストは navigator だけを必要とし、DOM は要らない。
//
// 2026-08-07: 素の `navigator` を参照していたため、Node 21+ の手元では
// グローバルにあって通り、Node 20 の CI だけが
// "ReferenceError: navigator is not defined" で落ちた。engines は
// >=20.9.0 なので Node 20 は正当な対象で、テスト側の環境依存が原因。
//
// jsdom を宣言する手もあるが、jsdom の Blob は `.text()` を実装しておらず
// B2 が別の理由で落ちる。ここで検証したいのは「本物の Blob に何を詰めたか」
// なので、DOM ごと差し替えず navigator だけを注入して Node の Blob を使う。

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { sendScore } from "./send-score";

beforeEach(() => {
  vi.stubGlobal("navigator", { sendBeacon: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendBeacon Blob fix", () => {
  test("B1: sendBeacon uses Blob with application/json", () => {
    const mockSendBeacon = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: mockSendBeacon });

    sendScore("test-session-id");

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = mockSendBeacon.mock.calls[0];
    expect(url).toBe("/api/fortune/chat/score");
    expect(body).toBeInstanceOf(Blob);
    expect(body.type).toBe("application/json");
  });

  test("B2: Blob contains valid JSON with sessionId", async () => {
    const mockSendBeacon = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: mockSendBeacon });

    sendScore("abc123");

    const blob = mockSendBeacon.mock.calls[0][1];
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.sessionId).toBe("abc123");
  });

  test("B3: gracefully handles missing sendBeacon", () => {
    vi.stubGlobal("navigator", { sendBeacon: undefined });
    expect(() => sendScore("test")).not.toThrow();
  });
});
