import { ref, readonly } from "vue";

type OAuthState =
  | { status: "idle" }
  | { status: "redirecting" }
  | { status: "exchanging" }
  | { status: "success"; token: string }
  | { status: "error"; message: string };

const STATE_KEY = "oauth_state";
export const TOKEN_SOURCE_KEY = "pulldog-token-source";

export function useGithubOAuth() {
  const state = ref<OAuthState>({ status: "idle" });

  function startRedirect(clientId: string): void {
    const oauthState = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    sessionStorage.setItem(STATE_KEY, oauthState);
    state.value = { status: "redirecting" };

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri:
        import.meta.env.VITE_GITHUB_REDIRECT_URI || window.location.origin,
      scope: "repo read:org",
      state: oauthState,
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }

  async function handleCallback(): Promise<string | null> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");

    if (!code) {
      return null;
    }

    const savedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    history.replaceState({}, "", window.location.pathname);

    if (!savedState || returnedState !== savedState) {
      state.value = {
        status: "error",
        message: "Authorization state mismatch — please try again",
      };
      return null;
    }

    state.value = { status: "exchanging" };

    const workerUrl = import.meta.env.VITE_GITHUB_WORKER_URL;

    if (!workerUrl) {
      state.value = {
        status: "error",
        message: "VITE_GITHUB_WORKER_URL is not configured",
      };
      return null;
    }

    try {
      const res = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = (await res.json()) as Record<string, string>;

      if (data.access_token) {
        localStorage.setItem(TOKEN_SOURCE_KEY, "oauth");
        state.value = { status: "success", token: data.access_token };
        return data.access_token;
      }

      state.value = {
        status: "error",
        message:
          data.error_description ?? data.error ?? "GitHub authorization failed",
      };
      return null;
    } catch {
      state.value = {
        status: "error",
        message:
          "Could not reach auth worker — try connecting with a token instead",
      };
      return null;
    }
  }

  async function revokeToken(token: string): Promise<void> {
    const workerUrl = import.meta.env.VITE_GITHUB_WORKER_URL;

    if (!workerUrl || localStorage.getItem(TOKEN_SOURCE_KEY) !== "oauth") {
      return;
    }

    try {
      await fetch(`${workerUrl}/revoke`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        keepalive: true,
      });
    } catch {
      // Best-effort — proceed with local cleanup regardless
    }

    localStorage.removeItem(TOKEN_SOURCE_KEY);
  }

  return { state: readonly(state), startRedirect, handleCallback, revokeToken };
}
