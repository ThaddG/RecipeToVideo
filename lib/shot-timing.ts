import type {Recipe} from './recipe';
import type {VideoJob} from './video-jobs';
import type {VideoModel} from './generation-settings';
export const shortDurations=[2,3,4,5] as const;
export function validVideoDuration(model:VideoModel,value:unknown):value is number {
 return typeof value==='number'&&Number.isInteger(value)&&(model==='kling'?[5,10].includes(value):value>=2&&value<=10);
}
// Round only for providers with discrete durations. Never understate billed seconds.
export function providerDuration(model:VideoModel,seconds:number){
 if(!Number.isInteger(seconds)||seconds<2||seconds>10)throw new Error('Choose a scene duration between 2 and 10 seconds.');
 return model==='kling'?(seconds<=5?5:10):seconds;
}
export function shotSeconds(recipe:Recipe,index:number,fallback:number,model:VideoModel,job?:VideoJob){
 if(job?.id&&job.status!=='REJECTED'&&job.duration)return job.duration;
 return providerDuration(model,recipe.steps[index]?.shot?.duration??fallback);
}
export function timelineSeconds(recipe:Recipe,fallback:number,model:VideoModel,jobs:VideoJob[]=[]){
 return recipe.steps.map((_,i)=>shotSeconds(recipe,i,fallback,model,jobs[i]));
}
export function videoEstimate(seconds:number[],indices:number[],perSecond:number){return indices.reduce((sum,i)=>sum+seconds[i]*perSecond,0);}
