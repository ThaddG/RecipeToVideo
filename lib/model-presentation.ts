import {imageModels,videoModels,type ImageModel,type VideoModel} from './generation-settings';

// Temporary presentation switch. Provider IDs, saved preferences and billing stay intact.
export const SHOW_MODEL_NAMES = false;
export const SHOW_MODEL_CONTROLS = false;
export function modelCopy(named:string,neutral:string){return SHOW_MODEL_NAMES?named:neutral;}
export function imageModelLabel(id:ImageModel){return SHOW_MODEL_NAMES?imageModels[id].label:({nano:'Studio images · 1K',runway:'Alternative images'}[id]);}
export function videoModelLabel(id:VideoModel){return SHOW_MODEL_NAMES?videoModels[id].label:({runway:'Video option A',minimax:'Video option B · 768p',kling:'Video option C'}[id]);}
export function publicGenerationText(value:string){
 if(SHOW_MODEL_NAMES)return value;
 return value
  .replace(/fal-ai\/kling-video\/v2\.5-turbo\/pro(?:\/image-to-video)?/gi,'video option C')
  .replace(/minimax\/h3-max-turbo(?:\/image-to-video)?/gi,'video option B')
  .replace(/nano[_ ]banana[_ ]2\.1|Nano Banana(?: 2\.1)?/gi,'storyboard images')
  .replace(/Gemini(?:[- ]2\.5[- ]Flash)?/gi,'planning service')
  .replace(/Runway Gen[- ]?4(?!\.5)(?: Image)?|gen4_image/gi,'image generation')
  .replace(/(?:Runway )?Gen[- ]?4\.5|gen4\.5/gi,'video option A')
  .replace(/MiniMax(?: H3 Max Turbo)?/gi,'video option B')
  .replace(/Kling(?: 2\.5 Turbo Pro)?/gi,'video option C')
  .replace(/Runway/gi,'generation service');
}
