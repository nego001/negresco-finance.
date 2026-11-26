import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const levels=['info','low','moderate','high','critical'];
export function summarize(report, exit, lock){
  if (![0,1].includes(exit) || report?.error || report?.auditReportVersion!==2 || !report.vulnerabilities || !report.metadata?.vulnerabilities) throw Error('invalid audit response');
  const count=Object.fromEntries(levels.map(x=>[x,0]));
  const findings=[];
  const packages=lock?.packages;
  if (!packages || !Object.hasOwn(packages,'')) throw Error('lock absent');
  for(const [name,v] of Object.entries(report.vulnerabilities)){
    if(!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)||v?.name!==name||!levels.includes(v.severity)||!Array.isArray(v.nodes)||v.nodes.length===0)throw Error('invalid finding');
    const versions=[...new Set(v.nodes.map(p=>{
      if(typeof p!=='string'||!p.startsWith('node_modules/')||!Object.hasOwn(packages,p)||typeof packages[p].version!=='string')throw Error('finding outside lock');
      return packages[p].version;
    }))].sort();
    count[v.severity]++;
    findings.push({name,severity:v.severity,versions,direct:v.isDirect===true});
  }
  const total=findings.length;
  if(report.metadata.vulnerabilities.total!==total||levels.some(x=>report.metadata.vulnerabilities[x]!==count[x])||(exit===0)!==(total===0))throw Error('audit totals mismatch');
  findings.sort((a,b)=>a.name.localeCompare(b.name));
  return {auditCompleted:true,total,counts:count,findings,highOrCriticalPresent:count.high+count.critical>0,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==5||!['0','1'].includes(process.argv[3]))throw Error('args');
  const raw=readFileSync(process.argv[2]);
  if(raw.length>16*1024*1024)throw Error('report size');
  const result=summarize(JSON.parse(raw),Number(process.argv[3]),JSON.parse(readFileSync(process.argv[4],'utf8')));
  console.log(JSON.stringify(result,null,2));
 }catch{console.error('BLOCK (LAB): audit evidence unavailable or inconsistent');process.exitCode=1}
}
