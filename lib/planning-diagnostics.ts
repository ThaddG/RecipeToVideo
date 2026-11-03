import {PLANNER_MODEL,ALTERNATIVE_PLANNER_MODEL,PLANNER_API_REVISION} from './planning-config';
export const DIAGNOSTIC_RESERVATION_USD=.01;
export type PlanningProbe={name:string;status:number;code:string;message:string;requestId?:string};
function redact(value:unknown,key:string){return typeof value==='string'?value.split(key).join('[redacted]').replace(/AIza[\w-]+/g,'[redacted]').slice(0,1200):'';}
export function planningDiagnosis(results:PlanningProbe[]){
 if(results.some(r=>[401,403].includes(r.status)))return 'The service reports an authentication or permission problem. Check the API key and project access; these results do not establish an overload.';
 if(results.some(r=>r.status===429))return 'The service reports a rate or quota limit. Check the active limits for the key’s project in AI Studio; free-tier pricing does not guarantee available quota.';
 if(results.length===4&&results.every(r=>r.status===503))return 'Even tiny requests failed with 503 through both Google interfaces. The recipe and shot-plan schema are not required to reproduce this failure. These responses alone cannot distinguish service capacity from account-specific availability; check the project’s active limits and access in AI Studio.';
 if(results[2]?.status===200&&results[0]?.status!==200)return 'The compatibility interface accepted the tiny request while the configured planning interface did not. This points to a difference between the API paths, not a universally unusable key. The full recipe has not been tested through the compatibility interface.';
 if(results[3]?.status===200&&results[0]?.status!==200)return 'The request without the pinned API revision was accepted while the configured request failed. Transient capacity can also cause this difference; compare these results before changing the integration.';
 if(results.some(r=>r.status===200))return 'At least one tiny generation request was accepted. This verifies some inference access, but does not yet prove that the full recipe and structured shot-plan request can complete.';
 return 'No tiny request was accepted. Review the individual service codes below. Connection timeouts are inconclusive; they do not prove a provider rejection.';
}
export async function diagnosePlanning(key:string):Promise<PlanningProbe[]>{
 const base='https://generativelanguage.googleapis.com/v1beta';
 const input='Reply with the word OK.';
 const probes=[
  {name:'Standard planner · configured interface',url:`${base}/interactions`,revision:true,body:{model:PLANNER_MODEL,input,store:false,generation_config:{max_output_tokens:256,thinking_level:'low'}}},
  {name:'Alternative planner · configured interface',url:`${base}/interactions`,revision:true,body:{model:ALTERNATIVE_PLANNER_MODEL,input,store:false,generation_config:{max_output_tokens:256,thinking_level:'low'}}},
  {name:'Standard planner · compatibility interface',url:`${base}/models/${PLANNER_MODEL}:generateContent`,revision:false,body:{contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens:256,thinkingConfig:{thinkingLevel:'low'}}}},
  {name:'Standard planner · unpinned interface',url:`${base}/interactions`,revision:false,body:{model:PLANNER_MODEL,input,store:false,generation_config:{max_output_tokens:256,thinking_level:'low'}}}
 ];
 const results:PlanningProbe[]=[];
 for(const probe of probes){
  try{
   const response=await fetch(probe.url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key,...(probe.revision?{'Api-Revision':PLANNER_API_REVISION}:{})},body:JSON.stringify(probe.body),signal:AbortSignal.timeout(15000)});
   const data:any=await response.json().catch(()=>null),error=data?.error;
   results.push({name:probe.name,status:response.status,code:redact(error?.status||error?.code||(response.ok?'ACCEPTED':'HTTP_ERROR'),key),message:response.ok?'Tiny request accepted; this is not a completed recipe plan.':redact(error?.message||'No structured error details were returned.',key),requestId:redact(response.headers.get('x-request-id')||response.headers.get('x-goog-request-id'),key)||undefined});
   if([401,403,429].includes(response.status))break;
  }catch{results.push({name:probe.name,status:0,code:'CONNECTION_INTERRUPTED',message:'Connection interrupted or timed out. Acceptance could not be confirmed; no automatic retry was made.'});}
 }
 return results;
}
