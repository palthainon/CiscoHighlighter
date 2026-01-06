# CiscoHighlighter

VS Code extension for Cisco configuration syntax highlighting.

## Tech Stack
- TypeScript, VS Code Extension API (v1.102.0+)
- TextMate grammar (syntaxes/cisco.tmLanguage)
- Build: `npm run compile`

## Structure
- `src/extension.ts` - Main logic: HoverProvider, DiagnosticProvider
- `syntaxes/cisco.tmLanguage` - Syntax definitions
- `snipplets/cisco.json` - Code snippets
- `package.json` - Extension manifest

## Key Features
- Syntax highlighting for .ios/.cisco files
- Duplicate sequence detection (route-maps, ACLs, prefix-lists)
- ACL security analysis (permit any any, unreachable rules)
- 31+ configuration snippets

## Development
```bash
npm run compile   # Build
npm run watch     # Dev mode
```
