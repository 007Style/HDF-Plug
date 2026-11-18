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
  composeNone: 'Put the person you are writing to on the To line, then press Check again.',
  composeMany: (count: number) => `There are ${count} people on the To line. This works with one person at a time: leave one person on the To line, then press Check again.`,
  noPerson: 'No other person on this email.',
  personHeading: 'Person on this email',
  readFromSent: (email: string) => `Read from a sent email: ${email}`,
  readFromTo: (email: string) => `Read from the To line: ${email}`,
  readFromReceived: (email: string) => `Read from a received email: ${email}`,
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

  // The page opened in a browser, not inside Outlook: how to install it
  installTitle: 'Install the HoneyDue-Flow add-in in Outlook',
  installIntro: 'This page is the add-in. It runs inside Outlook, so to use it you add it to Outlook once. You do not need to download anything.',
  installAddressLabel: 'Add-in address',
  installCopy: 'Copy address',
  installCopied: 'Copied',
  installCopyFailed: 'Could not copy. Select the address and copy it yourself.',
  installOpenOutlook: 'Open the Outlook add-in page',
  installSteps: [
    'Press Copy address above.',
    'Open the Outlook add-in page (the link above). Sign in if asked.',
    'Choose My add-ins, then under Custom Addins choose Add a custom add-in, then Add from URL.',
    'Paste the address and press OK. Accept the warning that this add-in did not come from the store.',
    'Open an email in Outlook. The Add to HoneyDue-Flow button appears in the ribbon.',
  ],
  installFallback: 'If Add from URL is missing or greyed out (it is on some Outlooks, for reasons Microsoft controls), choose Add from File instead and use the manifest file below.',
  installFile: 'Download manifest.xml',
  installClassicButton: 'How do I install on classic Outlook?',
  installClassicTitle: 'Installing on classic Outlook for Windows',
  installClassicNote: 'These steps come from Microsoft\'s instructions. The author has not yet tried them on classic Outlook.',
  installClassicSteps: [
    'Install HoneyDue-Flow 1.2.0 or later for Windows, open it, and in Settings, Outlook Add-in, press Set up. Approve the certificate prompt.',
    'Download manifest.xml with the link above, and keep it somewhere you can find it.',
    'In classic Outlook, choose File, then Info, then Manage Add-ins. Outlook on the web opens in your browser.',
    'Choose My add-ins. At the bottom, under Custom Addins, choose Add a custom add-in, then Add from File, and pick manifest.xml. Accept the prompts.',
    'Wait. Microsoft says it can take up to 24 hours for the button to show in classic Outlook. Closing and reopening Outlook can help.',
    'Open an email. The Add to HoneyDue-Flow button appears in the ribbon.',
  ],
  installNeeds: 'You also need HoneyDue-Flow 1.2.0 or later running on this computer. Open its Settings, find Outlook Add-in and press Set up, once.',

  // Failure
  somethingWrong: 'Something went wrong talking to HoneyDue-Flow.',
} as const;

export type TextKey = keyof typeof TEXTS;
