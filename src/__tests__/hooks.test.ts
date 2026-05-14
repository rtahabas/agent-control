import { describe, it, expect, vi } from "vitest";
import { createHookBus, type AgentHookMap } from "@/lib/hooks";

describe("createHookBus", () => {
  describe("emit with no subscribers", () => {
    it("returns context unchanged", async () => {
      const bus = createHookBus<AgentHookMap>();
      const ctx: AgentHookMap["agent_end"] = {
        agentId: "a",
        sessionId: null,
        status: "ok",
      };
      const result = await bus.emit("agent_end", ctx);
      expect(result).toEqual(ctx);
    });
  });

  describe("single handler", () => {
    it("mutates context when handler returns a new value", async () => {
      const bus = createHookBus<AgentHookMap>();
      bus.on("before_prompt_build", (ctx) => ({
        ...ctx,
        systemPrompt: ctx.systemPrompt + " (with hook)",
      }));
      const result = await bus.emit("before_prompt_build", {
        systemPrompt: "base",
        userMessage: "u",
      });
      expect(result.systemPrompt).toBe("base (with hook)");
    });

    it("leaves context unchanged when handler returns void", async () => {
      const bus = createHookBus<AgentHookMap>();
      const seen: string[] = [];
      bus.on("before_prompt_build", (ctx) => {
        seen.push(ctx.systemPrompt);
      });
      const result = await bus.emit("before_prompt_build", {
        systemPrompt: "base",
        userMessage: "u",
      });
      expect(result.systemPrompt).toBe("base");
      expect(seen).toEqual(["base"]);
    });
  });

  describe("multiple handlers", () => {
    it("invokes in registration order, chaining the returned context", async () => {
      const bus = createHookBus<AgentHookMap>();
      bus.on("before_prompt_build", (ctx) => ({
        ...ctx,
        systemPrompt: ctx.systemPrompt + " A",
      }));
      bus.on("before_prompt_build", (ctx) => ({
        ...ctx,
        systemPrompt: ctx.systemPrompt + " B",
      }));
      bus.on("before_prompt_build", (ctx) => ({
        ...ctx,
        systemPrompt: ctx.systemPrompt + " C",
      }));
      const result = await bus.emit("before_prompt_build", {
        systemPrompt: "x",
        userMessage: "u",
      });
      expect(result.systemPrompt).toBe("x A B C");
    });
  });

  describe("async handlers", () => {
    it("awaits async handler before invoking the next one", async () => {
      const bus = createHookBus<AgentHookMap>();
      const order: string[] = [];
      bus.on("before_prompt_build", async (ctx) => {
        await new Promise((r) => setTimeout(r, 10));
        order.push("first");
        return ctx;
      });
      bus.on("before_prompt_build", (ctx) => {
        order.push("second");
        return ctx;
      });
      await bus.emit("before_prompt_build", {
        systemPrompt: "x",
        userMessage: "u",
      });
      expect(order).toEqual(["first", "second"]);
    });
  });

  describe("unsubscribe", () => {
    it("returned dispose function removes the handler", async () => {
      const bus = createHookBus<AgentHookMap>();
      const handler = vi.fn((ctx: AgentHookMap["agent_end"]) => ctx);
      const off = bus.on("agent_end", handler);
      await bus.emit("agent_end", {
        agentId: "a",
        sessionId: null,
        status: "ok",
      });
      expect(handler).toHaveBeenCalledTimes(1);
      off();
      await bus.emit("agent_end", {
        agentId: "a",
        sessionId: null,
        status: "ok",
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear", () => {
    it("clears handlers for a specific hook only", async () => {
      const bus = createHookBus<AgentHookMap>();
      const onEnd = vi.fn();
      const onPrompt = vi.fn();
      bus.on("agent_end", onEnd);
      bus.on("before_prompt_build", onPrompt);
      bus.clear("agent_end");
      await bus.emit("agent_end", {
        agentId: "a",
        sessionId: null,
        status: "ok",
      });
      await bus.emit("before_prompt_build", {
        systemPrompt: "x",
        userMessage: "u",
      });
      expect(onEnd).not.toHaveBeenCalled();
      expect(onPrompt).toHaveBeenCalledTimes(1);
    });

    it("clears all hooks when called without an argument", async () => {
      const bus = createHookBus<AgentHookMap>();
      const onEnd = vi.fn();
      const onPrompt = vi.fn();
      bus.on("agent_end", onEnd);
      bus.on("before_prompt_build", onPrompt);
      bus.clear();
      await bus.emit("agent_end", {
        agentId: "a",
        sessionId: null,
        status: "ok",
      });
      await bus.emit("before_prompt_build", {
        systemPrompt: "x",
        userMessage: "u",
      });
      expect(onEnd).not.toHaveBeenCalled();
      expect(onPrompt).not.toHaveBeenCalled();
    });
  });
});
