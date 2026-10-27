import { scenePrompt, type Recipe } from '../../../lib/recipe';
import { publicURL } from '../../../lib/network';
import {motionPrompt,validateImageInput} from '../../../lib/storyboard';
const api='https://api.dev.runwayml.com/v1';
export async function POST(request: Request) {
 try {
  if (Number(request.headers.get('content-length'))>7_000_000) throw new Error('Request too large.');
  const key=request.headers.get('x-runway-key'); if (!key || key.length>1000) return Response.json({error:'Connect your Runway API key in Settings to generate video.'},{status:401});
  const b:any=await request.json(); const headers={'Authorization':`Bearer ${key}`,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'};
  let response:Response;
  if (b.action==='create') {
   const r=b.recipe as Recipe;
   if (!r || !Array.isArray(r.steps) || r.steps.length>30 || !Array.isArray(r.ingredients) || r.ingredients.some(x=>typeof x!=='string') || typeof r.name!=='string' || !Number.isInteger(b.index) || b.index<0 || b.index>=r.steps.length || typeof r.steps[b.index]?.text!=='string' || !['Cinematic','Overhead','Rustic'].includes(b.style) || !['9:16','16:9'].includes(b.format) || ![5,10].includes(b.duration)) throw new Error('Invalid scene settings.');
   const image=b.storyboardImage?validateImageInput(b.storyboardImage):(b.useImages?r.steps[b.index].image||(b.index===r.steps.length-1?r.images?.[0]:undefined):undefined);
   if(b.storyboardRequired&&!image)throw new Error('Generate and approve a storyboard image for this scene before creating video.');
   if(image)validateImageInput(image);
   response=await fetch(`${api}/${image?'image_to_video':'text_to_video'}`,{method:'POST',headers,body:JSON.stringify({model:'gen4.5',promptText:b.storyboardRequired?motionPrompt(r,b.index,b.motionPrompt):scenePrompt(r,b.index,b.style),ratio:b.format==='9:16'?'720:1280':'1280:720',duration:b.duration,...(image?{promptImage:image}:{})}),signal:AbortSignal.timeout(30000)});
  } else {
   if (!['status','media','cancel'].includes(b.action) || typeof b.id!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(b.id)) throw new Error('Invalid video task.');
   response=await fetch(`${api}/tasks/${b.id}`,{headers,method:b.action==='cancel'?'DELETE':'GET',signal:AbortSignal.timeout(30000)});
   if (b.action==='cancel'&&response.ok) return Response.json({ok:true});
  }
  const data:any=await response.json();
  if (!response.ok) return Response.json({error:data.error||data.message||`Runway returned ${response.status}. Check your API key and credits.`},{status:response.status});
  if(b.action==='media') { const uri=data.output?.[0]; if(data.status!=='SUCCEEDED'||!uri) throw new Error('This scene is not ready to download.'); publicURL(uri); const media=await fetch(uri,{signal:AbortSignal.timeout(60000)});if(!media.ok) throw new Error('The video download expired. Generate the scene again.');return new Response(media.body,{headers:{'Content-Type':'video/mp4','Cache-Control':'no-store'}}); }
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 } catch(e) {return Response.json({error:e instanceof Error?e.message:'Video request failed.'},{status:400});}
}
