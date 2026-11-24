import {planImagePrompt} from '../../../lib/shot-plan';
import {imageModels} from '../../../lib/generation-settings';
import {imagePrompt,validateImageInput,validateSceneInput} from '../../../lib/storyboard';
import type {Recipe} from '../../../lib/recipe';
const api='https://api.dev.runwayml.com/v1';
/** Client request body; each field is validated below before use. */
type StoryboardRequest={action?:string;id?:unknown;recipe:Recipe;index:number;format:string;style:string;prompt?:string;imageModel?:string;useImages?:boolean;anchorFrame?:unknown;previousFrame?:unknown;previousFramePhase?:string;phase?:string};
type RunwayTask={status?:string;output?:unknown[];error?:unknown;message?:unknown};
export async function POST(request:Request){
 let providerRequestStarted=false;
 try{
  if(Number(request.headers.get('content-length'))>7_000_000)throw new Error('Storyboard request is too large.');
  const key=request.headers.get('x-runway-key');if(!key||key.length>1000)return Response.json({error:'Connect your Runway API key in Settings to generate storyboard images.'},{status:401});
  const body=await request.json() as StoryboardRequest,headers={'Authorization':`Bearer ${key}`,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'};
  let response:Response;
  if(body.action==='create'){
   validateSceneInput(body.recipe,body.index,body.format,body.style);
   const model=body.imageModel||'runway';if(!(model in imageModels))throw new Error('Invalid storyboard image model.');
   const nano=model==='nano';
   const referenceImages:{uri:string;tag:string}[]=[];
   if(body.useImages&&body.recipe.images?.[0])referenceImages.push({uri:validateImageInput(body.recipe.images[0]),tag:'dish'});
   if(body.anchorFrame)referenceImages.push({uri:validateImageInput(body.anchorFrame),tag:'anchor'});
   if(body.previousFrame)referenceImages.push({uri:validateImageInput(body.previousFrame),tag:'previous'});
   if(body.phase&&body.phase!=='end')throw new Error('Invalid image phase.');
   if(body.phase==='end'&&!body.recipe.steps[body.index].shot)throw new Error('Plan an ending state first.');
   let promptText=body.phase==='end'?planImagePrompt(body.recipe,body.index,'end'):imagePrompt(body.recipe,body.index,body.style,body.prompt,{dish:referenceImages.some(r=>r.tag==='dish'),previous:referenceImages.some(r=>r.tag==='previous')});
   const roles=referenceImages.map((r,i)=>`${nano?'Reference '+(i+1):'@'+r.tag}: ${r.tag==='dish'?'finished food appearance only':r.tag==='anchor'?'fixed kitchen, vessel geometry, lighting and tool identity':body.phase==='end'?'current shot START image; depict the planned END state':body.previousFramePhase==='end'?'previous shot END image; its action has completed. Carry that result forward':'previous shot START image, NOT its result. Its action has since completed; update contents and texture to the food-state handoff before staging this shot'}`).join('. ');
   if(roles&&(nano||body.recipe.production||body.anchorFrame))promptText+=' '+roles+'.';
   if(promptText.length>(nano?5500:1000))throw new Error(nano?'Shorten the shot direction.':'This detailed shot requires Nano Banana 2.1, or a shorter custom image direction.');
   providerRequestStarted=true;
   response=await fetch(`${api}/text_to_image`,{method:'POST',headers,body:JSON.stringify({model:nano?'nano_banana_2.1':'gen4_image',ratio:nano?(body.format==='9:16'?'768:1376':'1376:768'):(body.format==='9:16'?'1080:1920':'1920:1080'),promptText,...(nano?{thinkingLevel:'medium'}:{}),...(referenceImages.length?{referenceImages:nano?referenceImages.map(r=>({uri:r.uri})):referenceImages}:{})}),signal:AbortSignal.timeout(30000)});
  }else{
   if(!body.action||!['status','media'].includes(body.action)||typeof body.id!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(body.id))throw new Error('Invalid storyboard task.');
   providerRequestStarted=true;
   response=await fetch(`${api}/tasks/${body.id}`,{headers,signal:AbortSignal.timeout(30000)});
  }
  const data=await response.json() as RunwayTask;if(!response.ok)return Response.json({error:data.error||data.message||`Runway returned ${response.status}. Check your API credits.`},{status:response.status});
  if(body.action==='media'){
   if(data.status!=='SUCCEEDED'||!data.output?.[0])throw new Error('This storyboard image is not ready.');
   const uri=validateImageInput(data.output[0]);const media=await fetch(uri,{signal:AbortSignal.timeout(30000)});if(!media.ok)throw new Error('This image link expired. Regenerate the frame to refresh it.');
   const type=media.headers.get('content-type')?.split(';')[0]||'';if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Runway returned an unsupported image format.');
   const blob=await media.blob();if(blob.size>15_000_000)throw new Error('The generated image is too large.');return new Response(blob,{headers:{'Content-Type':type,'Cache-Control':'no-store'}});
  }
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Storyboard generation failed.'},{status:providerRequestStarted?502:400});}
}
