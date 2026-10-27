import type { Recipe } from './recipe';
export async function exportVideo(blobs: Blob[], recipe: Recipe, format: string, captions: boolean, onProgress:(n:number)=>void):Promise<Blob> {
 if(typeof MediaRecorder==='undefined') throw new Error('Video export requires a browser with MediaRecorder support, such as Chrome.');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw new Error('Your browser does not support video export. Try Chrome.');
 const canvas=document.createElement('canvas');canvas.width=format==='9:16'?720:1280;canvas.height=format==='9:16'?1280:720;
 const ctx=canvas.getContext('2d')!;const stream=canvas.captureStream(30);const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5_000_000});const parts:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};let resolveStop:()=>void;const stopped=new Promise<void>(resolve=>{resolveStop=resolve;});recorder.onstop=()=>resolveStop();
 const urls:string[]=[];let frame=0;let video:HTMLVideoElement|undefined;
 try {
  ctx.fillStyle='#192e26';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let i=0;i<blobs.length;i++) {
   video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';const uri=URL.createObjectURL(blobs[i]);urls.push(uri);video.src=uri;const v=video;
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('A video scene could not be loaded.')),30000);v.onloadeddata=()=>{clearTimeout(timer);resolve();};v.onerror=()=>{clearTimeout(timer);reject(new Error('A scene could not be decoded.'));};});
   const draw=()=>{const scale=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight);ctx.drawImage(v,(canvas.width-v.videoWidth*scale)/2,(canvas.height-v.videoHeight*scale)/2,v.videoWidth*scale,v.videoHeight*scale);if(captions){const y=canvas.height-165;ctx.fillStyle='rgba(14,27,22,.82)';ctx.fillRect(0,y-20,canvas.width,185);ctx.fillStyle='#c4d5a5';ctx.font='18px sans-serif';ctx.fillText(`SIMMER  /  STEP ${i+1}`,40,y+12);ctx.fillStyle='white';ctx.font='26px sans-serif';const words=recipe.steps[i].text.split(/\s+/);const lines:string[]=[];let line='';for(const word of words){if(ctx.measureText(line+' '+word).width>canvas.width-80&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);const pages=Math.ceil(lines.length/3);const page=Math.min(pages-1,Math.floor((v.currentTime/(v.duration||5))*pages));lines.slice(page*3,page*3+3).forEach((l,j)=>ctx.fillText(l,40,y+52+j*32));}onProgress((i+v.currentTime/(v.duration||5))/blobs.length);frame=requestAnimationFrame(draw);};
   await v.play();if(recorder.state==='inactive')recorder.start(1000);else if(recorder.state==='paused')recorder.resume();draw();await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Export stalled. Keep this tab visible and try again.')), Math.max(30000,(v.duration+15)*1000));v.onended=()=>{clearTimeout(timer);resolve();};v.onerror=()=>{clearTimeout(timer);reject(new Error('Playback failed during export.'));};});cancelAnimationFrame(frame);recorder.pause();
  }
  recorder.stop();await stopped;return new Blob(parts,{type:mime});
 } finally {cancelAnimationFrame(frame);video?.pause();if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(t=>t.stop());urls.forEach(u=>URL.revokeObjectURL(u));}
}
