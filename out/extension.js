"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    const provider = new CiscoHoverProvider();
    const hoverDisposable = vscode.languages.registerHoverProvider('cisco', provider);
    context.subscriptions.push(hoverDisposable);
    // Create diagnostic collection for duplicate sequence warnings
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('cisco-duplicates');
    context.subscriptions.push(diagnosticCollection);
    // Register diagnostic provider
    const diagnosticProvider = new CiscoDiagnosticProvider(diagnosticCollection);
    // Update diagnostics when document is opened or changed
    const onDidOpenDisposable = vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId === 'cisco') {
            diagnosticProvider.updateDiagnostics(doc);
        }
    });
    const onDidChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'cisco') {
            diagnosticProvider.updateDiagnostics(event.document);
        }
    });
    context.subscriptions.push(onDidOpenDisposable, onDidChangeDisposable);
    // Update diagnostics for already open documents
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'cisco') {
            diagnosticProvider.updateDiagnostics(doc);
        }
    });
}
function deactivate() { }
class CiscoHoverProvider {
    provideHover(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check for route-map duplicates
        const routeMapMatch = lineText.match(/^route-map\s+(\S+)\s+(permit|deny)\s+(\d+)/);
        if (routeMapMatch) {
            const [, mapName, action, sequenceNum] = routeMapMatch;
            const duplicates = this.findRouteMapDuplicates(document, mapName, sequenceNum, position.line);
            if (duplicates.length > 0) {
                const lines = duplicates.map(lineNum => `Line ${lineNum + 1}`).join(', ');
                return new vscode.Hover(`⚠️ **Duplicate route-map sequence detected**\n\nRoute-map "${mapName}" sequence ${sequenceNum} is also defined on: ${lines}`, new vscode.Range(position.line, 0, position.line, lineText.length));
            }
        }
        // Check for prefix-list duplicates
        const prefixListMatch = lineText.match(/^ip\s+prefix-list\s+(\S+)\s+seq\s+(\d+)/);
        if (prefixListMatch) {
            const [, listName, sequenceNum] = prefixListMatch;
            const duplicates = this.findPrefixListDuplicates(document, listName, sequenceNum, position.line);
            if (duplicates.length > 0) {
                const lines = duplicates.map(lineNum => `Line ${lineNum + 1}`).join(', ');
                return new vscode.Hover(`⚠️ **Duplicate prefix-list sequence detected**\n\nPrefix-list "${listName}" sequence ${sequenceNum} is also defined on: ${lines}`, new vscode.Range(position.line, 0, position.line, lineText.length));
            }
        }
        // Check for ASA access-list duplicates
        const asaAclMatch = lineText.match(/^access-list\s+(\S+)\s+line\s+(\d+)/);
        if (asaAclMatch) {
            const [, listName, lineNum] = asaAclMatch;
            const duplicates = this.findAsaAccessListDuplicates(document, listName, lineNum, position.line);
            if (duplicates.length > 0) {
                const lines = duplicates.map(lineNum => `Line ${lineNum + 1}`).join(', ');
                return new vscode.Hover(`⚠️ **Duplicate ASA access-list line detected**\n\nAccess-list "${listName}" line ${lineNum} is also defined on: ${lines}`, new vscode.Range(position.line, 0, position.line, lineText.length));
            }
        }
        // Check for access-list duplicates
        const aclMatch = lineText.match(/^\s*(\d+)\s+(permit|deny)/);
        if (aclMatch) {
            const [, sequenceNum] = aclMatch;
            const aclContext = this.findAccessListContext(document, position.line);
            if (aclContext) {
                const duplicates = this.findAccessListDuplicates(document, aclContext, sequenceNum, position.line);
                if (duplicates.length > 0) {
                    const lines = duplicates.map(lineNum => `Line ${lineNum + 1}`).join(', ');
                    return new vscode.Hover(`⚠️ **Duplicate access-list sequence detected**\n\nAccess-list "${aclContext}" sequence ${sequenceNum} is also defined on: ${lines}`, new vscode.Range(position.line, 0, position.line, lineText.length));
                }
            }
        }
        return null;
    }
    findRouteMapDuplicates(document, mapName, sequenceNum, currentLine) {
        const duplicates = [];
        const regex = new RegExp(`^route-map\\s+${this.escapeRegex(mapName)}\\s+(?:permit|deny)\\s+${sequenceNum}\\b`);
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine)
                continue;
            const line = document.lineAt(i);
            if (regex.test(line.text)) {
                duplicates.push(i);
            }
        }
        return duplicates;
    }
    findAccessListContext(document, lineNum) {
        for (let i = lineNum; i >= 0; i--) {
            const line = document.lineAt(i);
            const match = line.text.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (match) {
                return match[1];
            }
            if (line.text.trim() === '' || line.text.startsWith('!')) {
                continue;
            }
            if (line.text.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                break;
            }
        }
        return null;
    }
    findAccessListDuplicates(document, aclName, sequenceNum, currentLine) {
        const duplicates = [];
        let inTargetACL = false;
        let currentACLName = '';
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine)
                continue;
            const line = document.lineAt(i);
            const lineText = line.text;
            const aclMatch = lineText.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (aclMatch) {
                currentACLName = aclMatch[1];
                inTargetACL = (currentACLName === aclName);
                continue;
            }
            if (lineText.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                inTargetACL = false;
                continue;
            }
            if (inTargetACL) {
                const seqMatch = lineText.match(/^\s*(\d+)\s+(?:permit|deny)/);
                if (seqMatch && seqMatch[1] === sequenceNum) {
                    duplicates.push(i);
                }
            }
        }
        return duplicates;
    }
    findPrefixListDuplicates(document, listName, sequenceNum, currentLine) {
        const duplicates = [];
        const regex = new RegExp(`^ip\\s+prefix-list\\s+${this.escapeRegex(listName)}\\s+seq\\s+${sequenceNum}\\b`);
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine)
                continue;
            const line = document.lineAt(i);
            if (regex.test(line.text)) {
                duplicates.push(i);
            }
        }
        return duplicates;
    }
    findAsaAccessListDuplicates(document, listName, lineNum, currentLine) {
        const duplicates = [];
        const regex = new RegExp(`^access-list\\s+${this.escapeRegex(listName)}\\s+line\\s+${lineNum}\\b`);
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine)
                continue;
            const line = document.lineAt(i);
            if (regex.test(line.text)) {
                duplicates.push(i);
            }
        }
        return duplicates;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
class CiscoDiagnosticProvider {
    constructor(diagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
    }
    updateDiagnostics(document) {
        const diagnostics = [];
        // Find route-map duplicates
        const routeMapSequences = new Map();
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const routeMapMatch = line.text.match(/^route-map\s+(\S+)\s+(permit|deny)\s+(\d+)/);
            if (routeMapMatch) {
                const [, mapName, action, sequenceNum] = routeMapMatch;
                const key = `${mapName}-${sequenceNum}`;
                if (!routeMapSequences.has(key)) {
                    routeMapSequences.set(key, []);
                }
                routeMapSequences.get(key).push(i);
            }
        }
        // Add diagnostics for route-map duplicates
        routeMapSequences.forEach((lines, key) => {
            if (lines.length > 1) {
                const [mapName, sequenceNum] = key.split('-');
                lines.forEach(lineNum => {
                    const line = document.lineAt(lineNum);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNum, 0, lineNum, line.text.length), `Duplicate route-map sequence: ${mapName} sequence ${sequenceNum} (also on lines ${lines.filter(l => l !== lineNum).map(l => l + 1).join(', ')})`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });
        // Find access-list duplicates
        const accessListSequences = new Map();
        let currentACL = '';
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // Check for ACL declaration
            const aclMatch = lineText.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (aclMatch) {
                currentACL = aclMatch[1];
                continue;
            }
            // Reset current ACL if we hit a different configuration block
            if (lineText.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                currentACL = '';
                continue;
            }
            // Check for sequence number entries
            if (currentACL) {
                const seqMatch = lineText.match(/^\s*(\d+)\s+(?:permit|deny)/);
                if (seqMatch) {
                    const sequenceNum = seqMatch[1];
                    const key = `${currentACL}-${sequenceNum}`;
                    if (!accessListSequences.has(key)) {
                        accessListSequences.set(key, []);
                    }
                    accessListSequences.get(key).push(i);
                }
            }
        }
        // Add diagnostics for access-list duplicates
        accessListSequences.forEach((lines, key) => {
            if (lines.length > 1) {
                const [aclName, sequenceNum] = key.split('-');
                lines.forEach(lineNum => {
                    const line = document.lineAt(lineNum);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNum, 0, lineNum, line.text.length), `Duplicate access-list sequence: ${aclName} sequence ${sequenceNum} (also on lines ${lines.filter(l => l !== lineNum).map(l => l + 1).join(', ')})`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });
        // Find prefix-list duplicates
        const prefixListSequences = new Map();
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const prefixListMatch = line.text.match(/^ip\s+prefix-list\s+(\S+)\s+seq\s+(\d+)/);
            if (prefixListMatch) {
                const [, listName, sequenceNum] = prefixListMatch;
                const key = `${listName}-${sequenceNum}`;
                if (!prefixListSequences.has(key)) {
                    prefixListSequences.set(key, []);
                }
                prefixListSequences.get(key).push(i);
            }
        }
        // Add diagnostics for prefix-list duplicates
        prefixListSequences.forEach((lines, key) => {
            if (lines.length > 1) {
                const [listName, sequenceNum] = key.split('-');
                lines.forEach(lineNum => {
                    const line = document.lineAt(lineNum);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNum, 0, lineNum, line.text.length), `Duplicate prefix-list sequence: ${listName} sequence ${sequenceNum} (also on lines ${lines.filter(l => l !== lineNum).map(l => l + 1).join(', ')})`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });
        // Find ASA access-list duplicates
        const asaAccessListLines = new Map();
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const asaAclMatch = line.text.match(/^access-list\s+(\S+)\s+line\s+(\d+)/);
            if (asaAclMatch) {
                const [, listName, lineNum] = asaAclMatch;
                const key = `${listName}-${lineNum}`;
                if (!asaAccessListLines.has(key)) {
                    asaAccessListLines.set(key, []);
                }
                asaAccessListLines.get(key).push(i);
            }
        }
        // Add diagnostics for ASA access-list duplicates
        asaAccessListLines.forEach((lines, key) => {
            if (lines.length > 1) {
                const [listName, lineNum] = key.split('-');
                lines.forEach(lineNumber => {
                    const line = document.lineAt(lineNumber);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNumber, 0, lineNumber, line.text.length), `Duplicate ASA access-list line: ${listName} line ${lineNum} (also on lines ${lines.filter(l => l !== lineNumber).map(l => l + 1).join(', ')})`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });
        // Advanced ACL Analysis
        this.analyzeACLSecurity(document, diagnostics);
        this.analyzeACLRedundancy(document, diagnostics);
        this.addImplicitDenyReminders(document, diagnostics);
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    analyzeACLSecurity(document, diagnostics) {
        let currentACL = '';
        let aclStartLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // Check for ACL declaration
            const aclMatch = lineText.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (aclMatch) {
                currentACL = aclMatch[1];
                aclStartLine = i;
                continue;
            }
            // Reset current ACL if we hit a different configuration block
            if (lineText.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                currentACL = '';
                continue;
            }
            // Analyze ACL entries for security risks
            if (currentACL && lineText.trim()) {
                // Check for overly permissive rules
                if (lineText.match(/^\s*\d+\s+permit\s+(?:ip\s+)?any\s+any/i)) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(i, 0, i, lineText.length), `Security Risk: Overly permissive rule 'permit any any' in ACL '${currentACL}' - consider restricting source/destination`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                }
                // Check for deny any any above other rules (unreachable code)
                if (lineText.match(/^\s*\d+\s+deny\s+(?:ip\s+)?any\s+any/i)) {
                    // Check if there are more ACL entries after this deny any any
                    let hasSubsequentRules = false;
                    for (let j = i + 1; j < document.lineCount; j++) {
                        const nextLine = document.lineAt(j);
                        const nextLineText = nextLine.text;
                        // Break if we hit a new config block
                        if (nextLineText.match(/^(?:route-map|interface|class-map|policy-map|(?:ip\s+)?access-list)/)) {
                            break;
                        }
                        // Check if there's a subsequent ACL entry
                        if (nextLineText.match(/^\s*\d+\s+(?:permit|deny)/)) {
                            hasSubsequentRules = true;
                            break;
                        }
                    }
                    if (hasSubsequentRules) {
                        const diagnostic = new vscode.Diagnostic(new vscode.Range(i, 0, i, lineText.length), `Unreachable Code: 'deny any any' makes subsequent ACL rules unreachable in '${currentACL}'`, vscode.DiagnosticSeverity.Error);
                        diagnostic.source = 'cisco-highlighter';
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }
    analyzeACLRedundancy(document, diagnostics) {
        let currentACL = '';
        const aclEntries = new Map();
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // Check for ACL declaration
            const aclMatch = lineText.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (aclMatch) {
                currentACL = aclMatch[1];
                if (!aclEntries.has(currentACL)) {
                    aclEntries.set(currentACL, []);
                }
                continue;
            }
            // Reset current ACL if we hit a different configuration block
            if (lineText.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                currentACL = '';
                continue;
            }
            // Collect ACL entries for redundancy analysis
            if (currentACL && lineText.trim()) {
                const entryMatch = lineText.match(/^\s*\d+\s+(permit|deny\s+.+)/);
                if (entryMatch) {
                    // Normalize the entry for comparison (remove sequence number and extra whitespace)
                    const normalizedEntry = entryMatch[1].replace(/\s+/g, ' ').toLowerCase();
                    const entries = aclEntries.get(currentACL);
                    entries.push({ line: i, entry: normalizedEntry });
                }
            }
        }
        // Check for redundant entries within each ACL
        aclEntries.forEach((entries, aclName) => {
            const seenEntries = new Map();
            entries.forEach(({ line, entry }) => {
                if (!seenEntries.has(entry)) {
                    seenEntries.set(entry, []);
                }
                seenEntries.get(entry).push(line);
            });
            // Flag redundant entries
            seenEntries.forEach((lines, entry) => {
                if (lines.length > 1) {
                    lines.forEach(lineNum => {
                        const line = document.lineAt(lineNum);
                        const otherLines = lines.filter(l => l !== lineNum).map(l => l + 1);
                        const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNum, 0, lineNum, line.text.length), `Redundant Entry: Identical rule already exists in ACL '${aclName}' on line${otherLines.length > 1 ? 's' : ''} ${otherLines.join(', ')}`, vscode.DiagnosticSeverity.Warning);
                        diagnostic.source = 'cisco-highlighter';
                        diagnostics.push(diagnostic);
                    });
                }
            });
        });
    }
    addImplicitDenyReminders(document, diagnostics) {
        let currentACL = '';
        let lastACLLine = -1;
        let hasExplicitDenyAll = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // Check for ACL declaration
            const aclMatch = lineText.match(/^(?:ip\s+)?access-list\s+(?:standard\s+|extended\s+)?(\S+)/);
            if (aclMatch) {
                // Add reminder for previous ACL if needed
                if (currentACL && lastACLLine >= 0 && !hasExplicitDenyAll) {
                    this.addImplicitDenyReminder(document, diagnostics, currentACL, lastACLLine);
                }
                currentACL = aclMatch[1];
                lastACLLine = -1;
                hasExplicitDenyAll = false;
                continue;
            }
            // Check if we're leaving an ACL context
            if (lineText.match(/^(?:route-map|interface|class-map|policy-map)/)) {
                // Add reminder for current ACL if needed
                if (currentACL && lastACLLine >= 0 && !hasExplicitDenyAll) {
                    this.addImplicitDenyReminder(document, diagnostics, currentACL, lastACLLine);
                }
                currentACL = '';
                continue;
            }
            // Track ACL entries
            if (currentACL && lineText.trim()) {
                const entryMatch = lineText.match(/^\s*\d+\s+(permit|deny)/);
                if (entryMatch) {
                    lastACLLine = i;
                    // Check for explicit deny any any
                    if (lineText.match(/^\s*\d+\s+deny\s+(?:ip\s+)?any\s+any/i)) {
                        hasExplicitDenyAll = true;
                    }
                }
            }
        }
        // Handle the last ACL in the document
        if (currentACL && lastACLLine >= 0 && !hasExplicitDenyAll) {
            this.addImplicitDenyReminder(document, diagnostics, currentACL, lastACLLine);
        }
    }
    addImplicitDenyReminder(document, diagnostics, aclName, lastLine) {
        const line = document.lineAt(lastLine);
        const diagnostic = new vscode.Diagnostic(new vscode.Range(lastLine, line.text.length, lastLine, line.text.length), `Info: ACL '${aclName}' has implicit 'deny any any' at the end. Traffic not matching any rule will be dropped.`, vscode.DiagnosticSeverity.Information);
        diagnostic.source = 'cisco-highlighter';
        diagnostics.push(diagnostic);
    }
}
//# sourceMappingURL=extension.js.map