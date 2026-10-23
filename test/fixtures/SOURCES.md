# Cisco syntax test sources

The fixtures contain synthetic names and addresses. The fixtures use command forms from Cisco public documents. The fixtures do not contain customer output. The tests check token scopes. The tests do not validate device configurations.

Reviewed on 2026-10-23:

- [IOS banner command reference](https://www.cisco.com/c/en/us/td/docs/ios/fundamentals/command/reference/cf_book/cf_a1.html): Delimiter-based banner form.
- [NX-OS vPC configuration guide](https://www.cisco.com/c/en/us/td/docs/dcn/nx-os/nexus9000/104x/configuration/interfaces/cisco-nexus-9000-series-nx-os-interfaces-configuration-guide-release-104x/m_configuring_vpcs_9x.html): Feature, domain, peer link, and keepalive command forms.
- [NX-OS interface show commands](https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus5600/sw/command/reference/interfaces/7x/n5600_if_cmd_ref/n5600_if_cmds_show.html): Ethernet, port channel, management, and VLAN output forms.
- [ASA network object NAT guide](https://www.cisco.com/c/en/us/td/docs/security/asa/asa92/configuration/firewall/asa-firewall-cli/nat-objects.html): Network object, subnet, object reference, and NAT command forms.
- [ASA connection command reference](https://www.cisco.com/c/en/us/td/docs/security/asa/asa-cli-reference/S/asa-command-ref-S/show-b-to-show-cq-commands.html): Connection output, addresses, ports, and elapsed time fields.
- [ASA banner configuration guide](https://www.cisco.com/c/en/us/td/docs/security/asa/asa922/configuration/general/asa-922-general-config/admin-management.html): Repeated line-based banner form.
- [Cisco FTD architecture](https://www.cisco.com/c/en/us/support/docs/security/firepower-ngfw/200950-Clarifying-the-Firepower-Threat-Defense.html): LINA, the ASA processing engine. The fixture covers ASA-style text. The fixture does not cover the full FTD command set.

## Test scope

`grammar.test.js` loads the shipped XML grammar through `vscode-textmate`. The tests use the Oniguruma engine through `vscode-oniguruma`. The tests check each character in the expected token span. The tests carry grammar state across banner lines.

The shared Cisco language cannot always distinguish ASA line banners from IOS delimiter banners. The grammar treats punctuation and `^C` as banner delimiters. The grammar treats other banner text as a single line. Alphabetic IOS delimiters need a future grammar change. ASA banner text that starts with punctuation can be read as a delimiter.

The tests cover compressed IPv6, full IPv6, IPv4-mapped IPv6, and a zone suffix. The grammar does not validate every possible address form. The tests also cover long unknown lines under a one-second tokenizer guard.
