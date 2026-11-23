import {createAnthropicPlan} from '../../../lib/anthropic-planner';
import {plannerModel,PLANNER_API_REVISION,PLANNER_MAX_OUTPUT_TOKENS,planningError,interactionText,type InteractionResponse,type PlannerChoice} from '../../../lib/planning-config';
import type {Recipe} from '../../../lib/recipe';
import {applyShotPlan,plannerInput,planSchema} from '../../../lib/shot-plan';
import {validateSceneInput} from '../../../lib/storyboard';
/** Client request body; each field is validated below before use. */
type PlanRequest={recipe:Recipe;maxShots:number;targetSeconds?:number;planner?:PlannerChoice};
export async function POST(request:Request){
 let submitted=false;
 try{
  if(Number(request.headers.get('content-length'))>150000)return Response.json({error:'Recipe is too large.'},{status:413});
  const b=await request.json() as PlanRequest;validateSceneInput(b.recipe,0,'9:16','Overhead');
  if(!Number.isInteger(b.maxShots)||b.maxShots< (b.recipe.production?.originalSteps||b.recipe.steps).length||b.maxShots>30)throw new Error('Choose a shot limit between the number of recipe steps and 30.');
  if(b.targetSeconds!==undefined&&(!Number.isInteger(b.targetSeconds)||b.targetSeconds<2*(b.recipe.production?.originalSteps||b.recipe.steps).length||b.targetSeconds>150))throw new Error('Choose a duration budget with at least 2 seconds per source step, up to 150 seconds.');
  if(b.planner!==undefined&&!['standard','alternative','quality','economy'].includes(b.planner))throw new Error('Choose a supported planner.');
  const choice=b.planner||'quality',anthropic=choice==='quality'||choice==='economy';
  const key=request.headers.get(anthropic?'x-anthropic-key':'x-gemini-key');if(!key||key.length>1000)return Response.json({error:anthropic?'Connect an Anthropic planning API key in Settings to plan shots.':'Connect your Google planning API key for this legacy planner.'},{status:401});
  let model:string,output:string,usage:unknown;
  const input=plannerInput(b.recipe,b.maxShots,b.targetSeconds);
  submitted=true;
  if(anthropic){
   const result=await createAnthropicPlan(key,input,choice);if(!result.ok)return Response.json({error:result.error,code:'PLANNER_REJECTED'},{status:result.status,headers:result.retryAfter?{'Retry-After':result.retryAfter}:undefined});
   model=result.model;output=result.output;usage=result.usage;
  }else{
  model=plannerModel(choice);
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key,'Api-Revision':PLANNER_API_REVISION},body:JSON.stringify({model,input,store:false,generation_config:{max_output_tokens:PLANNER_MAX_OUTPUT_TOKENS,thinking_level:'low'},response_format:{type:'text',mime_type:'application/json',schema:planSchema}}),signal:AbortSignal.timeout(90000)});
  const data=await response.json() as InteractionResponse;if(!response.ok){console.warn('Shot planner request rejected',{planner:b.planner||'standard',status:response.status});return Response.json({error:planningError(data.error?.message||'Shot planning failed. Check planning-service API access and billing.',response.status),code:response.status===503?'PLANNER_UNAVAILABLE':'PLANNER_REJECTED'},{status:response.status});}
  output=interactionText(data);usage=data.usage;
  }
  let plan;try{plan=JSON.parse(output);}catch{throw new Error('The planner returned invalid JSON. Your recipe has not changed.');}
  const recipe=applyShotPlan(b.recipe,plan,b.maxShots,b.targetSeconds);
  return Response.json({recipe,usage,model},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const interrupted=e instanceof TypeError||e instanceof Error&&['TimeoutError','AbortError'].includes(e.name);return Response.json({error:interrupted?'The planning connection was interrupted. Check the selected provider’s request history before retrying; your storyboard has not changed.':e instanceof Error?e.message:'Shot planning failed.'},{status:submitted&&interrupted?502:400});}
}
