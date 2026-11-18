// The shapes in BRIDGE-API.md (version 1). Unknown fields are ignored, so new kinds can be added later without breaking an old add-in.

export type Connection = 'connected' | 'disconnected' | 'error';

export interface Hello {
  ok: true;
  app: 'HoneyDue-Flow';
  appVersion: string;
  apiVersion: number;
  bridgeEnabled: boolean;
  connection: Connection;
  /** Whether the token sent with this call is valid. */
  connected: boolean;
}

export type ConnectStatus = 'pending' | 'allowed' | 'denied' | 'expired';

export interface BridgeFailure {
  code: string;
  message: string;
  status: number;
  retryAfterSeconds?: number;
}

/** What the add-in understands of the bridge. Bumped only with a new `/vN` path. */
export const SUPPORTED_API_VERSION = 1;
export const PORT_FIRST = 47615;
export const PORT_LAST = 47624;
