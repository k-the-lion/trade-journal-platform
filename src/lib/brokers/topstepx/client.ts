import type {
  TopstepXAccount,
  TopstepXAccountSearchResponse,
  TopstepXContractResponse,
  TopstepXLoginResponse,
  TopstepXTrade,
  TopstepXTradeSearchResponse,
} from "./types";

const BASE_URL = process.env.TOPSTEPX_API_URL?.trim() || "https://api.topstepx.com/api";

export class TopstepXApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "TopstepXApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new TopstepXApiError(`Empty response (HTTP ${res.status})`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TopstepXApiError(
      `Invalid API response: ${text.slice(0, 120)}`,
      res.status
    );
  }
}

function extractToken(data: TopstepXLoginResponse): string {
  const token = data.token ?? data.accessToken ?? data.sessionToken;
  if (!token) {
    throw new TopstepXApiError(
      data.errorMessage || "Login succeeded but no session token was returned"
    );
  }
  return token;
}

function assertSuccess(data: { success?: boolean; errorMessage?: string | null; errorCode?: number }) {
  if (data.success === false || (data.errorCode && data.errorCode !== 0)) {
    throw new TopstepXApiError(data.errorMessage || "TopstepX API request failed");
  }
}

export async function topstepxLogin(username: string, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userName: username, apiKey }),
  });

  if (!res.ok) {
    const data = await parseJson<TopstepXLoginResponse>(res).catch(() => null);
    throw new TopstepXApiError(
      data?.errorMessage || `Authentication failed (HTTP ${res.status})`,
      res.status
    );
  }

  const data = await parseJson<TopstepXLoginResponse>(res);
  assertSuccess(data);
  return extractToken(data);
}

async function authFetch<T>(
  token: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJson<T & { errorMessage?: string | null; errorCode?: number; success?: boolean }>(res);

  if (!res.ok) {
    throw new TopstepXApiError(
      data.errorMessage || `Request failed (HTTP ${res.status})`,
      res.status
    );
  }

  assertSuccess(data);
  return data;
}

export async function topstepxListAccounts(token: string): Promise<TopstepXAccount[]> {
  const data = await authFetch<TopstepXAccountSearchResponse>(token, "/Account/search", {
    onlyActiveAccounts: true,
  });
  return data.accounts ?? [];
}

export async function topstepxSearchTrades(
  token: string,
  accountId: number,
  startTimestamp: string,
  endTimestamp?: string
): Promise<TopstepXTrade[]> {
  const data = await authFetch<TopstepXTradeSearchResponse>(token, "/Trade/search", {
    accountId,
    startTimestamp,
    endTimestamp,
  });
  return (data.trades ?? []).filter((t) => !t.voided);
}

export async function topstepxGetContract(
  token: string,
  contractId: string
): Promise<TopstepXContractResponse["contract"] | null> {
  try {
    const data = await authFetch<TopstepXContractResponse>(token, "/Contract/searchById", {
      contractId,
    });
    return data.contract ?? null;
  } catch {
    return null;
  }
}

export async function topstepxLoginWithFallback(username: string, apiKey: string): Promise<string> {
  try {
    return await topstepxLogin(username, apiKey);
  } catch (firstErr) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, apiKey }),
    });
    if (!res.ok) {
      throw firstErr;
    }
    const data = await parseJson<TopstepXLoginResponse>(res);
    assertSuccess(data);
    return extractToken(data);
  }
}
