import { describe, it, expect, vi } from "vitest";
import { streamSse } from "@/lib/chat-stream-reader";

/** A Response whose body yields exactly the chunks given, as the network would. */
function response(chunks: string[], init?: { ok?: boolean; status?: number }): Response {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { value: enc.encode(chunks[i++]), done: false }
            : { value: undefined, done: true },
      }),
    },
  } as unknown as Response;
}

const collect = async (chunks: string[]) => {
  const seen: string[] = [];
  await streamSse(response(chunks), (b) => seen.push(b));
  return seen;
};

describe("streamSse", () => {
  it("hands over each complete block", async () => {
    expect(await collect(["a\n\nb\n\n"])).toEqual(["a", "b"]);
  });

  it("reassembles a block split across network chunks", async () => {
    // The case that matters: TCP decides where chunks end, not the sender, so a
    // block routinely arrives in pieces. Dropping the tail would lose events.
    expect(await collect(["event: del", "ta\ndata: {\"x\":1}", "\n\nrest\n\n"])).toEqual([
      'event: delta\ndata: {"x":1}',
      "rest",
    ]);
  });

  it("handles several blocks arriving in one chunk", async () => {
    expect(await collect(["one\n\ntwo\n\nthree\n\n"])).toEqual(["one", "two", "three"]);
  });

  it("holds back a block that never terminates", async () => {
    // No trailing blank line means the block is still being written; emitting it
    // early would hand half an event to the parser.
    expect(await collect(["complete\n\nhalf written"])).toEqual(["complete"]);
  });

  it("survives a multi-byte character split down the middle", async () => {
    // decode({stream:true}) exists for this: the two halves of a UTF-8 sequence
    // can land in different chunks.
    const enc = new TextEncoder();
    const bytes = enc.encode("héllo\n\n");
    const res = {
      ok: true,
      body: {
        getReader: () => {
          const parts = [bytes.slice(0, 2), bytes.slice(2)];
          let i = 0;
          return {
            read: async () =>
              i < parts.length ? { value: parts[i++], done: false } : { done: true },
          };
        },
      },
    } as unknown as Response;
    const seen: string[] = [];
    await streamSse(res, (b) => seen.push(b));
    expect(seen).toEqual(["héllo"]);
  });

  it("refuses a failed response instead of reading it", async () => {
    const onBlock = vi.fn();
    await expect(
      streamSse(response([], { ok: false, status: 500 }), onBlock)
    ).rejects.toThrow("HTTP 500");
    expect(onBlock).not.toHaveBeenCalled();
  });
});
