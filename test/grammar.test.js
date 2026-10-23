const {test, before} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
let grammar;
before(async () => {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({createOnigScanner: patterns => new oniguruma.OnigScanner(patterns), createOnigString: text => new oniguruma.OnigString(text)}),
    loadGrammar: async () => textmate.parseRawGrammar(fs.readFileSync(path.join(__dirname, '../syntaxes/cisco.tmLanguage'), 'utf8'), 'cisco.tmLanguage')
  });
  grammar = await registry.loadGrammar('text.cisco');
});
function lines(text) {
  let state = textmate.INITIAL;
  return text.split(/\r?\n/).map(line => {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    return {line, tokens: result.tokens};
  });
}
function scopesAt(row, needle) {
  const index = row.line.indexOf(needle);
  assert.ok(index >= 0, `Missing text ${needle}`);
  return row.tokens.find(token => token.startIndex <= index && token.endIndex > index).scopes;
}
function has(row, needle, scope) {
  const start=row.line.indexOf(needle); assert.ok(start>=0, needle);
  for(let index=start;index<start+needle.length;index++) {
    const scopes=row.tokens.find(token=>token.startIndex<=index&&token.endIndex>index).scopes;
    assert.ok(scopes.includes(scope), `${row.line}: ${needle} at ${index} expected ${scope}, got ${scopes}`);
  }
}
function absent(row, needle, scope) { assert.ok(!scopesAt(row, needle).some(s => s.startsWith(scope)), `${row.line}: ${needle} unexpectedly got ${scopesAt(row, needle)}`); }
function fixture(name) { return lines(fs.readFileSync(path.join(__dirname, 'fixtures', name + '.cisco'), 'utf8')); }
function find(rows, fragment) { const row=rows.find(r=>r.line.includes(fragment)); assert.ok(row, fragment); return row; }

test('IOS declaration captures precede broad legacy keywords', () => {
  const rows=fixture('ios');
  has(find(rows,'route-map LAB'), 'LAB-EXPORT', 'entity.name.function.cisco');
  has(find(rows,'route-map LAB'), '10', 'constant.numeric.sequence.cisco');
  has(find(rows,'interface Gigabit'), 'GigabitEthernet0/0', 'entity.name.section.interface.cisco');
  has(find(rows,'ip prefix-list'), 'LAB-PREFIX', 'entity.name.function.cisco');
  has(find(rows,'ip access-list'), 'LAB-IN', 'entity.name.function.cisco');
  has(find(rows,'permit tcp'), 'permit', 'constant.character.escape.cisco');
});
test('NX-OS features, VRFs, vPCs and interfaces receive separate scopes', () => {
  const rows=fixture('nxos');
  has(find(rows,'feature vpc'), 'vpc', 'support.function.feature.cisco');
  has(find(rows,'vrf context'), 'KEEPALIVE', 'entity.name.function.cisco');
  has(find(rows,'vpc domain'), '20', 'constant.numeric.cisco');
  has(find(rows,'peer-keepalive'), 'peer-keepalive', 'keyword.other.switching.cisco');
  has(find(rows,'vrf member'), 'vrf member', 'keyword.other.switching.cisco');
  for (const value of ['Eth1/1', 'Po20', 'mgmt0']) has(find(rows, value+' '), value, 'constant.language.interface.cisco');
  has(find(rows,'Eth1/1'), 'up', 'constant.language.status.cisco');
});
test('ASA LINA configuration and connection output receive useful scopes', () => {
  const rows=fixture('asa-lina');
  has(rows[0], 'ASA-LAB/pri/act#', 'punctuation.definition.prompt.cisco');
  has(rows[0], 'show', 'keyword.control.command.cisco');
  has(find(rows,'ASA Version'), 'ASA Version', 'comment.line.metadata.cisco');
  has(find(rows,'object network'), 'LAB-NET', 'entity.name.function.cisco');
  has(find(rows,'object-group service'), 'LAB-WEB', 'entity.name.function.cisco');
  has(find(rows,'nameif inside'), 'inside', 'entity.name.function.cisco');
  has(find(rows,'nat (inside'), 'nat', 'keyword.other.firewall.cisco');
  has(find(rows,'access-group'), 'access-group', 'keyword.other.firewall.cisco');
  has(find(rows,'extended permit'), 'LAB-NET', 'variable.other.object.cisco');
  const conn=find(rows,'TCP outside');
  has(conn,'TCP','storage.type.protocol.cisco');
  has(conn,'192.0.2.40','constant.numeric.ipv4.cisco');
  has(conn,'10.20.0.50','constant.numeric.ipv4.cisco');
  has(conn,'0:01:32','constant.numeric.time.cisco');
  absent(conn,'0:01:32','constant.numeric.ipv6');
});
test('descriptions and remarks protect all text from keyword and address rules', () => {
  for(const text of [' description permit host 192.0.2.1', ' remark deny 2001:db8::1', 'access-list TEST remark permit host 192.0.2.1', 'access-list TEST line 10 remark deny 192.0.2.1']) {
    const row=lines(text)[0];
    for(const token of row.tokens) assert.ok(token.scopes.includes('comment.documentation.cisco'));
  }
});
test('comments and ASA output headers do not interpret keywords', () => {
  for(const text of ['! permit host 192.0.2.1', '  ! permit any', ': Saved permit host']) {
    const row=lines(text)[0];
    has(row, text.trim(), 'comment.line.cisco');
    absent(row, 'permit', 'constant.character.escape');
  }
});
test('custom banner delimiters close single and multiline regions', () => {
  for(const delimiter of ['^C','#','%','$','|','[','.']) {
    const rows=lines(`banner motd ${delimiter}\npermit host 192.0.2.1\n${delimiter}\ninterface Ethernet1/1`);
    has(rows[1],'permit','string.quoted.banner.cisco');
    absent(rows[1],'192.0.2.1','constant.numeric');
    has(rows[3],'Ethernet1/1','entity.name.section.interface.cisco');
    absent(rows[3],'interface','string.quoted.banner');
    const single=lines(`banner login ${delimiter}permit host${delimiter}\ninterface mgmt0`);
    has(single[0],'permit','string.quoted.banner.cisco');
    has(single[1],'mgmt0','entity.name.section.interface.cisco');
  }
});
test('incomplete banner remains opaque through the last line', () => {
  const rows=lines('banner motd ^C\npermit host\ninterface Ethernet1/1');
  has(rows[2],'interface','string.quoted.banner.cisco');
});
test('address rules cover IPv4, compressed IPv6, masks, prefixes and MAC forms', () => {
  for(const address of ['192.0.2.1','255.255.255.0','198.51.100.0/24','0.0.0.0/0']) has(lines(' '+address)[0],address,'constant.numeric.ipv4.cisco');
  for(const address of ['2001:db8::1/64','::1','::/0','2001:db8:1:2:3:4:5:6','fe80::abcd','10:20:30::','::ffff:192.0.2.1','fe80::1']) has(lines(' '+address)[0],address,'constant.numeric.ipv6.cisco');
  for(const address of ['aabb.ccdd.eeff','aa:bb:cc:dd:ee:ff']) has(lines(' '+address)[0],address,'constant.numeric.mac.cisco');
  absent(lines(' 999.0.2.1')[0],'999.0.2.1','constant.numeric.ipv4');
  absent(lines(' 192.0.2.999')[0],'192.0.2.999','constant.numeric.ipv4');
});
test('legacy keyword names do not color substrings in user names', () => {
  for(const name of ['myhost','myobject','myobject-group','mystatic','myaccess-list','mytunnel-group','NOT-any4','OUTSIDE-up']) {
    const row=lines(' '+name)[0];
    for(const token of row.tokens) assert.deepEqual(token.scopes,['text.cisco']);
  }
});
test('show output interface aliases receive the same scope', () => {
  for(const name of ['Ethernet1/1','Eth101/1/1','Gi0/0','Te1/0/1','Po20','mgmt0','Management0/0','Vlan120','Lo0','GigabitEthernet0/0.20']) {
    has(lines(' '+name+' up')[0], name, 'constant.language.interface.cisco');
  }
});

test('typed policy declarations capture the name rather than type or match mode', () => {
  for (const text of ['class-map type inspect match-any LAB-POLICY','class-map type qos match-all LAB-POLICY','policy-map type inspect dns LAB-POLICY','policy-map type network-qos LAB-POLICY','policy-map LAB-POLICY','class-map match-all LAB-POLICY']) {
    has(lines(text)[0], 'LAB-POLICY', 'entity.name.function.cisco');
  }
});

test('ASA line banners do not consume the next configuration line', () => {
  const rows=lines('banner motd Authorized users only\nbanner motd Contact LAB support\ninterface GigabitEthernet0/1');
  has(rows[0],'Authorized users only','string.unquoted.banner.cisco');
  has(rows[1],'Contact LAB support','string.unquoted.banner.cisco');
  has(rows[2],'GigabitEthernet0/1','entity.name.section.interface.cisco');
});
test('IPv6 zone suffix stays distinct from the full address', () => {
  const row=lines(' fe80::1%Ethernet1/1')[0];
  has(row,'fe80::1','constant.numeric.ipv6.cisco');
  has(row,'Ethernet1/1','constant.language.interface.cisco');
});
test('unknown long output lines finish within the tokenizer guard', () => {
  for(const text of ['unknown '+ 'abcd:'.repeat(2000), 'unknown '+ 'q'.repeat(16000)]) {
    const result=grammar.tokenizeLine(text,textmate.INITIAL,1000);
    assert.equal(result.stoppedEarly,false);
    assert.ok(result.tokens.length>0);
  }
});
