#!/usr/bin/env python3
"""Audit exact Hermes bytecode inside a lab APK; NOT module reachability."""
import hashlib,json,re,stat,struct,sys,zipfile
from pathlib import Path
MAGIC=bytes.fromhex('c61fbc03c103191f')
ENTRY='assets/index.android.bundle'
def fail(s): raise ValueError('BLOCK: APK Hermes payload: '+s)
def data(path,limit):
 p=Path(path)
 if p.is_symlink() or not p.is_file() or not 4<=p.stat().st_size<=limit:fail('missing, linked or invalid '+p.name)
 return p.read_bytes()
def sha(b):return hashlib.sha256(b).hexdigest()
def inventory(apk,binary,commit):
 if not re.fullmatch(r'[0-9a-f]{40}',commit):fail('invalid source SHA')
 a=data(apk,1024**3);b=data(binary,12*1024**2)
 try: inv=json.loads(b)
 except (ValueError,UnicodeError):fail('invalid binary inventory')
 if (not isinstance(inv,dict) or inv.get('schemaVersion')!=1 or inv.get('approvedForProduction') is not False
  or inv.get('sourceCommit')!=commit or inv.get('apkSha256')!=sha(a)
  or not isinstance(inv.get('packagedBinaries'),list) or not inv['packagedBinaries']
  or not re.fullmatch(r'[0-9a-f]{64}',str(inv.get('gradleReportSha256')))):
  fail('binary inventory is not bound to APK/source')
 try:
  with zipfile.ZipFile(apk) as z:
   matches=[x for x in z.infolist() if x.filename==ENTRY]
   if len(matches)!=1:fail('expected exactly one canonical Hermes payload')
   info=matches[0]
   if (info.is_dir() or info.flag_bits&1 or stat.S_IFMT(info.external_attr>>16) not in (0,stat.S_IFREG)
     or not 12<=info.file_size<=48*1024**2):fail('unsafe Hermes ZIP entry')
   payload=z.read(info)
 except (OSError,RuntimeError,zipfile.BadZipFile) as e:fail('invalid APK ZIP '+type(e).__name__)
 if len(payload)!=info.file_size or not payload.startswith(MAGIC):fail('not Hermes bytecode')
 version=struct.unpack_from('<I',payload,8)[0]
 if not 40<=version<=255:fail('unexpected Hermes bytecode version')
 return {'schemaVersion':1,'approvedForProduction':False,
 'scope':'LAB HERMES PAYLOAD HASH, NOT JS MODULE REACHABILITY',
 'sourceCommit':commit,'apkSha256':sha(a),'nativeBinaryInventorySha256':sha(b),
 'gradleReportSha256':inv['gradleReportSha256'],
 'jsPayload':{'path':ENTRY,'kind':'hermes-bytecode','hermesBytecodeVersion':version,'sizeBytes':len(payload),'sha256':sha(payload)}}
def execute(mode,apk,binary,commit,out):
 value=(json.dumps(inventory(apk,binary,commit),indent=2)+'\n').encode()
 if mode=='capture':
  if Path(out).exists() or Path(out).is_symlink():fail('refusing to overwrite existing evidence')
  with open(out,'xb') as f:f.write(value)
  print('PASS (LAB): Hermes APK bundle SHA-256 recorded with exact native inventory')
 else:
  if data(out,12*1024**2)!=value:fail('downloaded Hermes evidence or APK differs')
  print('PASS (LAB): independent downloaded Hermes bundle verified byte for byte')
def main(args):
 if len(args)!=5 or args[0] not in ('capture','verify'):
  print('Usage: script.py capture|verify APK NATIVE-JSON SOURCE-SHA OUT-JSON',file=sys.stderr);return 2
 try:execute(*args);return 0
 except (ValueError,OSError) as e:print(str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main(sys.argv[1:]))
