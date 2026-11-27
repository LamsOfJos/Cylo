import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PiAuthProvider, usePiAuth } from "./PiAuthContext";

function Consumer() {
  const auth = usePiAuth();
  return (
    <div>
      <span data-testid="username">{auth.pioneer?.username ?? "signed out"}</span>
      {auth.error && <span role="alert">{auth.error}</span>}
      <button onClick={() => void auth.signIn()}>sign in</button>
    </div>
  );
}

function tokenWithExpiry(exp: number) {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe("PiAuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("verifies the Pi SDK token with Agrocylo before showing the Pioneer", async () => {
    const piAccessToken = "pi-secret-access-token";
    window.Pi = {
      init: vi.fn(),
      authenticate: vi.fn().mockResolvedValue({
        accessToken: piAccessToken,
        user: { uid: "client-uid", username: "TamperedName" },
      }),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        accessToken: tokenWithExpiry(Math.floor(Date.now() / 1000) + 900),
        refreshToken: "app-refresh-token",
        walletAddress: "pi:verified-uid",
        user: { uid: "verified-uid", username: "VerifiedPioneer" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PiAuthProvider>
        <Consumer />
      </PiAuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "sign in" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("username")).toHaveTextContent("VerifiedPioneer"),
    );
    expect(window.Pi.authenticate).toHaveBeenCalledWith(["username"], expect.any(Function));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/pi/verify"),
      expect.objectContaining({
        body: JSON.stringify({ accessToken: piAccessToken }),
      }),
    );
    expect(localStorage.getItem("agrocylo:pi-session")).not.toContain(piAccessToken);
  });

  it("explains that Pi Browser is required when the Pi SDK is unavailable", async () => {
    delete window.Pi;
    render(
      <PiAuthProvider>
        <Consumer />
      </PiAuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "sign in" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Open Agrocylo in Pi Browser to sign in with Pi.",
    );
  });
});
