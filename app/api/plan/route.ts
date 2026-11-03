import {plannerModel,PLANNER_API_REVISION,PLANNER_MAX_OUTPUT_TOKENS,planningError,interactionText} from '../../../lib/planning-config';
import {applyShotPlan,plannerInput,planSchema} from '../../../lib/shot-plan';
import {validateSceneInput} from '../../../lib/storyboard';
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length'))>150000)return Response.json({error:'Recipe is too large.'},{status:413});
  const key=request.headers.get('x-gemini-key');if(!key||key.length>1000)return Response.json({error:'Connect a Gemini API key in Settings to plan shots.'},{status:401});
  const b:any=await request.json();validateSceneInput(b.recipe,0,'9:16','Overhead');
  if(!Number.isInteger(b.maxShots)||b.maxShots< (b.recipe.production?.originalSteps||b.recipe.steps).length||b.maxShots>30)throw new Error('Choose a shot limit between the number of recipe steps and 30.');
  if(b.targetSeconds!==undefined&&(!Number.isInteger(b.targetSeconds)||b.targetSeconds<2*(b.recipe.production?.originalSteps||b.recipe.steps).length||b.targetSeconds>150))throw new Error('Choose a duration budget with at least 2 seconds per source step, up to 150 seconds.');
  if(b.planner!==undefined&&!['standard','alternative'].includes(b.planner))throw new Error('Choose a supported planner.');
  const model=plannerModel(b.planner||'standard');
  const input=plannerInput(b.recipe,b.maxShots,b.targetSeconds);
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key,'Api-Revision':PLANNER_API_REVISION},body:JSON.stringify({model,input,store:false,generation_config:{max_output_tokens:PLANNER_MAX_OUTPUT_TOKENS,thinking_level:'low'},response_format:{type:'text',mime_type:'application/json',schema:planSchema}}),signal:AbortSignal.timeout(90000)});
  const data:any=await response.json();if(!response.ok){console.warn('Shot planner request rejected',{planner:b.planner||'standard',status:response.status});return Response.json({error:planningError(data.error?.message||'Shot planning failed. Check planning-service API access and billing.',response.status),code:response.status===503?'PLANNER_UNAVAILABLE':'PLANNER_REJECTED'},{status:response.status});}
  const output=interactionText(data);
  let plan;try{plan=JSON.parse(output);}catch{throw new Error('The planner returned invalid JSON. Your recipe has not changed.');}
  const recipe=applyShotPlan(b.recipe,plan,b.maxShots,b.targetSeconds);
  return Response.json({recipe,usage:data.usage,model},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Shot planning failed.'},{status:400});}
}
