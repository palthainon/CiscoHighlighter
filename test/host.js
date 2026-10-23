const vscode=require('vscode');const assert=require('node:assert/strict');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('DerickL.CiscoHighlighter');assert.ok(extension);await extension.activate();
 assert.equal(extension.packageJSON.displayName,'Cisco IOS Highlighter — Lawson Cyber LLC');assert.equal(extension.packageJSON.license,'MIT');
 assert.equal(extension.packageJSON.version,'1.0.7');
 for(const suffix of ['.ios','.cisco','.nxos','.asa']) assert.ok(extension.packageJSON.contributes.languages[0].extensions.includes(suffix));
 const content='ip access-list extended TEST-ACL\n 10 permit tcp any any eq 443\n 20 permit tcp any any eq 80\nroute-map TEST-MAP permit 30\nroute-map TEST-MAP deny 30';
 const document=await vscode.workspace.openTextDocument({language:'cisco',content});const editor=await vscode.window.showTextDocument(document);
 const diagnostics=vscode.languages.getDiagnostics(document.uri);assert.ok(diagnostics.some(x=>x.message.includes('TEST-MAP sequence 30')));assert.ok(!diagnostics.some(x=>x.message.startsWith('Redundant')));
 const snippet=extension.packageJSON.contributes.snippets.find(x=>x.language==='cisco');assert.ok(snippet);
 await editor.edit(edit=>edit.insert(new vscode.Position(document.lineCount-1,document.lineAt(document.lineCount-1).text.length),'\n'));
 editor.selection=new vscode.Selection(document.lineCount-1,0,document.lineCount-1,0);
 await vscode.commands.executeCommand('editor.action.insertSnippet',{langId:'cisco',name:Object.keys(require('../snipplets/cisco.json'))[0]});
 assert.notEqual(document.getText(),content+'\n');
 const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lawson-highlighter-types-'));
 for(const suffix of ['.nxos','.asa']) {const file=path.join(folder,'synthetic'+suffix);fs.writeFileSync(file,'! synthetic language check\n');const opened=await vscode.workspace.openTextDocument(vscode.Uri.file(file));assert.equal(opened.languageId,'cisco');}
 console.log('Highlighter editor checks passed: activation, branding, MIT, duplicate diagnostics, distinct rules, registered snippet insertion.');
};
