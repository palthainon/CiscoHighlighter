# Changelog
## [1.0.4] - 08-09-2025

### Added
* **Advanced ACL Analyzer**: Enhanced diagnostics for access control lists
  - Security risk detection for overly permissive `permit any any` rules
  - Unreachable code detection when `deny any any` appears above other rules
  - Redundant entry detection for identical permit/deny statements within same ACL
  - Implicit deny reminders for ACLs without explicit `deny any any` at end
* **Enhanced Command Snippets**: Expanded from 6 to 31 code snippets including:
  - Interface configuration (`int`)
  - Access lists (`acl-std`, `acl-ext`)
  - Route maps (`routemap`)
  - Routing protocols (OSPF, BGP, EIGRP)
  - Switching features (VLANs, STP, trunking)
  - Security configurations (SSH, AAA, banners)
  - Network services (NTP, SNMP)
  - Advanced features (VRF, HSRP, VRRP)
* **Extended File Support**: Added `.cisco` file extension alongside existing `.ios` support

### Changed
* Updated README documentation to reflect new file extension support

## [1.0.3] - 08-08-2025
* added tool tip functions for duplicate access lists and route-map sequence numbers

## [1.0.2] - 08-08-2025

### Added

* Preview gallery image added to showcase syntax highlighting capabilities

### Changed

* This extension is a fork of the original "jameswoodio cisco IOS Syntax" extension.

## [1.0] - 08-08-2025

### Added

* Enhanced interface declaration highlighting for various interface types (Ethernet, VLAN, Loopback, Port-channel, Tunnel, MgmtEthernet)
* Route-map syntax highlighting with permit/deny statements and sequence numbers
* Class-map and Policy-map highlighting for QoS configurations
* Enhanced ACL highlighting for both numbered and named access-lists
* Object-group syntax highlighting for ASA/NX-OS style configurations
* AAA command highlighting (authentication, authorization, accounting, new-model)
* RADIUS and TACACS+ server configuration highlighting
* Enhanced IPv4 and IPv6 address pattern matching
* Track object highlighting for high availability configurations
* IP SLA monitoring command highlighting
* Updated "permit" keyword highlighting to use green color scheme (constant.numeric.cisco) matching IP address coloring for better visual consistency
