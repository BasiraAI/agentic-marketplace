import { describe, it, expect } from "vitest";
import { getPresignedUploadUrl } from "../src/storage/presigned.js";

// All tests run in mock mode (no R2_ENDPOINT set).

describe("storage: mock provider", () => {
  it("returns a URL containing the taskId", async () => {
    const result = await getPresignedUploadUrl({
      taskId: "task-abc-123",
      filename: "output.txt",
      contentType: "text/plain",
      sizeBytes: 1024,
    });
    expect(result.url).toContain("tasks/task-abc-123/");
    expect(result.finalUrl).toContain("tasks/task-abc-123/");
    expect(result.key).toContain("tasks/task-abc-123/");
  });

  it("two calls with the same filename produce different keys", async () => {
    const a = await getPresignedUploadUrl({
      taskId: "task-xyz",
      filename: "report.pdf",
      contentType: "application/pdf",
      sizeBytes: 512,
    });
    const b = await getPresignedUploadUrl({
      taskId: "task-xyz",
      filename: "report.pdf",
      contentType: "application/pdf",
      sizeBytes: 512,
    });
    expect(a.key).not.toBe(b.key);
  });

  it("sanitizes path-traversal filenames", async () => {
    const result = await getPresignedUploadUrl({
      taskId: "task-1",
      filename: "../../../etc/passwd",
      contentType: "text/plain",
      sizeBytes: 100,
    });
    expect(result.key).not.toContain("..");
    expect(result.key).not.toContain("etc/passwd");
  });

  it("sanitizes leading slash in filename", async () => {
    const result = await getPresignedUploadUrl({
      taskId: "task-2",
      filename: "/absolute/path.txt",
      contentType: "text/plain",
      sizeBytes: 100,
    });
    expect(result.key).not.toMatch(/\/absolute/);
  });

  it("rejects files exceeding 50 MB", async () => {
    await expect(
      getPresignedUploadUrl({
        taskId: "task-3",
        filename: "huge.bin",
        contentType: "application/octet-stream",
        sizeBytes: 51 * 1024 * 1024,
      }),
    ).rejects.toThrow();
  });

  it("expiresAt is roughly 15 minutes in the future", async () => {
    const before = Date.now();
    const result = await getPresignedUploadUrl({
      taskId: "task-4",
      filename: "data.json",
      contentType: "application/json",
      sizeBytes: 256,
    });
    const delta = result.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(14 * 60 * 1000);
    expect(delta).toBeLessThan(16 * 60 * 1000);
  });
});
