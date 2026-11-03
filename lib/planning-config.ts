// Verified against Google's Interactions API documentation on 2026-11-02.
export const PLANNER_MODEL='gemini-3.8-flash';
export const ALTERNATIVE_PLANNER_MODEL='gemini-3.1-flash-lite';
export const claudePlanners={quality:{model:'claude-sonnet-5-5',effort:'high',reservation:.25},economy:{model:'claude-haiku-5-5',effort:'medium',reservation:.02}} as const;
export type ClaudePlanner=keyof typeof claudePlanners;
export type PlannerChoice='standard'|'alternative'|ClaudePlanner;
export function plannerModel(choice:PlannerChoice){return choice==='quality'||choice==='economy'?claudePlanners[choice].model:choice==='alternative'?ALTERNATIVE_PLANNER_MODEL:PLANNER_MODEL;}
// 40,000 input tokens at $0.25/M + 16,384 output tokens at $1.50/M < $0.04.
export function plannerReservation(choice:PlannerChoice){return choice==='quality'||choice==='economy'?claudePlanners[choice].reservation:choice==='alternative'?.04:planningReservationUSD();}
export const PLANNER_API_REVISION='2026-05-20';
export const PLANNER_MAX_OUTPUT_TOKENS=16384;
// 40,000 UTF-8 input bytes (conservative token upper bound) plus the output cap.
// Published rates double on 2027-01-01; reserve conservatively for either period.
export function planningReservationUSD(date=new Date()){return date.getTime()>=Date.UTC(2027,0,1) ? 0.20 : 0.10;}
export function planningError(message:string,status?:number){
 if(status===503||/currently experiencing high demand/i.test(message))return 'The planning service rejected this request because it is unavailable or at capacity. Your storyboard has not changed. If both planning buttons fail, run Planning connection diagnostics below to check small requests through the existing service before retrying the recipe.';
 if(/(?:model.*(?:no longer available|not available|not found|unsupported)|not supported.*model)/i.test(message))return 'The planning service is unavailable for this account. Refresh the app and try again. If this continues, check API access in your planning-service account.';
 return message;
}
export function interactionText(data:any):string{
 if(data?.status!=='completed')throw new Error('The planner did not finish a complete plan. Your recipe has not changed. Reduce the shot limit before trying again.');
 const steps=Array.isArray(data.steps)?data.steps:[];
 const output=steps.filter((s:any)=>s?.type==='model_output').flatMap((s:any)=>Array.isArray(s.content)?s.content:[]).filter((c:any)=>c?.type==='text'&&typeof c.text==='string').map((c:any)=>c.text).join('');
 if(output)return output;
 // Some API revisions expose the aggregate convenience field as well.
 if(typeof data.output_text==='string'&&data.output_text.trim())return data.output_text;
 throw new Error('The planner returned no shot plan. Your recipe has not changed.');
}
