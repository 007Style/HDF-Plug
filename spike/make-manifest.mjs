// THROWAWAY spike code. Writes manifest.xml pointing at a base URL.
// Usage: node make-manifest.mjs [baseUrl]   (default https://localhost:47630)
import { writeFileSync } from 'node:fs';

const base = (process.argv[2] || 'https://localhost:47630').replace(/\/$/, '');
const host = new URL(base).host;

const hosts = `
      <Hosts>
        <Host xsi:type="MailHost">
          <DesktopFormFactor>
            <FunctionFile resid="Commands.Url"/>
            <ExtensionPoint xsi:type="MessageReadCommandSurface">
              <OfficeTab id="TabDefault">
                <Group id="hdfSpikeGroup">
                  <Label resid="GroupLabel"/>
                  <Control xsi:type="Button" id="hdfSpikeButton">
                    <Label resid="ButtonLabel"/>
                    <Supertip>
                      <Title resid="ButtonLabel"/>
                      <Description resid="ButtonTip"/>
                    </Supertip>
                    <Icon>
                      <bt:Image size="16" resid="Icon16"/>
                      <bt:Image size="32" resid="Icon32"/>
                      <bt:Image size="80" resid="Icon80"/>
                    </Icon>
                    <Action xsi:type="ShowTaskpane">
                      <SourceLocation resid="Taskpane.Url"/>
                      PIN
                    </Action>
                  </Control>
                </Group>
              </OfficeTab>
            </ExtensionPoint>
          </DesktopFormFactor>
        </Host>
      </Hosts>
      <Resources>
        <bt:Images>
          <bt:Image id="Icon16" DefaultValue="${base}/assets/icon-16.png"/>
          <bt:Image id="Icon32" DefaultValue="${base}/assets/icon-32.png"/>
          <bt:Image id="Icon80" DefaultValue="${base}/assets/icon-80.png"/>
        </bt:Images>
        <bt:Urls>
          <bt:Url id="Commands.Url" DefaultValue="${base}/commands.html"/>
          <bt:Url id="Taskpane.Url" DefaultValue="${base}/pane.html"/>
        </bt:Urls>
        <bt:ShortStrings>
          <bt:String id="GroupLabel" DefaultValue="HDF Spike"/>
          <bt:String id="ButtonLabel" DefaultValue="HDF Spike"/>
        </bt:ShortStrings>
        <bt:LongStrings>
          <bt:String id="ButtonTip" DefaultValue="Throwaway test pane for the HDF-Plug spike"/>
        </bt:LongStrings>
      </Resources>`;

const desc = '<Description resid="ButtonTip"/>';
const req = '<Requirements><bt:Sets DefaultMinVersion="1.1"><bt:Set Name="Mailbox"/></bt:Sets></Requirements>';
const inner0 = req + hosts.replace('PIN', '');
const inner1 = req.replace('"1.1"', '"1.8"') + hosts.replace('PIN', '<SupportsPinning>true</SupportsPinning>');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0"
  xsi:type="MailApp">
  <Id>167a6e64-7b0e-4c5d-bfdf-f388d7e62d4b</Id>
  <Version>0.0.1.0</Version>
  <ProviderName>HDF-Plug spike</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="HDF Spike"/>
  <Description DefaultValue="Throwaway test pane for the HDF-Plug spike. Safe to remove."/>
  <IconUrl DefaultValue="${base}/assets/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="${base}/assets/icon-80.png"/>
  <SupportUrl DefaultValue="https://github.com/007Style"/>
  <AppDomains>
    <AppDomain>${base}</AppDomain>
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
        <SourceLocation DefaultValue="${base}/pane.html"/>
        <RequestedHeight>250</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
  </Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    ${desc}
    ${inner0}
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides/1.1" xsi:type="VersionOverridesV1_1">
      ${desc}
      ${inner1}
    </VersionOverrides>
  </VersionOverrides>
</OfficeApp>
`;
writeFileSync(new URL('./manifest.xml', import.meta.url), xml);
console.log(`manifest.xml written for ${base} (host ${host})`);
