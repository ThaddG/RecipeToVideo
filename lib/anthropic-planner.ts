import {PLANNER_MAX_OUTPUT_TOKENS,claudePlanners,type ClaudePlanner} from './planning-config';
import {planSchema} from './shot-plan';
export function anthropicPlanningError(status:number,message=''){
 if(status===401)return 'The planning key was not accepted. Add an Anthropic API key in Settings; the Google, image and video keys cannot be used for this planner.';
 if(status===403)return 'The planning account does not have permission for this request. Check the Anthropic key’s workspace and model access.';
 if(status===402||/credit balance|insufficient.*credit|billing/i.test(message))return 'Your Anthropic API account needs credits before it can plan shots. API billing is separate from a chat subscription. Your storyboard has not changed.';
 if(status===429)return 'The planning account has reached a rate or usage limit. Check its API limits before retrying. No automatic retry was made.';
 if(status===404)return 'This planning option is unavailable for your API account. Check model access with the planning provider; your storyboard has not changed.';
 if(status===503||status===529)return 'The planning provider is temporarily unavailable. Your storyboard has not changed. No other service or paid retry was started.';
 return `The planning provider rejected this request (${status}). Your storyboard has not changed. Check its API request history before retrying.`;
}
export function anthropicPlanText(data:any):string{
 if(data?.stop_details?.type==='refusal'||data?.stop_reason==='refusal')throw new Error('The planning provider declined this request. Your storyboard has not changed.');
 if(data?.stop_reason!=='end_turn')throw new Error('The planner did not finish a complete plan. Your storyboard has not changed. Reduce the shot limit before trying again.');
 const output=(Array.isArray(data.content)?data.content:[]).filter((b:any)=>b?.type==='text'&&typeof b.text==='string').map((b:any)=>b.text).join('');
 if(!output.trim())throw new Error('The planner returned no shot plan. Your storyboard has not changed.');
 return output;
}
export async function createAnthropicPlan(key:string,input:string,choice:ClaudePlanner){
 const model=claudePlanners[choice];
 const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`,'anthropic-version':'2026-10-21'},body:JSON.stringify({model:model.model,max_tokens:PLANNER_MAX_OUTPUT_TOKENS,thinking:{type:'adaptive'},output_config:{effort:model.effort,format:{type:'json_schema',schema:planSchema}},messages:[{role:'user',content:input}]}),signal:AbortSignal.timeout(180000)});
 const data:any=await response.json().catch(()=>null);
 if(!response.ok){console.warn('Shot planner request rejected',{planner:choice,status:response.status,requestId:response.headers.get('request-id')});return {ok:false as const,status:response.status,error:anthropicPlanningError(response.status,data?.error?.message||''),retryAfter:response.headers.get('retry-after')};}
 return {ok:true as const,output:anthropicPlanText(data),usage:data.usage,model:model.model};
}
