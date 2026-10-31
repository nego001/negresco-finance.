import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const script=`
import sys
sys.path.insert(0,"tooling/android")
from guardiao_pdf_debug_metro_lab import classify_boot_nodes
def node(text="",desc=""):
    return [{"text":text, "content-desc":desc}]
cases=(
    ("Preparando proteção", "local-lock-loading"),
    ("Proteção indisponível", "local-lock-error"),
    ("Acesso protegido", "local-lock-protected"),
    ("Unable to load script", "js-bundle-load-error"),
    ("Unable to connect to development server", "js-dev-server-error"),
    ("Welcome to Expo", "expo-development-screen"),
    ("React Native DevTools", "react-native-debug-screen"),
    ("JavaScript Error", "react-native-error-screen"),
)
for label, category in cases:
    assert classify_boot_nodes(node(label))==category
    assert classify_boot_nodes(node(desc=label))==category
assert classify_boot_nodes(node("Synthetic boleto 800000"))=="no-recognized-boot-label"
assert classify_boot_nodes([])=="no-recognized-boot-label"
print("PASS: fixed synthetic boot categories without UI output")
`;

test('Android Debug boot classifier identifies fixed development, JS and lock categories only',()=>{
  const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
  assert.equal(p.status,0,p.stderr);
  assert.equal(p.stdout.trim(),'PASS: fixed synthetic boot categories without UI output');
});
test('boot diagnosis never emits XML, text, screenshots, native errors or private labels',()=>{
  assert.match(source,/def classify_boot_nodes\(nodes: list\[dict\[str, str\]\]\) -> str:/);
  assert.match(source,/return "no-recognized-boot-label"/);
  assert.match(source,/category = classify_boot_nodes\(base\.xml_nodes\(\)\)/);
  assert.match(source,/diagnose_private_debug_home\(\)/);
  assert.match(source,/ENV \(LAB\): Android Debug startup category /);
  assert.doesNotMatch(source,/logcat|screencap|print\(.*(?:html|uri|xml|exception|digest|FIXTURE)/i);
  const diagnostics=source.slice(source.indexOf('BOOT_DIAGNOSTIC_LABELS = ('),source.indexOf('def run() -> None:'));
  assert.doesNotMatch(diagnostics,/print\(.*(?:text|labels|nodes|node\[)/i);
});
