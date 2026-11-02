import {videoModels,type VideoModel} from './generation-settings';
import {publicURL} from './network';
import {validateImageInput} from './storyboard';
import {failureMessage} from './video-jobs';
export async function falVideo(request:Request,b:any){
 const key=request.headers.get('x-fal-key');if(!key||key.length>1000)return Response.json({error:'Connect your fal API key in Settings for MiniMax or Kling.'},{status:401});
 const model=b.model as VideoModel;if(model!=='minimax'&&model!=='kling')throw new Error('Invalid fal video model.');
 const endpoint=videoModels[model].endpoint,root=`https://queue.fal.run/${endpoint}`;
 const headers={'Authorization':`Key ${key}`,'Content-Type':'application/json','X-Fal-No-Retry':'1'};
 let response:Response;
 if(b.action==='create'){
  if(![5,10].includes(b.duration)||typeof b.motionPrompt!=='string'||!b.motionPrompt.trim()||b.motionPrompt.length>1000)throw new Error('Invalid video duration or motion prompt.');
  const image=validateImageInput(b.storyboardImage),end=b.endFrame?validateImageInput(b.endFrame):undefined;
  const input=model==='minimax'?{prompt:b.motionPrompt,image_url:image,...(end?{end_image_url:end}:{}),duration:b.duration,resolution:'768P',prompt_expansion_mode:'disabled'}:{prompt:b.motionPrompt,image_url:image,...(end?{tail_image_url:end}:{}),duration:String(b.duration)};
  response=await fetch(root,{method:'POST',headers,body:JSON.stringify(input),signal:AbortSignal.timeout(30000)});
  const data:any=await response.json();if(!response.ok)return Response.json({error:failureMessage(data.detail||data.error||'fal rejected this request.')},{status:response.status});
  if(!data.request_id)throw new Error('fal did not return a request ID. Check provider history before retrying.');
  return Response.json({id:data.request_id,status:'PENDING',model,provider:'fal'},{headers:{'Cache-Control':'no-store'}});
 }
 if(!['status','media','cancel'].includes(b.action)||typeof b.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(b.id))throw new Error('Invalid fal request.');
 // Queue routes are reconstructed from our model allowlist, never client-supplied URLs.
 const url=`${root}/requests/${b.id}`;
 if(b.action==='cancel'){response=await fetch(url+'/cancel',{method:'PUT',headers,signal:AbortSignal.timeout(30000)});return Response.json({ok:response.ok},{status:response.ok?200:response.status});}
 response=await fetch(url+'/status',{headers,signal:AbortSignal.timeout(30000)});const status:any=await response.json();
 if(!response.ok)return Response.json({error:failureMessage(status.detail||status.error||'fal task status failed.')},{status:response.status,headers:response.headers.get('retry-after')?{'Retry-After':response.headers.get('retry-after')!}:undefined});
 if(status.status!=='COMPLETED')return Response.json({id:b.id,status:status.status==='IN_PROGRESS'?'RUNNING':'PENDING',model,provider:'fal'});
 const result=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});const data:any=await result.json();
 if(!result.ok||!data.video?.url)return Response.json({id:b.id,status:'FAILED',failure:failureMessage(data.detail||data.error||'The video task completed without a playable result.'),model,provider:'fal'});
 if(b.action==='media'){
  publicURL(data.video.url);const media=await fetch(data.video.url,{signal:AbortSignal.timeout(60000)});
  if(!media.ok)throw new Error('The completed fal clip could not be retrieved. Its request ID is saved.');
  const type=media.headers.get('content-type')||'';if(type&&!type.startsWith('video/')&&!type.startsWith('application/octet-stream'))throw new Error('The provider returned an invalid video file.');
  return new Response(media.body,{headers:{'Content-Type':'video/mp4','Cache-Control':'no-store'}});
 }
 return Response.json({id:b.id,status:'SUCCEEDED',output:[data.video.url],model,provider:'fal'},{headers:{'Cache-Control':'no-store'}});
}
