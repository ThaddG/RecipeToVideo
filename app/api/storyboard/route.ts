import {imagePrompt,validateImageInput,validateSceneInput} from '../../../lib/storyboard';
const api='https://api.dev.runwayml.com/v1';
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length'))>7_000_000)throw new Error('Storyboard request is too large.');
  const key=request.headers.get('x-runway-key');if(!key||key.length>1000)return Response.json({error:'Connect your Runway API key in Settings to generate storyboard images.'},{status:401});
  const body:any=await request.json(),headers={'Authorization':`Bearer ${key}`,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'};
  let response:Response;
  if(body.action==='create'){
   validateSceneInput(body.recipe,body.index,body.format,body.style);
   const referenceImages:{uri:string;tag:string}[]=[];
   if(body.useImages&&body.recipe.images?.[0])referenceImages.push({uri:validateImageInput(body.recipe.images[0]),tag:'dish'});
   if(body.previousFrame)referenceImages.push({uri:validateImageInput(body.previousFrame),tag:'previous'});
   response=await fetch(`${api}/text_to_image`,{method:'POST',headers,body:JSON.stringify({model:'gen4_image',ratio:body.format==='9:16'?'1080:1920':'1920:1080',promptText:imagePrompt(body.recipe,body.index,body.style,body.prompt,{dish:referenceImages.some(r=>r.tag==='dish'),previous:referenceImages.some(r=>r.tag==='previous')}),...(referenceImages.length?{referenceImages}:{})}),signal:AbortSignal.timeout(30000)});
  }else{
   if(!['status','media'].includes(body.action)||typeof body.id!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(body.id))throw new Error('Invalid storyboard task.');
   response=await fetch(`${api}/tasks/${body.id}`,{headers,signal:AbortSignal.timeout(30000)});
  }
  const data:any=await response.json();if(!response.ok)return Response.json({error:data.error||data.message||`Runway returned ${response.status}. Check your API credits.`},{status:response.status});
  if(body.action==='media'){
   if(data.status!=='SUCCEEDED'||!data.output?.[0])throw new Error('This storyboard image is not ready.');
   const uri=validateImageInput(data.output[0]);const media=await fetch(uri,{signal:AbortSignal.timeout(30000)});if(!media.ok)throw new Error('This image link expired. Regenerate the frame to refresh it.');
   const type=media.headers.get('content-type')?.split(';')[0]||'';if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Runway returned an unsupported image format.');
   const blob=await media.blob();if(blob.size>15_000_000)throw new Error('The generated image is too large.');return new Response(blob,{headers:{'Content-Type':type,'Cache-Control':'no-store'}});
  }
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Storyboard generation failed.'},{status:400});}
}
