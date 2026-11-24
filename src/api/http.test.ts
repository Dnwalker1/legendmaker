import * as FileSystem from "expo-file-system/legacy";
import { createHttpApi, phoneSizedUrl } from "./http";
import { ApiError } from "./types";

jest.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  uploadAsync: jest.fn(),
}));

type Reply = { status?: number; body: unknown };

// A fetch stand-in that answers in order and records each request.
function fakeFetch(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error(`Unexpected request to ${url}`);
    return {
      ok: (reply.status ?? 200) < 400,
      status: reply.status ?? 200,
      json: async () => reply.body,
      blob: async () => "bytes",
    } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return calls;
}

const DEVICE = "device-1234567890abcdef";
const api = () => createHttpApi("https://www.goodwookie.com", "test-key");
const headers = (init?: RequestInit) => init?.headers as Record<string, string>;
const body = (init?: RequestInit) => JSON.parse(String(init?.body));

afterEach(() => jest.useRealTimers());

describe("http api", () => {
  it("sends the device and app key headers to /_functions", async () => {
    const calls = fakeFetch([
      {
        body: {
          ok: true,
          designs: [],
          inProgressDesignId: null,
          allowance: {
            designsLeft: 3,
            designsLimit: 50,
            triesLeft: 9,
            designUnlockAt: "2026-09-24T20:14:00Z",
          },
        },
      },
    ]);
    const limits = await api().getLimits(DEVICE);
    expect(calls[0].url).toBe("https://www.goodwookie.com/_functions/designs");
    expect(headers(calls[0].init)).toMatchObject({
      "X-Device-Id": DEVICE,
      "X-App": "legend",
      "X-App-Key": "test-key",
    });
    expect(limits).toEqual({
      available: 3,
      limit: 50,
      nextDesignAt: Date.parse("2026-09-24T20:14:00Z"),
      blockedBy: null,
      unlocksAt: null,
    });
  });

  it("turns limits and a design in progress into blocks", async () => {
    fakeFetch([
      {
        body: {
          ok: true,
          inProgressDesignId: "d1",
          allowance: { designsLeft: 2, triesLeft: 5 },
        },
      },
      {
        body: {
          ok: true,
          inProgressDesignId: null,
          allowance: {
            designsLeft: 3,
            triesLeft: 0,
            tryUnlockAt: "2026-09-25T01:00:00Z",
          },
        },
      },
    ]);
    expect((await api().getLimits(DEVICE)).blockedBy).toBe("in-progress");
    expect(await api().getLimits(DEVICE)).toMatchObject({
      blockedBy: "tries",
      unlocksAt: Date.parse("2026-09-25T01:00:00Z"),
    });
  });

  it("maps { ok: false } answers to the app error codes", async () => {
    fakeFetch([
      {
        body: {
          ok: false,
          code: "limit_designs",
          message: "x",
          unlockAt: "2026-09-24T20:14:00Z",
        },
      },
    ]);
    const err = (await api()
      .createDesign(DEVICE, { photoId: "f1", styleId: "monarch", who: "self" })
      .catch((e) => e)) as ApiError;
    expect(err.code).toBe("LIMIT_REACHED");
    expect(err.unlocksAt).toBe(Date.parse("2026-09-24T20:14:00Z"));
  });

  it("streams the photo file straight to the Wix upload address", async () => {
    const calls = fakeFetch([
      { body: { ok: true, uploadUrl: "https://upload.wix.test/abc" } },
    ]);
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ file: { id: "f_1~mv2.jpg" } }),
    });
    const res = await api().uploadPhoto(DEVICE, {
      uri: "file:///cache/pet.jpg",
      mimeType: "image/jpeg",
    });
    expect(res).toEqual({ photoId: "f_1~mv2.jpg" });
    expect(calls[0].url).toBe(
      "https://www.goodwookie.com/_functions/uploadUrl",
    );
    expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
      "https://upload.wix.test/abc?filename=photo.jpg",
      "file:///cache/pet.jpg",
      expect.objectContaining({
        httpMethod: "PUT",
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
  });

  it("reports a failed photo upload as UPLOAD_FAILED", async () => {
    fakeFetch([
      { body: { ok: true, uploadUrl: "https://upload.wix.test/abc" } },
    ]);
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
      status: 500,
      body: "nope",
    });
    await expect(
      api().uploadPhoto(DEVICE, { uri: "file:///cache/pet.jpg" }),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
  });

  it("waits and retries while the upload is not ready", async () => {
    jest.useFakeTimers();
    const calls = fakeFetch([
      { body: { ok: false, code: "upload_not_ready", retryAfterMs: 2000 } },
      { body: { ok: true, designId: "d9", style: "moviestar" } },
    ]);
    const pending = api().createDesign(DEVICE, {
      photoId: "file-1",
      styleId: "moviestar",
      text: "BISCUIT",
      who: "gift",
    });
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual({ designId: "d9" });
    expect(body(calls[1].init)).toEqual({
      fileId: "file-1",
      style: "moviestar",
      text: "BISCUIT",
      who: "gift",
      whoConsent: true,
    });
  });

  it("carries on with the design already in progress", async () => {
    fakeFetch([
      { body: { ok: false, code: "one_at_a_time", designId: "d-running" } },
    ]);
    await expect(
      api().createDesign(DEVICE, { photoId: "f", styleId: "monarch", who: "self" }),
    ).resolves.toEqual({ designId: "d-running" });
  });

  it("maps finished design statuses to problem screens", async () => {
    fakeFetch([
      { body: { ok: true, designId: "a", status: "no_person", style: "monarch" } },
      {
        body: {
          ok: true,
          designId: "b",
          status: "checker_down",
          style: "monarch",
        },
      },
      {
        body: {
          ok: true,
          designId: "c",
          status: "ready",
          style: "rockstar",
          previewUrl: "https://static.wixstatic.com/p.png",
        },
      },
    ]);
    expect(await api().getDesign(DEVICE, "a")).toMatchObject({
      status: "rejected",
      problem: "NO_PERSON",
    });
    expect(await api().getDesign(DEVICE, "b")).toMatchObject({
      status: "failed",
      problem: "CHECKER_UNAVAILABLE",
    });
    expect(await api().getDesign(DEVICE, "c")).toMatchObject({
      status: "ready",
      preview: { uri: "https://static.wixstatic.com/p.png" },
    });
  });

  it("reads the style whether the backend sends the display name, the key or the website key", async () => {
    // The live backend answers with the display name, which used to crash the result screen.
    fakeFetch([
      {
        body: {
          ok: true,
          designId: "a",
          status: "ready",
          style: "Rock Star",
          previewUrl: "https://p",
        },
      },
      {
        body: {
          ok: true,
          designId: "b",
          status: "ready",
          style: "legendMovieStar",
          previewUrl: "https://p",
        },
      },
      {
        body: {
          ok: true,
          designs: [
            {
              designId: "c",
              style: "The Champion",
              previewUrl: "https://p",
              createdAt: "2026-09-24T20:25:51Z",
            },
          ],
        },
      },
    ]);
    expect((await api().getDesign(DEVICE, "a")).styleId).toBe("rockstar");
    expect((await api().getDesign(DEVICE, "b")).styleId).toBe("moviestar");
    expect((await api().listDesigns(DEVICE))[0].styleId).toBe("champion");
  });

  it("sends whose portrait it is with the promise, and reads why a photo was refused", async () => {
    const calls = fakeFetch([
      { body: { ok: true, designId: "d1", style: "Movie Star" } },
      {
        body: {
          ok: true,
          designId: "d1",
          status: "photo_rejected",
          reason: "minor",
          style: "Movie Star",
        },
      },
      {
        body: {
          ok: false,
          code: "consent_needed",
          message: "Consent needed",
        },
      },
    ]);
    await api().createDesign(DEVICE, {
      photoId: "f",
      styleId: "moviestar",
      who: "memorial",
    });
    expect(body(calls[0].init)).toEqual({
      fileId: "f",
      style: "moviestar",
      who: "memorial",
      whoConsent: true,
    });
    expect(await api().getDesign(DEVICE, "d1")).toMatchObject({
      status: "rejected",
      problem: "PHOTO_REJECTED",
      rejectReason: "minor",
    });
    await expect(
      api().createDesign(DEVICE, { photoId: "f", styleId: "monarch", who: "self" }),
    ).rejects.toMatchObject({ code: "CONSENT_NEEDED" });
  });

  it("sends checkout items with the backend size names", async () => {
    const calls = fakeFetch([
      {
        body: {
          ok: true,
          checkoutId: "co1",
          checkoutUrl: "https://www.goodwookie.com/checkout?x",
        },
      },
    ]);
    const res = await api().createCheckout(DEVICE, [
      { kind: "single", designId: "d1", choice: { product: "tee", color: "White", size: "L" }, quantity: 1 },
      { kind: "single", designId: "d1", choice: { product: "poster", size: "18x24" }, quantity: 2 },
      { kind: "single", designId: "d1", choice: { product: "canvas", size: "12x16" }, quantity: 1 },
    ]);
    expect(res).toEqual({
      checkoutId: "co1",
      checkoutUrl: "https://www.goodwookie.com/checkout?x",
    });
    expect(body(calls[0].init).items).toEqual([
      { designId: "d1", productKey: "tee", color: "White", size: "L", quantity: 1 },
      { designId: "d1", productKey: "poster", size: "18×24", quantity: 2 },
      { designId: "d1", productKey: "canvas", size: "12×16", quantity: 1 },
    ]);
  });

  it("reads the formatted total the live backend sends", async () => {
    fakeFetch([
      {
        body: {
          ok: true,
          orders: [
            {
              orderNumber: "10043",
              placedAt: "2026-09-20T12:00:00Z",
              total: "$1,027.95",
              stage: "In review",
              items: [{ title: "Poster", quantity: 1 }],
            },
          ],
        },
      },
    ]);
    const [order] = await api().getOrders(DEVICE);
    expect(order.totalCents).toBe(102795);
  });

  it("reads orders with the real order number and total in cents", async () => {
    fakeFetch([
      {
        body: {
          ok: true,
          orders: [
            {
              orderNumber: "10042",
              placedAt: "2026-09-23T18:40:00Z",
              total: 127.95,
              stage: "shipped",
              trackingUrl: "https://track",
              items: [
                { title: "T-Shirt", quantity: 2, previewUrl: "https://p" },
              ],
            },
          ],
        },
      },
    ]);
    const [order] = await api().getOrders(DEVICE);
    expect(order).toMatchObject({
      number: "10042",
      totalCents: 12795,
      status: "shipped",
      itemCount: 2,
      title: "T-Shirt",
      trackingUrl: "https://track",
    });
    expect(order.artwork).toEqual([]);
  });

  it("offers each paid design's artwork once", async () => {
    fakeFetch([
      {
        body: {
          ok: true,
          orders: [
            {
              orderNumber: "10043",
              placedAt: "2026-11-13T18:40:00Z",
              total: 60,
              stage: "in-review",
              items: [
                {
                  title: "T-Shirt",
                  quantity: 1,
                  previewUrl: "https://p1",
                  artworkUrl: "https://static.wixstatic.com/media/a.png",
                },
                {
                  title: "Hoodie",
                  quantity: 1,
                  previewUrl: "https://p1",
                  artworkUrl: "https://static.wixstatic.com/media/a.png",
                },
                {
                  title: "Sticker",
                  quantity: 1,
                  previewUrl: "https://p2",
                  artworkUrl: "https://static.wixstatic.com/media/b.png",
                },
                {
                  title: "Poster",
                  quantity: 1,
                  previewUrl: "https://p3",
                  artworkUrl: null,
                },
              ],
            },
          ],
        },
      },
    ]);
    const [order] = await api().getOrders(DEVICE);
    expect(order.artwork).toEqual([
      {
        url: "https://static.wixstatic.com/media/a.png",
        label: "Download artwork 1",
      },
      {
        url: "https://static.wixstatic.com/media/b.png",
        label: "Download artwork 2",
      },
    ]);
  });
});

describe("phoneSizedUrl", () => {
  it("asks Wix for a phone-sized JPEG of a media picture", () => {
    expect(phoneSizedUrl("https://static.wixstatic.com/media/7924a9_abc~mv2.png")).toBe(
      "https://static.wixstatic.com/media/7924a9_abc~mv2.png/v1/fit/w_900,h_1200,q_85/preview.jpg",
    );
    expect(phoneSizedUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});
