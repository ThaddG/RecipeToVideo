import {planImagePrompt,foodStateContext} from './shot-plan';
import type {Recipe,Scene} from './recipe';
export type StoryboardFrame={taskId?:string;taskSignature?:string;status?:string;imageKey?:string;imageURL?:string;signature?:string;model?:string;endImageURL?:string;endImageKey?:string;endTaskId?:string;endTaskSignature?:string;endStatus?:string;anchorKey?:string;anchorURL?:string;prompt?:string;motion?:string;error?:string};
export function frameSignature(recipe:Recipe,index:number,format:string,style:string,prompt?:string){const scene=recipe.steps[index];/* Timing does not change a photograph. Keep 5 for compatibility with saved frame signatures. */const visual=scene?.shot?{...scene,shot:{...scene.shot,duration:5}}:scene;return JSON.stringify([recipe.name,recipe.ingredients,visual,recipe.images,...(recipe.production?[recipe.production.bible]:[]),format,style,prompt||'',...(recipe.production?.continuityVersion===2?[foodStateContext(recipe,index)]:[])]);}
export function providedFrame(recipe:Recipe,index:number,useImages:boolean){return useImages?(recipe.steps[index]?.image||(!recipe.production&&index===recipe.steps.length-1?recipe.images[0]:undefined)):undefined;}
export function validGeneratedFrame(frame:StoryboardFrame|undefined,signature:string){return !!frame?.imageKey&&frame.signature===signature;}
export function firstAction(text:string){return text.split(/(?<=[.!?])\s+(?=[A-Z])/u)[0].trim();}
export function splitScene(scene:Scene):Scene[]{const parts=scene.text.split(/(?<=[.!?])\s+(?=[A-Z])/u);const shots:string[]=[];for(const part of parts){if(part.length<45&&shots.length)shots[shots.length-1]+=' '+part;else shots.push(part);}return shots.map((text,i)=>({title:`${scene.title} · Shot ${i+1}`,text,...(i===0&&scene.image?{image:scene.image,...(scene.imageMatch?{imageMatch:scene.imageMatch}:{})}:{})}));}
export function imagePrompt(recipe:Recipe,index:number,style:string,custom?:string,references:{dish?:boolean;previous?:boolean}={dish:!!recipe.images?.length}){
 if(custom?.trim()){if(custom.trim().length>1000)throw new Error('Image prompts must be 1,000 characters or fewer.');return recipe.steps[index].shot?`${planImagePrompt(recipe,index)} Additional image direction: ${custom.trim()}`:custom.trim();}
 if(recipe.steps[index].shot)return planImagePrompt(recipe,index);
 const action=firstAction(recipe.steps[index].text);
 const camera=style==='Overhead'?'Overhead, locked camera.':style==='Rustic'?'Warm rustic kitchen, natural light.':'Natural daylight, realistic cooking photography.';
 let prompt=`Storyboard starting frame for ${recipe.name}. ${camera} Show the correct food and utensil state at the START of this action: ${action} One still moment, before the action completes. Consistent light oak counter, neutral bowls, stainless steel utensils. No text or collage.`;
 if(prompt.length>1000)throw new Error('This scene needs a shorter image description. Split the step into shots or edit its image prompt.');
 const reference=(references.dish?' @dish guides ingredient appearance only; depict this cooking stage, not the finished dish.':'')+(references.previous?' Match the kitchen, lighting, bowls and utensils in @previous.':'');
 if(prompt.length+reference.length<=1000)prompt+=reference;
 const previous=index>0?` Prior step: ${firstAction(recipe.steps[index-1].text)}`:'';
 if(prompt.length+previous.length<=1000)prompt+=previous;
 for(const ingredient of recipe.ingredients){const addition=` Ingredient: ${ingredient}.`;if(prompt.length+addition.length<=1000)prompt+=addition;}
 return prompt;
}
export function motionPrompt(recipe:Recipe,index:number,custom?:string){
 const shot=recipe.steps[index]?.shot;
 const prompt=custom?.trim()||(shot?`${shot.action} ${recipe.production?.bible.camera||'Locked overhead camera'}. The vessel remains stationary and keeps its shape.`:undefined)||`Locked-off camera. Show only this action with slow, physically plausible movement: ${firstAction(recipe.steps[index].text)} Keep the food, utensils, lighting, and kitchen consistent with the starting image. One continuous shot.`;
 if(!prompt||prompt.length>1000)throw new Error('Motion prompts must be 1,000 characters or fewer. Split long instructions into smaller shots.');return prompt;
}
export function validateImageInput(value:unknown):string {
 if(typeof value!=='string'||!value)throw new Error('Choose a valid storyboard image.');
 if(value.startsWith('data:')){if(value.length>5_000_000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error('Use a JPEG, PNG, or WebP storyboard image smaller than 5 MB.');return value;}
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/(^|\.)(local|localhost|internal)$/.test(u.hostname))throw new Error('Use a public HTTPS image URL.');return u.href;
}
export function validateSceneInput(recipe:Recipe,index:number,format:string,style:string){
 if(!recipe||typeof recipe.name!=='string'||recipe.name.length>200||!Array.isArray(recipe.ingredients)||recipe.ingredients.length>200||recipe.ingredients.some(x=>typeof x!=='string')||recipe.ingredients.join('').length>12000||!Array.isArray(recipe.steps)||recipe.steps.length<1||recipe.steps.length>30||!Number.isInteger(index)||!recipe.steps[index]||typeof recipe.steps[index].text!=='string'||!recipe.steps[index].text.trim()||recipe.steps[index].text.length>2000||!['9:16','16:9'].includes(format)||!['Cinematic','Overhead','Rustic'].includes(style))throw new Error('Invalid storyboard scene.');
}
