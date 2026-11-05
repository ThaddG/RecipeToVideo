'use client';
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {VideoRequestError} from '../lib/video-jobs';
import {imageModels,type ImageModel} from '../lib/generation-settings';
import type {Recipe} from '../lib/recipe';
import {frameSignature,providedFrame,validGeneratedFrame,type StoryboardFrame} from '../lib/storyboard';
import {compactFrame,imageDataURL,loadFrame,saveFrame} from '../lib/frame-cache';
export function useStoryboard({recipe,format,style,useImages,projectId,apiKey,frames,setFrames,onError,onSelect,imageModel='nano',beforeCreate,onPersistFrames,transport=fetch}:{imageModel?:ImageModel;beforeCreate?:(id:string,usd:number)=>void;onPersistFrames?:(frames:StoryboardFrame[])=>void;transport?:typeof fetch;recipe:Recipe;format:string;style:string;useImages:boolean;projectId:string;apiKey:string;frames:StoryboardFrame[];setFrames:Dispatch<SetStateAction<StoryboardFrame[]>>;onError:(message:string)=>void;onSelect:(index:number)=>void}){
 const [generating,setGenerating]=useState(false),[urls,setURLs]=useState<Record<string,string>>({}),[broken,setBroken]=useState<Record<number,string>>({});
 const records=useRef(frames),run=useRef(0),cancel=useRef(false);records.current=frames;
 const scope=JSON.stringify([projectId,recipe,format,style,useImages]),scopeRef=useRef(scope);scopeRef.current=scope;
 useEffect(()=>{setGenerating(false);return()=>{run.current++;cancel.current=true;};},[scope]);
 const keys=JSON.stringify(frames.map(f=>f?.imageKey||''));
 useEffect(()=>{let live=true;const created:string[]=[];const next:Record<string,string>={};Promise.all(JSON.parse(keys).filter(Boolean).map(async(key:string)=>{try{const blob=await loadFrame(key);if(blob&&live){const uri=URL.createObjectURL(blob);created.push(uri);next[key]=uri;}}catch{}})).then(()=>{if(live)setURLs(next);});return()=>{live=false;created.forEach(u=>URL.revokeObjectURL(u));};},[keys]);
 const sources=recipe.steps.map((_,i)=>{const f=frames[i],signature=frameSignature(recipe,i,format,style,f?.prompt);const image=validGeneratedFrame(f,signature)?urls[f.imageKey!]||f.imageURL:providedFrame(recipe,i,useImages);return image&&broken[i]!==image?image:undefined;});
 const missing=sources.flatMap((image,i)=>image?[]:[i]),pending=frames.flatMap((f,i)=>['PENDING','RUNNING','THROTTLED','SUBMITTING','SUBMISSION_UNKNOWN'].includes(f?.status||'')?[i]:[]);
 const signature=JSON.stringify([scope,frames.map(f=>[f?.imageKey,f?.signature,f?.prompt,f?.motion,f?.endImageURL,f?.endTaskSignature]),sources.map((s,i)=>!!s&&broken[i]!==s)]);
 async function api(body:object,media=false):Promise<any>{const response=await transport('/api/storyboard',{method:'POST',headers:{'Content-Type':'application/json','x-runway-key':apiKey},body:JSON.stringify(body)});if(!response.ok){const data:any=await response.json();throw new VideoRequestError(typeof data.error==='string'?data.error:JSON.stringify(data.error),response.status);}return media?response.blob():response.json();}
 async function input(index:number):Promise<string>{
  const frame=records.current[index];
  if(validGeneratedFrame(frame,frameSignature(recipe,index,format,style,frame?.prompt))){
   let blob:Blob|undefined;try{blob=await loadFrame(frame.imageKey!);}catch{}
   if(!blob){if(!frame.taskId)throw new Error('This frame is missing. Regenerate it before creating video.');blob=await compactFrame(await api({action:'media',id:frame.taskId},true));try{await saveFrame(frame.imageKey!,blob);}catch{}}
   return imageDataURL(blob);
  }
  const source=providedFrame(recipe,index,useImages);if(!source)throw new Error(`Scene ${index+1} needs a storyboard image.`);return source;
 }
 function update(index:number,change:Partial<StoryboardFrame>,expectedScope:string){if(scopeRef.current!==expectedScope)return;const next=[...records.current];next[index]={...next[index],...change};onPersistFrames?.(next);records.current=next;setFrames(next);}
 async function generate(indices:number[],force=false){
  const id=++run.current,expectedScope=scopeRef.current;cancel.current=false;setGenerating(true);onError('');
  const active=()=>run.current===id&&scopeRef.current===expectedScope&&!cancel.current;
  try{
   for(const index of indices){
    if(!active())break;onSelect(index);let frame=records.current[index]||{};const taskSignature=frameSignature(recipe,index,format,style,frame.prompt);
    const resume=frame.taskId&&frame.taskSignature===taskSignature&&!['FAILED','CANCELLED','DELETED','SUBMITTING','SUBMISSION_UNKNOWN','NOT_SUBMITTED'].includes(frame.status||'')&&!(force&&frame.status==='SUCCEEDED');
    if(!resume){
     if(['SUBMITTING','SUBMISSION_UNKNOWN'].includes(frame.status||''))throw new Error(`Image ${index+1} has an unconfirmed request. Check Runway task history and link its task ID before paying again.`);
     let previousFrame:string|undefined,anchorFrame:string|undefined,previousFramePhase:'start'|'end'='start';
     if(index>0){try{previousFrame=await endInput(index-1);if(previousFrame)previousFramePhase='end';else previousFrame=await input(index-1);}catch{try{previousFrame=await input(index-1);}catch{}}}
     try{const anchor=records.current[0];if(anchor?.anchorKey){const blob=await loadFrame(anchor.anchorKey);anchorFrame=blob?await imageDataURL(blob):anchor.anchorURL;}else if(index>0)anchorFrame=await input(0);}catch{}
     if(!active())break;
     const submissionId=crypto.randomUUID();beforeCreate?.(submissionId,imageModels[imageModel].usd);
     update(index,{taskId:undefined,status:'SUBMITTING',error:undefined},expectedScope);
     let result;
     try{result=await api({action:'create',recipe,index,format,style,useImages,prompt:frame.prompt,previousFrame,previousFramePhase,anchorFrame,imageModel});}
     catch(error){const rejected=error instanceof VideoRequestError&&[400,401,402,403,413,415,422,429].includes(error.status);update(index,{taskId:undefined,status:rejected?'NOT_SUBMITTED':'SUBMISSION_UNKNOWN',error:rejected?'Provider rejected this request.':'Check provider history before retrying this image.'},expectedScope);throw error;}

     if(!result.id)throw new Error('Runway did not return an image task ID.');
     frame={...frame,model:imageModel,taskId:result.id,taskSignature,status:'PENDING',error:undefined};update(index,frame,expectedScope);
    }
    const started=Date.now();
    while(active()){
     const result=await api({action:'status',id:frame.taskId});if(!active())break;
     update(index,{status:result.status,error:undefined},expectedScope);
     if(['FAILED','CANCELLED','DELETED'].includes(result.status))throw new Error(result.failure||`Image ${index+1} failed. Retry this scene to generate another frame.`);
     if(result.status==='SUCCEEDED'){
      const blob=await compactFrame(await api({action:'media',id:frame.taskId},true));
      if(!active())break;const imageKey=`${projectId}/${index}/${frame.taskId}`;
      try{await saveFrame(imageKey,blob);}catch{onError('The image was generated, but device storage is unavailable. Keep this tab open and download the frame before leaving.');}
      update(index,{imageKey,imageURL:result.output?.[0],...(index===0?{anchorKey:records.current[0]?.anchorKey||imageKey,anchorURL:records.current[0]?.anchorURL||result.output?.[0]}:{}),signature:taskSignature,status:'SUCCEEDED',error:undefined},expectedScope);
      break;
     }
     if(Date.now()-started>10*60*1000)throw new Error('The image is still processing. Resume later to check the same task without paying again.');
     await new Promise(resolve=>setTimeout(resolve,4000));
    }
   }
  }catch(error){if(scopeRef.current===expectedScope)onError(error instanceof Error?error.message:'Storyboard generation failed.');}
  finally{if(run.current===id)setGenerating(false);}
 }
 async function endInput(index:number):Promise<string|undefined>{const f=records.current[index];if(f?.endImageKey&&f.endTaskSignature!==frameSignature(recipe,index,format,style)+'/end')throw new Error(`Shot ${index+1} ending frame is stale. Regenerate it or remove it before creating video.`);if(!f?.endImageURL&&!f?.endImageKey)return;const blob=f.endImageKey?await loadFrame(f.endImageKey):undefined;return blob?imageDataURL(blob):f.endImageURL;}
 async function generateEnd(index:number){
  const id=++run.current,expectedScope=scopeRef.current;cancel.current=false;setGenerating(true);onError('');onSelect(index);
  const active=()=>run.current===id&&scopeRef.current===expectedScope&&!cancel.current;
  try{
   if(!recipe.steps[index]?.shot)throw new Error('Plan this shot and its ending state before generating an ending frame.');
   let f=records.current[index]||{};const signature=frameSignature(recipe,index,format,style)+'/end';
   if(['SUBMITTING','SUBMISSION_UNKNOWN'].includes(f.endStatus||''))throw new Error('This ending frame has an unconfirmed request. Recover its task ID before retrying.');
   if(!f.endTaskId||f.endTaskSignature!==signature||['FAILED','CANCELLED','DELETED','NOT_SUBMITTED','SUCCEEDED'].includes(f.endStatus||'')){
    const previousFrame=await input(index),anchorFrame=index>0?await input(0):undefined;
    if(!active())return;beforeCreate?.(crypto.randomUUID(),imageModels[imageModel].usd);update(index,{endTaskId:undefined,endStatus:'SUBMITTING'},expectedScope);
    let result;try{result=await api({action:'create',recipe,index,format,style,useImages,previousFrame,anchorFrame,imageModel,phase:'end'});}catch(error){const rejected=error instanceof VideoRequestError&&[400,401,402,403,413,415,422,429].includes(error.status);update(index,{endStatus:rejected?'NOT_SUBMITTED':'SUBMISSION_UNKNOWN'},expectedScope);throw error;}
    if(!result.id)throw new Error('No ending image task ID was returned. Check provider history.');
    f={...f,endTaskId:result.id,endTaskSignature:signature,endStatus:'PENDING'};update(index,f,expectedScope);
   }
   const started=Date.now();while(active()){
    const result=await api({action:'status',id:f.endTaskId});if(!active())return;update(index,{endStatus:result.status},expectedScope);
    if(['FAILED','CANCELLED','DELETED'].includes(result.status))throw new Error('The ending frame failed. Its task ID is kept.');
    if(result.status==='SUCCEEDED'){const blob=await compactFrame(await api({action:'media',id:f.endTaskId},true));if(!active())return;const key=`${projectId}/${index}/${f.endTaskId}/end`;await saveFrame(key,blob);update(index,{endImageKey:key,endImageURL:result.output?.[0],endStatus:'SUCCEEDED'},expectedScope);break;}
    if(Date.now()-started>10*60*1000)throw new Error('The ending frame is still processing. Resume to check the same task.');await new Promise(r=>setTimeout(r,4000));
   }
  }catch(e){onError(e instanceof Error?e.message:'Ending frame failed.');}finally{if(run.current===id)setGenerating(false);}
 }
 return {sources,missing,pending,signature,generating,generateEnd,endInput,ready:missing.length===0&&pending.length===0&&!frames.some(f=>['PENDING','RUNNING','THROTTLED','SUBMITTING','SUBMISSION_UNKNOWN'].includes(f?.endStatus||'')),generate,input,pause:()=>{cancel.current=true;},markBroken:(index:number,uri:string)=>setBroken(old=>({...old,[index]:uri})),generated:(i:number)=>validGeneratedFrame(frames[i],frameSignature(recipe,i,format,style,frames[i]?.prompt))};
}
