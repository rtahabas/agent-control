import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { migrate, MIGRATIONS } from "@/lib/db";
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  saveTranscript,
  loadTranscript,
  searchMessages,
  titleFrom,
} from "@/lib/conversations";
import type { ChatMessage } from "@/lib/chat-types";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  migrate(db);
});

const msg = (over: Partial<ChatMessage>): ChatMessage =>
  ({ id: "m", role: "user", text: "", ...over }) as ChatMessage;

describe("schema step 2", () => {
  it("reaches version 2 from empty", () => {
    expect(db.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["conversations", "messages"]));
  });

  it("upgrades a populated v1 database without losing its rows", () => {
    // The database is shared by every agent and the bridge, so the only
    // acceptable failure here is none. This is the case that would catch an
    // ALTER slipping into step 2.
    const old = new Database(":memory:");
    migrate(old, [MIGRATIONS[0]]);
    old
      .prepare("INSERT INTO agents (id,name,path,status,created_at) VALUES (?,?,?,?,?)")
      .run("a", "Agent-One", "/tmp/a", "active", "2026-01-01T00:00:00Z");
    old.prepare("INSERT INTO skill_states (name,enabled) VALUES (?,?)").run("summarize", 1);

    migrate(old);

    expect(old.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
    expect(old.prepare("SELECT name FROM agents WHERE id='a'").get()).toEqual({
      name: "Agent-One",
    });
    expect(old.prepare("SELECT enabled FROM skill_states WHERE name='summarize'").get()).toEqual(
      { enabled: 1 }
    );
  });
});

describe("transcript round trip", () => {
  it("returns every role and payload shape unchanged", () => {
    createConversation("a", "c1", "sess-1", db);
    const messages: ChatMessage[] = [
      msg({ role: "user", text: "fix the retry ceiling" }),
      msg({ role: "assistant", text: "done", done: true }),
      msg({
        role: "tool",
        text: "",
        tool: { index: 0, name: "Bash", id: "t1", input: { command: "ls" }, done: true },
      }),
      msg({
        role: "permission",
        text: "",
        permission: {
          tool_use_id: "p1",
          tool_name: "Bash",
          input: { command: "rm" },
          status: "allowed",
        },
      }),
      msg({
        role: "question",
        text: "",
        question: {
          tool_use_id: "q1",
          questions: [{ question: "which?", options: [{ label: "a" }, { label: "b" }] }],
          status: "answered",
          answers: { which: "a" },
        },
      }),
      msg({
        role: "user",
        text: "see this",
        attachment: {
          kind: "image",
          mime: "image/png",
          name: "s.png",
          size: 12,
          dataBase64: "iVBORw0KGgo=",
        },
      }),
    ];

    expect(saveTranscript("c1", messages, { sessionId: "sess-1", costUsd: 0.42 }, db)).toBe(6);

    const back = loadTranscript("c1", db);
    expect(back).toHaveLength(6);
    expect(back.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "permission",
      "question",
      "user",
    ]);
    expect(back[2].tool).toEqual(messages[2].tool);
    expect(back[3].permission).toEqual(messages[3].permission);
    expect(back[4].question).toEqual(messages[4].question);
    expect(back[5].attachment).toEqual(messages[5].attachment);
    expect(back[0].text).toBe("fix the retry ceiling");
  });

  it("replaces rather than appends, so an answered card is not stored twice", () => {
    createConversation("a", "c1", null, db);
    const pending = msg({
      role: "permission",
      text: "",
      permission: { tool_use_id: "p1", tool_name: "Bash", input: {}, status: "pending" },
    });
    saveTranscript("c1", [pending], {}, db);
    saveTranscript("c1", [{ ...pending, permission: { ...pending.permission!, status: "allowed" } }], {}, db);

    const back = loadTranscript("c1", db);
    expect(back).toHaveLength(1);
    expect(back[0].permission?.status).toBe("allowed");
    expect(getConversation("c1", db)?.message_count).toBe(1);
  });

  it("keeps order by seq, not by insertion accident", () => {
    createConversation("a", "c1", null, db);
    saveTranscript("c1", [msg({ text: "one" }), msg({ text: "two" }), msg({ text: "three" })], {}, db);
    expect(loadTranscript("c1", db).map((m) => m.text)).toEqual(["one", "two", "three"]);
  });
});

describe("conversation list", () => {
  it("titles a conversation from the first thing the person said", () => {
    expect(titleFrom([msg({ role: "assistant", text: "hello" })])).toBeNull();
    expect(titleFrom([msg({ role: "user", text: "  first line\nsecond " })])).toBe("first line");
    expect(titleFrom([msg({ role: "user", text: "x".repeat(200) })])).toHaveLength(80);
  });

  it("does not overwrite a title once set", () => {
    createConversation("a", "c1", null, db);
    saveTranscript("c1", [msg({ role: "user", text: "original" })], {}, db);
    saveTranscript("c1", [msg({ role: "user", text: "renamed later" })], {}, db);
    expect(getConversation("c1", db)?.title).toBe("original");
  });

  it("lists newest first and only for the agent asked about", () => {
    createConversation("a", "c1", null, db);
    createConversation("b", "c2", null, db);
    createConversation("a", "c3", null, db);
    // updated_at is what orders the list, so touch c1 last.
    saveTranscript("c3", [msg({ text: "later" })], {}, db);
    saveTranscript("c1", [msg({ text: "latest" })], {}, db);

    const ids = listConversations("a", 50, db).map((c) => c.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c3");
    expect(ids).not.toContain("c2");
    expect(ids[0]).toBe("c1");
  });

  it("deleting a conversation takes its messages with it", () => {
    createConversation("a", "c1", null, db);
    saveTranscript("c1", [msg({ text: "gone" })], {}, db);
    expect(deleteConversation("c1", db)).toBe(true);
    expect(getConversation("c1", db)).toBeNull();
    expect(
      db.prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id='c1'").get()
    ).toEqual({ n: 0 });
  });
});

describe("search", () => {
  beforeEach(() => {
    createConversation("a", "c1", null, db);
    createConversation("b", "c2", null, db);
    saveTranscript("c1", [msg({ text: "the retry ceiling is wrong" })], {}, db);
    saveTranscript("c2", [msg({ text: "retry the deploy" })], {}, db);
  });

  it("matches on a substring", () => {
    expect(searchMessages("retry", null, 50, db)).toHaveLength(2);
    expect(searchMessages("ceiling", null, 50, db).map((h) => h.conversation_id)).toEqual(["c1"]);
  });

  it("respects the agent filter", () => {
    expect(searchMessages("retry", "a", 50, db).map((h) => h.conversation_id)).toEqual(["c1"]);
  });

  it("returns nothing for an empty query rather than the whole archive", () => {
    expect(searchMessages("", null, 50, db)).toEqual([]);
    expect(searchMessages("   ", null, 50, db)).toEqual([]);
  });

  it("treats wildcards as text, not as pattern", () => {
    // A person typing % is searching for a percent sign, not asking for everything.
    saveTranscript("c1", [msg({ text: "100% done" })], {}, db);
    expect(searchMessages("%", null, 50, db).map((h) => h.text)).toEqual(["100% done"]);
  });
});
