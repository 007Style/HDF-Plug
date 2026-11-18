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

// The data endpoints (BRIDGE-API 2.3 to 2.6).

export type Channel = 'email' | 'call' | 'linkedin';

/** The four business outcomes of `contacts/check`. */
export type Eligibility =
  | { result: 'eligible'; contact: { displayName: string; email: string; company: string } }
  | { result: 'not_in_contacts' }
  | { result: 'missing_fields'; missing: string[]; contact?: { displayName: string } }
  | { result: 'already_in_flow'; contact: { displayName: string }; flow?: { cadenceName?: string } };

export interface CadenceOption { id: string; name: string; stepCount: number; firstChannel: Channel; active: boolean; inactiveReason?: string }
export interface TemplateOption { id: string; name: string; channel: Channel }
export interface FlowOptions { cadences: CadenceOption[]; templates: TemplateOption[]; noScriptCall: boolean }

export type FlowChoice =
  | { kind: 'cadence'; cadenceId: string }
  | { kind: 'template'; channel: Channel; templateId?: string };

export interface ScheduleCheck { inPast: boolean; held: boolean; reason?: string; nextAllowed?: string }

export interface AddResult { contact: { displayName: string }; flow: { name: string; kind: 'cadence' | 'template' }; firstStepAt: string; calendarNote: string }

/** A failure from a data call. `detail` is what HoneyDue-Flow sent with a `not_eligible`. */
export interface DataFailure extends BridgeFailure { detail?: { result?: string; missing?: string[] } }
export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: DataFailure };
