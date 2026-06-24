export type TradovateEnvironment = "live" | "demo";

/** Legacy API-key auth (developer / fallback). */
export type TradovateApiKeyCredentials = {
  authType?: "api_key";
  password: string;
  cid: string;
  sec: string;
  appId: string;
  environment: TradovateEnvironment;
};

/** Standard user OAuth connection. */
export type TradovateOAuthCredentials = {
  authType: "oauth";
  refreshToken: string;
  accessToken?: string;
  environment: TradovateEnvironment;
};

export type TradovateCredentials = TradovateApiKeyCredentials | TradovateOAuthCredentials;

export type TradovateAccessTokenResponse = {
  accessToken?: string;
  mdAccessToken?: string;
  expirationTime?: string;
  userId?: number;
  errorText?: string;
  error?: string;
  error_description?: string;
};

export type TradovateAccount = {
  id: number;
  name: string;
  active?: boolean;
  accountType?: string;
  clearingHouseId?: number;
};

export type TradovateReportParamDef = {
  name: string;
  paramType?: string;
  description?: string;
  optional?: boolean;
};

export type TradovateReportDefinition = {
  name: string;
  description?: string;
  params?: TradovateReportParamDef[];
};

export type TradovateReportRequestResponse = {
  reportId?: number | string;
  status?: string;
  data?: string;
  report?: string;
  errorText?: string;
};
