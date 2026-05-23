import { describe, it, expect } from "vitest";
import {
  ALLOWED_IMAGE_MIMES,
  MAX_ATTACHMENT_BYTES,
  attachmentDataUrl,
  isAllowedImageMime,
  validateAttachmentInput,
  type ImageAttachment,
} from "@/lib/chat-types";

describe("chat-types attachment helpers", () => {
  it("ALLOWED_IMAGE_MIMES includes png, jpeg, webp, gif", () => {
    expect(ALLOWED_IMAGE_MIMES).toContain("image/png");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/webp");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/gif");
  });

  it("MAX_ATTACHMENT_BYTES is 5MB", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(5 * 1024 * 1024);
  });

  it("isAllowedImageMime accepts allowed types", () => {
    expect(isAllowedImageMime("image/png")).toBe(true);
    expect(isAllowedImageMime("image/jpeg")).toBe(true);
  });

  it("isAllowedImageMime rejects disallowed types", () => {
    expect(isAllowedImageMime("image/bmp")).toBe(false);
    expect(isAllowedImageMime("application/pdf")).toBe(false);
    expect(isAllowedImageMime("video/mp4")).toBe(false);
    expect(isAllowedImageMime("")).toBe(false);
  });

  it("attachmentDataUrl builds a valid data URL", () => {
    const att: ImageAttachment = {
      kind: "image",
      mime: "image/png",
      name: "foo.png",
      size: 100,
      dataBase64: "AAAA",
    };
    expect(attachmentDataUrl(att)).toBe("data:image/png;base64,AAAA");
  });
});

describe("validateAttachmentInput", () => {
  function valid() {
    return {
      kind: "image",
      mime: "image/png",
      name: "screenshot.png",
      size: 1024,
      dataBase64: "A".repeat(1366), // ~1024 bytes when base64-decoded
    };
  }

  it("accepts a well-formed image attachment", () => {
    const out = validateAttachmentInput(valid());
    expect(typeof out).not.toBe("string");
    if (typeof out !== "string") {
      expect(out.kind).toBe("image");
      expect(out.mime).toBe("image/png");
      expect(out.size).toBe(1024);
    }
  });

  it("rejects non-image kind", () => {
    const v = { ...valid(), kind: "video" };
    expect(validateAttachmentInput(v)).toMatch(/unsupported attachment kind/);
  });

  it("rejects disallowed mime", () => {
    const v = { ...valid(), mime: "image/bmp" };
    expect(validateAttachmentInput(v)).toMatch(/disallowed mime/);
  });

  it("rejects negative or zero size", () => {
    expect(validateAttachmentInput({ ...valid(), size: 0 })).toMatch(/invalid attachment size/);
    expect(validateAttachmentInput({ ...valid(), size: -1 })).toMatch(/invalid attachment size/);
  });

  it("rejects size over MAX_ATTACHMENT_BYTES", () => {
    const v = { ...valid(), size: MAX_ATTACHMENT_BYTES + 1 };
    expect(validateAttachmentInput(v)).toMatch(/attachment too large/);
  });

  it("rejects empty or missing base64 data", () => {
    expect(validateAttachmentInput({ ...valid(), dataBase64: "" })).toMatch(/missing attachment data/);
    expect(validateAttachmentInput({ ...valid(), dataBase64: undefined })).toMatch(/missing attachment data/);
  });

  it("rejects spoofed size (small declared size, huge data payload)", () => {
    // Declared 1024 bytes but base64 payload corresponds to ~6MB raw → reject
    const oversized = "A".repeat(Math.ceil((MAX_ATTACHMENT_BYTES * 1.2 * 4) / 3));
    const v = { ...valid(), size: 1024, dataBase64: oversized };
    expect(validateAttachmentInput(v)).toMatch(/exceeds size limit/);
  });

  it("defaults name to 'attachment' if missing", () => {
    const v = { ...valid() };
    delete (v as { name?: string }).name;
    const out = validateAttachmentInput(v);
    if (typeof out !== "string") expect(out.name).toBe("attachment");
  });

  it("accepts all four allowed mimes", () => {
    for (const mime of ALLOWED_IMAGE_MIMES) {
      const out = validateAttachmentInput({ ...valid(), mime });
      expect(typeof out).not.toBe("string");
    }
  });
});
