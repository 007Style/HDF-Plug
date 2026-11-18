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

  // Connected
  disconnect: 'Disconnect',
  connectedFooter: (version: string) => `Connected to HoneyDue-Flow ${version}`,

  // The email (PLAN 5.2)
  loadingEmail: 'Reading this email...',
  notEmail: 'Open an email message to add the person on it to a flow.',
  composing: 'This message is still being written. Send it, then open it from Sent Items to add the person on it.',
  noPerson: 'No other person on this email.',
  personHeading: 'Person on this email',
  checkingPerson: 'Checking this person...',
  personOk: 'Can be added',
  personNotOk: "Can't be added",
  checkAgain: 'Check again',

  // Not eligible (PLAN 5.3, states 7 to 9)
  cannotTitle: (who: string) => `${who} can't be added to a flow`,
  notInContacts: (email: string) => `${email} is not in your Outlook contacts, so it can't be added to a flow. Add this person to your Outlook contacts, with a first name, last name and company, then press Check again.`,
  missingFields: (list: string) => `This Outlook contact is missing: ${list}. Add them in Outlook, then press Check again.`,
  alreadyInFlowNamed: (name: string, flow: string) => `${name} is already in the flow '${flow}'. A contact can be in only one flow at a time.`,
  alreadyInFlow: (name: string) => `${name} is already in a flow. A contact can be in only one flow at a time.`,
  contactsUnavailable: 'HoneyDue-Flow could not read your Outlook contacts just now. Try again in a moment.',

  // The form (PLAN 5.1)
  emailsGoTo: (email: string) => `Emails will go to ${email}.`,
  flowHeading: 'Flow',
  searchLabel: 'Search flows',
  searchPlaceholder: 'Search flows...',
  multiStep: 'Multi-step',
  singleStep: 'Single step',
  noMatches: 'No flow matches that search.',
  noFlows: 'There are no flows or templates yet. Create one in HoneyDue-Flow first.',
  loadingFlows: 'Loading your flows...',
  flowsFailed: 'The list of flows could not be loaded.',
  stepsOf: (n: number, first: string) => `${n} ${n === 1 ? 'step' : 'steps'}, starts with ${first}`,
  channelEmail: 'Email',
  channelCall: 'Phone call',
  channelLinkedin: 'LinkedIn',
  firstEmail: 'email',
  firstCall: 'a phone call',
  firstLinkedin: 'LinkedIn',
  noScriptCall: 'Phone call, no script',
  switchedOffFlow: 'Switched off',
  startHeading: 'Start',
  dateLabel: 'Start date',
  timeLabel: 'Start time',
  inPast: 'This time has already passed. The first step will run within about a minute.',
  held: (reason: string, next: string) => `${reason} It will go out ${next}.`,
  pickFlow: 'Choose a flow to continue.',
  badTime: 'Enter a start date and time.',
  ok: 'OK, start flow',
  submitting: 'Adding...',

  // Result (PLAN 5.3, states 13 to 15)
  success: (name: string, flow: string, when: string) => `${name} is in '${flow}'. First step: ${when}.`,
  successTitle: 'Added',
  calendarWarning: (note: string) => `The person is in the flow, but: ${note}`,
  done: 'Done',
  failedTitle: 'Could not add this person',
  appBusy: 'HoneyDue-Flow is busy. Try again in a moment.',
  tooMany: 'Too many requests. Wait a moment, then try again.',

  // Failure
  somethingWrong: 'Something went wrong talking to HoneyDue-Flow.',
} as const;

export type TextKey = keyof typeof TEXTS;
