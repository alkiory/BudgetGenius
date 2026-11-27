import { describe, expect, it } from "vitest";
import { carriesCredentials } from "../offline-queue";

/**
 * The queue persists request bodies in `localStorage`, so a credential body
 * would survive logout and be readable by any other profile on the browser.
 * Login, signup and password change all carry one.
 */
describe("carriesCredentials", () => {
  it("detects the password-change payload", () => {
    expect(
      carriesCredentials({
        currentPassword: "#Password123",
        newPassword: "#NewPass456",
      }),
    ).toBe(true);
  });

  it("detects login and signup payloads", () => {
    expect(carriesCredentials({ email: "a@b.com", password: "secret" })).toBe(
      true,
    );
  });

  it("ignores ordinary mutation bodies", () => {
    expect(carriesCredentials({ name: "Alk", surname: "Campbell" })).toBe(
      false,
    );
    expect(
      carriesCredentials({
        amount: 10,
        category: "food",
        description: "lunch",
      }),
    ).toBe(false);
  });

  it("handles bodies that are not objects", () => {
    expect(carriesCredentials(undefined)).toBe(false);
    expect(carriesCredentials(null)).toBe(false);
    expect(carriesCredentials("password")).toBe(false);
    expect(carriesCredentials(["password"])).toBe(false);
  });
});
