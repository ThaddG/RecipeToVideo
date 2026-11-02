export type VideoJob={id:string;status:string;output?:string[];failure?:string;failureCode?:string;requestId?:string;previousTaskIds?:string[];model?:string;provider?:string;review?:string;rejected?:boolean;replacedClips?:VideoJob[]};
export class VideoRequestError extends Error {
 status:number;retryAfter:number;
 constructor(message:string,status=0,retryAfter=0){super(message);this.status=status;this.retryAfter=retryAfter;}
}
export const failedJob=(job:VideoJob|undefined)=>!!job&&['FAILED','CANCELLED','DELETED','MISSING','NOT_SUBMITTED','REJECTED'].includes(job.status);
export const uncertainJob=(job:VideoJob|undefined)=>!!job&&!job.id&&['SUBMITTING','SUBMISSION_UNKNOWN'].includes(job.status);
export function generationPlan(jobs:(VideoJob|undefined)[],count:number){
 const completed:number[]=[],tracking:number[]=[],fresh:number[]=[],retry:number[]=[],uncertain:number[]=[];
 for(let i=0;i<count;i++){const job=jobs[i];if(job?.status==='SUCCEEDED')completed.push(i);else if(uncertainJob(job))uncertain.push(i);else if(failedJob(job))retry.push(i);else if(job?.id)tracking.push(i);else fresh.push(i);}
 return {completed,tracking,fresh,retry,uncertain,newCount:fresh.length+retry.length};
}
export function failureMessage(value:unknown):string {
 if(typeof value==='string')return value;
 if(value&&typeof value==='object'){const v=value as {message?:unknown;error?:unknown};if(typeof v.message==='string')return v.message;if(typeof v.error==='string')return v.error;}
 return 'Runway could not complete this task.';
}
type PollOptions={poll:(id:string)=>Promise<VideoJob>;wait?:(ms:number)=>Promise<void>;paused?:()=>boolean;notice?:(text:string)=>void};
export async function pollWithRetry(id:string,{poll,wait=ms=>new Promise(r=>setTimeout(r,ms)),paused=()=>false,notice=()=>{}}:PollOptions):Promise<VideoJob|undefined>{
 for(let attempt=0;;attempt++){
  if(paused())return;
  try{return await poll(id);}catch(error){
   const status=error instanceof VideoRequestError?error.status:0;
   if(attempt>=3||![0,408,429,500,502,503,504].includes(status))throw error;
   const delay=Math.min(30000,Math.max(5000*2**attempt,error instanceof VideoRequestError?error.retryAfter:0));
   notice(`Connection interrupted. Checking the same provider task again in ${Math.round(delay/1000)} seconds; no new generation is being created.`);
   await wait(delay);
  }
 }
}
type RunOptions={count:number;getJob:(i:number)=>VideoJob|undefined;write:(i:number,job:VideoJob)=>void;create:(i:number,requestId:string)=>Promise<VideoJob>;poll:(id:string)=>Promise<VideoJob>;onSelect?:(i:number)=>void;onComplete?:(i:number,job:VideoJob)=>Promise<void>;notice?:(message:string)=>void;paused?:()=>boolean;wait?:(ms:number)=>Promise<void>;now?:()=>number;timeoutMs?:number;requestId?:()=>string};
export async function runVideoJobs({count,getJob,write,create,poll,onSelect=()=>{},onComplete=async()=>{},notice=()=>{},paused=()=>false,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeoutMs=20*60*1000,requestId=()=>crypto.randomUUID()}:RunOptions){
 for(let i=0;i<count;i++){
  if(paused())return;
  let job=getJob(i);if(job?.status==='SUCCEEDED')continue;
  onSelect(i);
  if(uncertainJob(job))throw new Error(`Scene ${i+1} has an unconfirmed submission. Check the provider’s task history and recover its task ID before retrying; it may already have used credits.`);
  if(!job?.id||failedJob(job)){
   const previousTaskIds=[...(job?.previousTaskIds||[]),...(job?.id?[job.id]:[])];
   const submission:VideoJob={id:'',status:'SUBMITTING',requestId:requestId(),previousTaskIds,...(job?.status==='REJECTED'?{replacedClips:[...(job.replacedClips||[]),{...job,replacedClips:undefined}]}:job?.replacedClips?{replacedClips:job.replacedClips}:{})};
   write(i,submission);
   try{
    const created=await create(i,submission.requestId!);
    if(!created?.id)throw new Error('Runway did not return a task ID.');
    job={...submission,...created,status:created.status||'PENDING'};
   }catch(error){
    const rejected=error instanceof VideoRequestError&&[400,401,402,403,413,415,422,429].includes(error.status);
    write(i,{...submission,status:rejected?'NOT_SUBMITTED':'SUBMISSION_UNKNOWN',failure:failureMessage(error)});
    throw new Error(rejected?`Scene ${i+1} was not submitted: ${failureMessage(error)}`:`Scene ${i+1}: submission could not be confirmed. The provider may still be processing it. Recover the task ID before creating another paid task.`);
   }
   // Save the returned ID before any polling, preview, or next scene.
   write(i,job);
  }
  const started=now();
  while(!paused()){
   let state:VideoJob|undefined;
   try{state=await pollWithRetry(job.id,{poll,wait,paused,notice});}
   catch(error){if(error instanceof VideoRequestError&&error.status===404)write(i,{...job,status:'MISSING',failure:'Runway no longer has this task. Check your account before retrying.'});throw new Error(`Scene ${i+1}: ${failureMessage(error)} Your task ID is saved. Use Check progress to recover its status.`);}
   if(!state)return;
   job={...job,...state,id:job.id};write(i,job);
   if(job.status==='SUCCEEDED'){try{await onComplete(i,job);}catch(error){notice(`Scene ${i+1} completed. Its download needs attention: ${failureMessage(error)}. Other scenes can continue.`);}break;}
   if(failedJob(job))throw new Error(`Scene ${i+1} ${job.status.toLowerCase()}: ${failureMessage(job.failure)}${job.failureCode?` (${job.failureCode})`:''} Completed clips are kept. Review the failed scene before confirming a paid retry.`);
   if(now()-started>timeoutMs)throw new Error(`Scene ${i+1} is still ${job.status.toLowerCase()} at the provider. Monitoring paused; the task may keep running. Resume will check this saved task, without recreating it.`);
   notice(`Scene ${i+1}: ${job.status==='THROTTLED'?'queued at the provider':job.status.toLowerCase()}. Its task ID is saved.`);
   await wait(5000);
  }
 }
}
