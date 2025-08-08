import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
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

export function deactivate() {}

class CiscoHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // Check for route-map duplicates
        const routeMapMatch = lineText.match(/^route-map\s+(\S+)\s+(permit|deny)\s+(\d+)/);
        if (routeMapMatch) {
            const [, mapName, action, sequenceNum] = routeMapMatch;
            const duplicates = this.findRouteMapDuplicates(document, mapName, sequenceNum, position.line);
            
            if (duplicates.length > 0) {
                const lines = duplicates.map(lineNum => `Line ${lineNum + 1}`).join(', ');
                return new vscode.Hover(
                    `⚠️ **Duplicate route-map sequence detected**\n\nRoute-map "${mapName}" sequence ${sequenceNum} is also defined on: ${lines}`,
                    new vscode.Range(position.line, 0, position.line, lineText.length)
                );
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
                    return new vscode.Hover(
                        `⚠️ **Duplicate access-list sequence detected**\n\nAccess-list "${aclContext}" sequence ${sequenceNum} is also defined on: ${lines}`,
                        new vscode.Range(position.line, 0, position.line, lineText.length)
                    );
                }
            }
        }

        return null;
    }

    private findRouteMapDuplicates(
        document: vscode.TextDocument,
        mapName: string,
        sequenceNum: string,
        currentLine: number
    ): number[] {
        const duplicates: number[] = [];
        const regex = new RegExp(`^route-map\\s+${this.escapeRegex(mapName)}\\s+(?:permit|deny)\\s+${sequenceNum}\\b`);
        
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine) continue;
            
            const line = document.lineAt(i);
            if (regex.test(line.text)) {
                duplicates.push(i);
            }
        }
        
        return duplicates;
    }

    private findAccessListContext(document: vscode.TextDocument, lineNum: number): string | null {
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

    private findAccessListDuplicates(
        document: vscode.TextDocument,
        aclName: string,
        sequenceNum: string,
        currentLine: number
    ): number[] {
        const duplicates: number[] = [];
        let inTargetACL = false;
        let currentACLName = '';
        
        for (let i = 0; i < document.lineCount; i++) {
            if (i === currentLine) continue;
            
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

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

class CiscoDiagnosticProvider {
    constructor(private diagnosticCollection: vscode.DiagnosticCollection) {}

    updateDiagnostics(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Find route-map duplicates
        const routeMapSequences = new Map<string, number[]>();
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const routeMapMatch = line.text.match(/^route-map\s+(\S+)\s+(permit|deny)\s+(\d+)/);
            
            if (routeMapMatch) {
                const [, mapName, action, sequenceNum] = routeMapMatch;
                const key = `${mapName}-${sequenceNum}`;
                
                if (!routeMapSequences.has(key)) {
                    routeMapSequences.set(key, []);
                }
                routeMapSequences.get(key)!.push(i);
            }
        }

        // Add diagnostics for route-map duplicates
        routeMapSequences.forEach((lines, key) => {
            if (lines.length > 1) {
                const [mapName, sequenceNum] = key.split('-');
                lines.forEach(lineNum => {
                    const line = document.lineAt(lineNum);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineNum, 0, lineNum, line.text.length),
                        `Duplicate route-map sequence: ${mapName} sequence ${sequenceNum} (also on lines ${lines.filter(l => l !== lineNum).map(l => l + 1).join(', ')})`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });

        // Find access-list duplicates
        const accessListSequences = new Map<string, number[]>();
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
                    accessListSequences.get(key)!.push(i);
                }
            }
        }

        // Add diagnostics for access-list duplicates
        accessListSequences.forEach((lines, key) => {
            if (lines.length > 1) {
                const [aclName, sequenceNum] = key.split('-');
                lines.forEach(lineNum => {
                    const line = document.lineAt(lineNum);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineNum, 0, lineNum, line.text.length),
                        `Duplicate access-list sequence: ${aclName} sequence ${sequenceNum} (also on lines ${lines.filter(l => l !== lineNum).map(l => l + 1).join(', ')})`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'cisco-highlighter';
                    diagnostics.push(diagnostic);
                });
            }
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }
}