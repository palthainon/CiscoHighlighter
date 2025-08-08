import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CiscoHoverProvider();
    const disposable = vscode.languages.registerHoverProvider('cisco', provider);
    context.subscriptions.push(disposable);
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