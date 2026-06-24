export type TradovateEnvironment = "live" | "demo";

export type TradovateCredentials = {
  password: string;
  cid: string;
  sec: string;
  appId: string;
  environment: TradovateEnvironment;
};

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
