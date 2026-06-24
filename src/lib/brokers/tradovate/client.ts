import type {
  TradovateAccessTokenResponse,
  TradovateAccount,
  TradovateApiKeyCredentials,
  TradovateCredentials,
  TradovateEnvironment,
  TradovateOAuthCredentials,
  TradovateReportDefinition,
  TradovateReportRequestResponse,
} from "./types";
import { tradovateRefreshOAuthToken } from "./oauth";

const APP_VERSION = "1.0.0";
const DEVICE_ID = "trade-journal-sync-v1";

export class TradovateApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "TradovateApiError";
  }
}

function apiBase(env: TradovateEnvironment): string {
  return env === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}

function reportBase(env: TradovateEnvironment): string {
  return env === "live"
    ? "https://rpt-live.tradovateapi.com/v1"
    : "https://rpt-demo.tradovateapi.com/v1";
}

function extractApiError(data: TradovateAccessTokenResponse | null): string | null {
  if (!data) return null;
  if (data.errorText?.trim()) return data.errorText;
  if (data.error_description?.trim()) return data.error_description;
  if (data.error?.trim()) return data.error;
  return null;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new TradovateApiError(`Empty response (HTTP ${res.status})`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TradovateApiError(
      `Invalid API response: ${text.slice(0, 160)}`,
      res.status
    );
  }
}

function looksLikeCsv(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  return firstLine.includes(",") && firstLine.length > 3;
}

function extractCsvPayload(text: string): string | null {
  if (looksLikeCsv(text)) return text;
  try {
    const data = JSON.parse(text) as TradovateReportRequestResponse & Record<string, unknown>;
    for (const key of ["data", "report", "csv", "content", "reportData"]) {
      const value = data[key];
      if (typeof value === "string" && looksLikeCsv(value)) return value;
    }
    return null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tradovateAccessToken(
  username: string,
  creds: Pick<TradovateApiKeyCredentials, "password" | "cid" | "sec" | "appId" | "environment">
): Promise<string> {
  const cid = Number(creds.cid);
  if (!Number.isFinite(cid) || cid <= 0) {
    throw new TradovateApiError("API Client ID (cid) must be a positive number");
  }

  const res = await fetch(`${apiBase(creds.environment)}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: username.trim(),
      password: creds.password,
      appId: creds.appId.trim() || "TradeJournal",
      appVersion: APP_VERSION,
      cid,
      sec: creds.sec.trim(),
      deviceId: DEVICE_ID,
    }),
  });

  const data = await parseJson<TradovateAccessTokenResponse>(res);
  const apiError = extractApiError(data);
  if (!res.ok || apiError) {
    throw new TradovateApiError(
      apiError || `Authentication failed (HTTP ${res.status})`,
      res.status
    );
  }
  if (!data.accessToken) {
    throw new TradovateApiError("Authentication succeeded but no access token was returned");
  }
  return data.accessToken;
}

function isOAuthCredentials(creds: TradovateCredentials): creds is TradovateOAuthCredentials {
  return creds.authType === "oauth" || "refreshToken" in creds;
}

export async function resolveTradovateAccessToken(
  username: string,
  creds: TradovateCredentials
): Promise<{ token: string; updatedCreds?: TradovateOAuthCredentials }> {
  if (isOAuthCredentials(creds)) {
    if (creds.accessToken) {
      return { token: creds.accessToken };
    }
    const refreshed = await tradovateRefreshOAuthToken(creds.environment, creds.refreshToken);
    if (!refreshed.access_token) {
      throw new TradovateApiError("OAuth refresh did not return an access token");
    }
    return {
      token: refreshed.access_token,
      updatedCreds: {
        authType: "oauth",
        refreshToken: refreshed.refresh_token || creds.refreshToken,
        accessToken: refreshed.access_token,
        environment: creds.environment,
      },
    };
  }

  const apiKeyCreds = creds as TradovateApiKeyCredentials;
  return {
    token: await tradovateAccessToken(username, apiKeyCreds),
  };
}

async function authFetch<T>(
  token: string,
  baseUrl: string,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const data = JSON.parse(text) as { errorText?: string; error?: string };
      message = data.errorText || data.error || message;
    } catch {
      if (text.trim()) message = text.slice(0, 160);
    }
    throw new TradovateApiError(message, res.status);
  }

  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TradovateApiError(`Invalid JSON response: ${text.slice(0, 160)}`, res.status);
  }
}

export async function tradovateListAccounts(
  token: string,
  environment: TradovateEnvironment
): Promise<TradovateAccount[]> {
  const data = await authFetch<TradovateAccount[] | { accounts?: TradovateAccount[] }>(
    token,
    apiBase(environment),
    "/account/list"
  );
  const list = Array.isArray(data) ? data : (data.accounts ?? []);
  return list.filter((a) => a.active !== false);
}

export async function tradovateGetReportDefinitions(
  token: string,
  environment: TradovateEnvironment
): Promise<TradovateReportDefinition[]> {
  const data = await authFetch<TradovateReportDefinition[] | { definitions?: TradovateReportDefinition[] }>(
    token,
    reportBase(environment),
    "/reports/requestReportDefinitions",
    { method: "POST", body: {} }
  );
  return Array.isArray(data) ? data : (data.definitions ?? []);
}

function formatTradovateDate(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function pickPositionHistoryReport(
  definitions: TradovateReportDefinition[]
): TradovateReportDefinition | null {
  const preferred = [
    "position history",
    "positions",
    "performance",
    "closed positions",
  ];
  for (const needle of preferred) {
    const match = definitions.find((d) => d.name.toLowerCase().includes(needle));
    if (match) return match;
  }
  return null;
}

function buildReportParams(
  definition: TradovateReportDefinition,
  accountId: number,
  start: Date,
  end: Date
): Array<{ name: string; value: string | number }> {
  const params: Array<{ name: string; value: string | number }> = [];
  const defs = definition.params ?? [];

  for (const param of defs) {
    if (param.optional) continue;
    const lower = param.name.toLowerCase();

    if (lower.includes("startdate") || lower === "start") {
      params.push({ name: param.name, value: formatTradovateDate(start) });
    } else if (lower.includes("enddate") || lower === "end") {
      params.push({ name: param.name, value: formatTradovateDate(end) });
    } else if (lower.includes("account")) {
      params.push({ name: param.name, value: accountId });
    }
  }

  if (!params.some((p) => p.name.toLowerCase().includes("start"))) {
    params.push({ name: "startDate", value: formatTradovateDate(start) });
  }
  if (!params.some((p) => p.name.toLowerCase().includes("end"))) {
    params.push({ name: "endDate", value: formatTradovateDate(end) });
  }
  if (!params.some((p) => p.name.toLowerCase().includes("account"))) {
    params.push({ name: "account", value: accountId });
  }

  return params;
}

async function pollReportCsv(
  token: string,
  environment: TradovateEnvironment,
  reportId: number | string
): Promise<string> {
  const base = reportBase(environment);
  const pollPaths = [
    "/reports/getReport",
    "/reports/getReportResult",
    "/reports/checkReport",
  ];

  for (let attempt = 0; attempt < 25; attempt++) {
    await sleep(attempt === 0 ? 500 : 1000);
    for (const path of pollPaths) {
      for (const method of ["POST", "GET"] as const) {
        try {
          const url =
            method === "GET" ? `${base}${path}?reportId=${encodeURIComponent(String(reportId))}` : `${base}${path}`;
          const res = await fetch(url, {
            method,
            headers: {
              Accept: "application/json, text/csv, text/plain",
              Authorization: `Bearer ${token}`,
              ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
            },
            body: method === "POST" ? JSON.stringify({ reportId }) : undefined,
          });
          const text = await res.text();
          const csv = extractCsvPayload(text);
          if (csv) return csv;

          if (res.ok) {
            try {
              const data = JSON.parse(text) as TradovateReportRequestResponse;
              if (data.status && /complete|ready|done/i.test(data.status) && data.data) {
                return data.data;
              }
            } catch {
              // not JSON
            }
          }
        } catch {
          // try next path
        }
      }
    }
  }

  throw new TradovateApiError("Report generation timed out — try again or use CSV import");
}

async function requestReportCsv(
  token: string,
  environment: TradovateEnvironment,
  body: Record<string, unknown>
): Promise<string> {
  const base = reportBase(environment);
  const res = await fetch(`${base}/reports/requestReport`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/csv, text/plain",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const immediate = extractCsvPayload(text);
  if (immediate) return immediate;

  if (!res.ok) {
    let message = `Report request failed (HTTP ${res.status})`;
    try {
      const data = JSON.parse(text) as { errorText?: string };
      if (data.errorText) message = data.errorText;
    } catch {
      if (text.trim()) message = text.slice(0, 160);
    }
    throw new TradovateApiError(message, res.status);
  }

  let data: TradovateReportRequestResponse;
  try {
    data = JSON.parse(text) as TradovateReportRequestResponse;
  } catch {
    throw new TradovateApiError("Unexpected report response format");
  }

  if (data.errorText) {
    throw new TradovateApiError(data.errorText);
  }

  if (data.data && looksLikeCsv(data.data)) {
    return data.data;
  }

  if (data.reportId !== undefined) {
    return pollReportCsv(token, environment, data.reportId);
  }

  throw new TradovateApiError("Report returned no trade data");
}

export async function tradovateFetchPositionHistoryCsv(
  token: string,
  environment: TradovateEnvironment,
  accountId: number,
  start: Date,
  end: Date
): Promise<string> {
  const definitions = await tradovateGetReportDefinitions(token, environment);
  const reportDef = pickPositionHistoryReport(definitions);

  const timezone = -300;
  const reportNames = reportDef
    ? [reportDef.name]
    : ["Position History", "Positions", "Performance"];

  let lastError: Error | null = null;

  for (const name of reportNames) {
    try {
      const def =
        reportDef ??
        definitions.find((d) => d.name.toLowerCase() === name.toLowerCase()) ??
        ({ name, params: [] } as TradovateReportDefinition);

      const params = buildReportParams(def, accountId, start, end);
      return await requestReportCsv(token, environment, {
        name: def.name,
        representationType: "csv",
        timezone,
        params,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new TradovateApiError("Could not fetch Position History report");
}

export async function tradovateLoginAndListAccounts(
  username: string,
  creds: TradovateApiKeyCredentials
): Promise<{ token: string; accounts: TradovateAccount[] }> {
  const token = await tradovateAccessToken(username, creds);
  const accounts = await tradovateListAccounts(token, creds.environment);
  if (!accounts.length) {
    throw new TradovateApiError(
      `No Tradovate accounts found. Check ${creds.environment === "live" ? "Live" : "Demo"} environment matches your account.`
    );
  }
  return { token, accounts };
}
