import {applyShotPlan,plannerInput,planSchema} from '../../../lib/shot-plan';
import {validateSceneInput} from '../../../lib/storyboard';
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length'))>150000)return Response.json({error:'Recipe is too large.'},{status:413});
  const key=request.headers.get('x-gemini-key');if(!key||key.length>1000)return Response.json({error:'Connect a Gemini API key in Settings to plan shots.'},{status:401});
  const b:any=await request.json();validateSceneInput(b.recipe,0,'9:16','Overhead');
  if(!Number.isInteger(b.maxShots)||b.maxShots< (b.recipe.production?.originalSteps||b.recipe.steps).length||b.maxShots>30)throw new Error('Choose a shot limit between the number of recipe steps and 30.');
  const input=plannerInput(b.recipe,b.maxShots);
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:input}]}],generationConfig:{temperature:0.2,maxOutputTokens:16384,thinkingConfig:{thinkingBudget:1024},responseMimeType:'application/json',responseJsonSchema:planSchema}}),signal:AbortSignal.timeout(90000)});
  const data:any=await response.json();if(!response.ok)return Response.json({error:data.error?.message||'Shot planning failed. Check Gemini API access and billing.'},{status:response.status});
  const candidate=data.candidates?.[0];if(candidate?.finishReason!=='STOP')throw new Error('The planner did not finish a complete plan. Your recipe has not changed. Reduce the shot limit before trying again.');
  const output=candidate.content?.parts?.filter((p:any)=>!p.thought).map((p:any)=>p.text||'').join('');
  let plan;try{plan=JSON.parse(output);}catch{throw new Error('The planner returned invalid JSON. Your recipe has not changed.');}
  const recipe=applyShotPlan(b.recipe,plan,b.maxShots);
  return Response.json({recipe,usage:data.usageMetadata,model:'gemini-2.5-flash'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Shot planning failed.'},{status:400});}
}
