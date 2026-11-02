export const imageModels={nano:{label:'Nano Banana 2.1 · 1K',model:'nano_banana_2.1',credits:4,usd:.04},runway:{label:'Runway Gen-4 Image',model:'gen4_image',credits:8,usd:.08}} as const;
export const videoModels={runway:{label:'Runway Gen-4.5',provider:'runway',perSecond:.12,endFrame:false},minimax:{label:'MiniMax H3 Max Turbo · 768p',provider:'fal',endpoint:'minimax/h3-max-turbo/image-to-video',perSecond:.04,endFrame:true},kling:{label:'Kling 2.5 Turbo Pro',provider:'fal',endpoint:'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',perSecond:.07,endFrame:true}} as const;
export type ImageModel=keyof typeof imageModels;
export type VideoModel=keyof typeof videoModels;
export type SpendEntry={id:string;kind:string;usd:number};
export type GenerationSettings={imageModel:ImageModel;videoModel:VideoModel;limit:number;spent:SpendEntry[]};
export const defaultGenerationSettings=():GenerationSettings=>({imageModel:'nano',videoModel:'runway',limit:10,spent:[]});
export function safeSettings(value?:Partial<GenerationSettings>):GenerationSettings{return {imageModel:value?.imageModel&&value.imageModel in imageModels?value.imageModel:'nano',videoModel:value?.videoModel&&value.videoModel in videoModels?value.videoModel:'runway',limit:typeof value?.limit==='number'&&Number.isFinite(value.limit)&&value.limit>=0?value.limit:10,spent:Array.isArray(value?.spent)?value.spent.filter(x=>typeof x.id==='string'&&typeof x.usd==='number'&&Number.isFinite(x.usd)&&x.usd>=0):[]};}
export function reservedUSD(settings:GenerationSettings){return settings.spent.reduce((sum,x)=>sum+x.usd,0);}
export function reserveSpend(settings:GenerationSettings,entry:SpendEntry):GenerationSettings{
 if(!Number.isFinite(entry.usd)||entry.usd<0)throw new Error('Invalid generation estimate.');
 if(settings.spent.some(x=>x.id===entry.id))return settings;
 if(reservedUSD(settings)+entry.usd>settings.limit+0.000001)throw new Error(`Project spending limit reached. $${reservedUSD(settings).toFixed(2)} reserved of $${settings.limit.toFixed(2)}. Review the limit before starting more paid work.`);
 return {...settings,spent:[...settings.spent,entry]};
}
