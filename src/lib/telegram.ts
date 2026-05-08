// Outbound Telegram notifications.
// Configured via env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.

export interface TelegramConfig {
  configured: boolean;
  chat_id: string | null;
  bot_token_set: boolean;
}

export function getConfig(): TelegramConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chat = process.env.TELEGRAM_CHAT_ID ?? "";
  return {
    configured: token.length > 10 && chat.length > 0,
    chat_id: chat || null,
    bot_token_set: token.length > 10,
  };
}

export interface SendResult {
  ok: boolean;
  status: number;
  description?: string;
}

export async function sendTelegram(text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    return { ok: false, status: 0, description: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chat,
    text: text.slice(0, 4000),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, status: r.status, description: data?.description ?? r.statusText };
    }
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, description: e instanceof Error ? e.message : String(e) };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface NotifyEvent {
  event: string;        // e.g. "stop", "blocker", "test"
  agent?: string;       // agent name or id
  message?: string;     // free-form body
  preview?: string;     // optional last action / context
}

export function formatNotification(e: NotifyEvent): string {
  const tag = (e.event || "event").toUpperCase();
  const head = e.agent ? `<b>[${escapeHtml(tag)}]</b> ${escapeHtml(e.agent)}` : `<b>[${escapeHtml(tag)}]</b>`;
  const lines: string[] = [head];
  if (e.message) lines.push(escapeHtml(e.message));
  if (e.preview) lines.push(`<code>${escapeHtml(e.preview.slice(0, 400))}</code>`);
  return lines.join("\n");
}
