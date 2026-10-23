const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function scan(text){
 const lines=text.split('\n');let result=[];
 class Range{constructor(...args){this.args=args;}}
 class Diagnostic{constructor(range,message,severity){Object.assign(this,{range,message,severity});}}
 const doc={languageId:'cisco',uri:'test',lineCount:lines.length,lineAt:i=>({text:lines[i]})};
 const vscode={Range,Diagnostic,DiagnosticSeverity:{Warning:1,Error:0,Information:2},languages:{registerHoverProvider:()=>({dispose(){}}),createDiagnosticCollection:()=>({set:(uri,value)=>result=value,dispose(){}})},workspace:{textDocuments:[doc],onDidOpenTextDocument:()=>({dispose(){}}),onDidChangeTextDocument:()=>({dispose(){}})}};
 const sandbox={exports:{},require:name=>{assert.equal(name,'vscode');return vscode;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../out/extension.js'),'utf8'),sandbox);
 sandbox.exports.activate({subscriptions:[]});return result;
}
test('all snippet entries are registered',()=>{
 const manifest=require('../package.json');const contribution=manifest.contributes.snippets.find(x=>x.language==='cisco');
 assert.ok(contribution);assert.equal(Object.keys(require('../'+contribution.path)).length,31);
});
for(const [name,text,expected] of [
 ['route-map','route-map TEST-MAP permit 20\nroute-map TEST-MAP deny 20','TEST-MAP sequence 20'],
 ['prefix-list','ip prefix-list TEST-LIST seq 30 permit 192.0.2.0/24\nip prefix-list TEST-LIST seq 30 deny 198.51.100.0/24','TEST-LIST sequence 30'],
 ['IOS ACL','ip access-list extended TEST-ACL\n 40 permit tcp any any eq 443\n 40 deny tcp any any eq 80','TEST-ACL sequence 40'],
 ['ASA ACL','access-list TEST-ACL line 50 extended permit tcp any any eq 443\naccess-list TEST-ACL line 50 extended deny tcp any any eq 80','TEST-ACL line 50']
]) test(name+' keeps full name and sequence',()=>{
 const diagnostics=scan(text).filter(x=>x.message.startsWith('Duplicate'));
 assert.equal(diagnostics.length,2);assert.ok(diagnostics.every(x=>x.message.includes(expected)));
});
test('different permit and deny rules have no redundancy warning',()=>{
 assert.equal(scan('ip access-list extended REVIEW\n 10 permit tcp any any eq 443\n 20 permit tcp any any eq 80\n 30 deny tcp any any eq 22\n 40 deny tcp any any eq 23').filter(x=>x.message.startsWith('Redundant')).length,0);
});
test('identical rules normalize spaces and ignore sequence',()=>{
 assert.equal(scan('ip access-list extended REVIEW\n 10 permit tcp any any eq 443\n 20 permit   tcp any any eq 443  ').filter(x=>x.message.startsWith('Redundant')).length,2);
});
test('ASA identical rules reach the redundancy parser',()=>{
 assert.equal(scan('access-list REVIEW line 10 extended permit tcp any any eq 443\naccess-list REVIEW line 20 extended permit tcp any any eq 443').filter(x=>x.message.startsWith('Redundant')).length,2);
});
test('object names retain case during comparison',()=>{
 assert.equal(scan('ip access-list extended REVIEW\n 10 permit ip object-group Team-A any\n 20 permit ip object-group team-a any').filter(x=>x.message.startsWith('Redundant')).length,0);
});
