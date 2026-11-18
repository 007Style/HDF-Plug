// Writes manifest/manifest.xml for a page address. The default is the real GitHub Pages address.
// Usage: node tools/make-manifest.mjs [baseUrl] [outputFile]
// The manifest is add-in-only XML: it is the one format that works in new Outlook, classic Windows, the web AND Mac (PLAN 8.1, RESEARCH A7).
import { mkdirSync, writeFileSync } from 'node:fs';

const base = (process.argv[2] || 'https://007style.github.io/HDF-Plug').replace(/\/$/, '');
const origin = new URL(base).origin;

// Never change this id: it is how Outlook knows an update from a different add-in.
const ID = 'e8de068a-410a-4cf7-8080-08ff73e4f3f4';
const VERSION = '1.0.0.0';

// One button on one surface. Reading an email and writing one are separate surfaces, so each has its own ids.
const surface = (type, group, button, tip, pin) => `
            <ExtensionPoint xsi:type="${type}">
              <OfficeTab id="TabDefault">
                <Group id="${group}">
                  <Label resid="GroupLabel"/>
                  <Control xsi:type="Button" id="${button}">
                    <Label resid="ButtonLabel"/>
                    <Supertip>
                      <Title resid="ButtonLabel"/>
                      <Description resid="${tip}"/>
                    </Supertip>
                    <Icon>
                      <bt:Image size="16" resid="Icon16"/>
                      <bt:Image size="32" resid="Icon32"/>
                      <bt:Image size="80" resid="Icon80"/>
                    </Icon>
                    <Action xsi:type="ShowTaskpane">
                      <SourceLocation resid="Taskpane.Url"/>${pin ? '\n                      <SupportsPinning>true</SupportsPinning>' : ''}
                    </Action>
                  </Control>
                </Group>
              </OfficeTab>
            </ExtensionPoint>`;

const hosts = (pin) => `
      <Hosts>
        <Host xsi:type="MailHost">
          <DesktopFormFactor>
            <FunctionFile resid="Commands.Url"/>${surface('MessageReadCommandSurface', 'hdfGroup', 'hdfButton', 'ButtonTip', pin)}${surface('MessageComposeCommandSurface', 'hdfComposeGroup', 'hdfComposeButton', 'ComposeTip', pin)}
          </DesktopFormFactor>
        </Host>
      </Hosts>
      <Resources>
        <bt:Images>
          <bt:Image id="Icon16" DefaultValue="${base}/assets/bee-16.png"/>
          <bt:Image id="Icon32" DefaultValue="${base}/assets/bee-32.png"/>
          <bt:Image id="Icon80" DefaultValue="${base}/assets/bee-80.png"/>
        </bt:Images>
        <bt:Urls>
          <bt:Url id="Commands.Url" DefaultValue="${base}/commands.html"/>
          <bt:Url id="Taskpane.Url" DefaultValue="${base}/index.html"/>
        </bt:Urls>
        <bt:ShortStrings>
          <bt:String id="GroupLabel" DefaultValue="HoneyDue-Flow"/>
          <bt:String id="ButtonLabel" DefaultValue="Add to HoneyDue-Flow"/>
        </bt:ShortStrings>
        <bt:LongStrings>
          <bt:String id="ButtonTip" DefaultValue="Add the person on this email to a HoneyDue-Flow follow-up flow."/>
          <bt:String id="ComposeTip" DefaultValue="Add the person on the To line of this message to a HoneyDue-Flow follow-up flow."/>
        </bt:LongStrings>
      </Resources>`;

const desc = '<Description resid="ButtonTip"/>';
const req = (v) => `<Requirements><bt:Sets DefaultMinVersion="${v}"><bt:Set Name="Mailbox"/></bt:Sets></Requirements>`;

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0"
  xsi:type="MailApp">
  <Id>${ID}</Id>
  <Version>${VERSION}</Version>
  <ProviderName>007Style</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="HoneyDue-Flow"/>
  <Description DefaultValue="Add the person on the email you are reading, or on the To line of the message you are writing, to a HoneyDue-Flow follow-up flow."/>
  <IconUrl DefaultValue="${base}/assets/bee-32.png"/>
  <HighResolutionIconUrl DefaultValue="${base}/assets/bee-80.png"/>
  <SupportUrl DefaultValue="https://github.com/007Style/HDF-Plug"/>
  <AppDomains>
    <AppDomain>${origin}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>
  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="${base}/index.html"/>
        <RequestedHeight>250</RequestedHeight>
      </DesktopSettings>
    </Form>
    <Form xsi:type="ItemEdit">
      <DesktopSettings>
        <SourceLocation DefaultValue="${base}/index.html"/>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Edit"/>
  </Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    ${desc}
    ${req('1.1')}${hosts(false)}
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides/1.1" xsi:type="VersionOverridesV1_1">
      ${desc}
      ${req('1.8')}${hosts(true)}
    </VersionOverrides>
  </VersionOverrides>
</OfficeApp>
`;

// An optional third argument names the file to write (the tests use it, so they never touch the real manifest).
const out = process.argv[3] ? new URL(`file://${process.argv[3]}`) : new URL('../manifest/manifest.xml', import.meta.url);
mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, xml);
console.log(`${out.pathname} written for ${base}`);
