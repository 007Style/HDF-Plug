// Every message the panel can show, in one table, so wording changes in one place (PLAN 5.3) and a test can check each state has one.

export const TEXTS = {
  title: 'HoneyDue-Flow',

  checking: 'Looking for HoneyDue-Flow...',

  // State 1
  notDetectedTitle: 'HoneyDue-Flow was not detected',
  notDetected:
    'HoneyDue-Flow was not detected on this computer. It must be installed and running before you can use this add-in. If it is installed, open it. It may be hidden in the system tray.',
  notDetectedSetup:
    'If HoneyDue-Flow is running and you still see this, open its Settings, find Outlook Add-in and press Set up. The add-in cannot reach HoneyDue-Flow until that is done once.',
  download: 'Get HoneyDue-Flow',
  tryAgain: 'Try again',

  // State 2
  hdfTooOld: 'Update HoneyDue-Flow to 1.2.0 or later to use this add-in.',
  addInTooOld: 'This add-in is out of date. Update it, then reopen this panel.',

  // State 3
  notConnectedTitle: 'Connect to HoneyDue-Flow',
  notConnected: 'Connect this add-in to HoneyDue-Flow. HoneyDue-Flow will ask you to allow it. You do this once.',
  connect: 'Connect',
  waitingForAllow: 'Switch to HoneyDue-Flow and click Allow.',
  cancel: 'Cancel',
  connectDenied: 'Not allowed. HoneyDue-Flow did not allow this add-in.',
  connectExpired: 'Timed out. HoneyDue-Flow did not get an answer in time.',
  connectBusy: 'HoneyDue-Flow is already waiting for an answer to another request. Answer it, then try again.',
  connectLocked: (minutes: number) => `Too many requests were refused. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,

  // State 4
  switchedOff: 'The Outlook add-in is switched off in HoneyDue-Flow Settings.',

  // State 5
  notSignedIn: 'HoneyDue-Flow is not signed in to Microsoft 365. Sign in from its Settings.',

  // Connected (the end of the walking skeleton)
  connectedTitle: 'Connected',
  connected: 'This add-in is connected to HoneyDue-Flow. Choosing a person and a flow comes in the next version.',
  disconnect: 'Disconnect',

  // Failure
  somethingWrong: 'Something went wrong talking to HoneyDue-Flow.',
} as const;

export type TextKey = keyof typeof TEXTS;
