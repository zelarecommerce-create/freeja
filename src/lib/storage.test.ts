import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn().mockResolvedValue({ error: null });
const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: "https://supabase/x.jpg" } });

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }),
    },
  }),
}));

beforeEach(() => {
  process.env.SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

describe("uploadComprovante", () => {
  it("uploads the decoded image and returns its public URL", async () => {
    const { uploadComprovante } = await import("./storage");
    const url = await uploadComprovante("route-1", "data:image/jpeg;base64,aGVsbG8=");
    expect(url).toBe("https://supabase/x.jpg");
    expect(uploadMock).toHaveBeenCalled();
  });
});
