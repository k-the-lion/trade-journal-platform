export interface TopstepXLoginResponse {
  success?: boolean;
  errorCode?: number;
  errorMessage?: string | null;
  token?: string;
  accessToken?: string;
  sessionToken?: string;
}

export interface TopstepXAccount {
  id: number;
  name: string;
  balance?: number;
  canTrade?: boolean;
  isVisible?: boolean;
  simulated?: boolean;
}

export interface TopstepXAccountSearchResponse {
  success?: boolean;
  errorCode?: number;
  errorMessage?: string | null;
  accounts?: TopstepXAccount[];
}

export interface TopstepXTrade {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  price: number;
  profitAndLoss: number | null;
  fees: number;
  side: number;
  size: number;
  voided: boolean;
  orderId: number;
}

export interface TopstepXTradeSearchResponse {
  success?: boolean;
  errorCode?: number;
  errorMessage?: string | null;
  trades?: TopstepXTrade[];
}

export interface TopstepXContract {
  id: string;
  name?: string;
  description?: string;
  tickSize?: number;
  tickValue?: number;
}

export interface TopstepXContractResponse {
  success?: boolean;
  errorCode?: number;
  errorMessage?: string | null;
  contract?: TopstepXContract;
}
