const vscode=require('vscode');const assert=require('node:assert/strict');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('DerickL.CiscoHighlighter');assert.ok(extension);await extension.activate();
 assert.equal(extension.packageJSON.displayName,'Cisco IOS Highlighter — Lawson Cyber LLC');assert.equal(extension.packageJSON.license,'MIT');
 const content='ip access-list extended TEST-ACL\n 10 permit tcp any any eq 443\n 20 permit tcp any any eq 80\nroute-map TEST-MAP permit 30\nroute-map TEST-MAP deny 30';
 const document=await vscode.workspace.openTextDocument({language:'cisco',content});const editor=await vscode.window.showTextDocument(document);
 const diagnostics=vscode.languages.getDiagnostics(document.uri);assert.ok(diagnostics.some(x=>x.message.includes('TEST-MAP sequence 30')));assert.ok(!diagnostics.some(x=>x.message.startsWith('Redundant')));
 const snippet=extension.packageJSON.contributes.snippets.find(x=>x.language==='cisco');assert.ok(snippet);
 await editor.edit(edit=>edit.insert(new vscode.Position(document.lineCount-1,document.lineAt(document.lineCount-1).text.length),'\n'));
 editor.selection=new vscode.Selection(document.lineCount-1,0,document.lineCount-1,0);
 await vscode.commands.executeCommand('editor.action.insertSnippet',{langId:'cisco',name:Object.keys(require('../snipplets/cisco.json'))[0]});
 assert.notEqual(document.getText(),content+'\n');
 console.log('Highlighter editor checks passed: activation, branding, MIT, duplicate diagnostics, distinct rules, registered snippet insertion.');
};
