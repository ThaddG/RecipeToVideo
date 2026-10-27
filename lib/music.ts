/** Original procedural compositions: no samples, recordings, or outside melodies. */
export const MUSIC_TRACKS = [
 {id:'morning',name:'Sunday morning',description:'Warm keys · easygoing',bpm:92},
 {id:'garden',name:'Freshly picked',description:'Bright plucks · light groove',bpm:108},
 {id:'slow',name:'Slow simmer',description:'Soft ambient · unhurried',bpm:72},
] as const;
export type MusicTrack = typeof MUSIC_TRACKS[number]['id'];
export type MusicChoice = MusicTrack | 'none';
export function isMusicChoice(value: unknown): value is MusicChoice {return value==='none'||MUSIC_TRACKS.some(t=>t.id===value);}
export function musicVolume(value: number) {return Number.isFinite(value)?Math.max(0,Math.min(1,value)):.35;}

// Render our own notes and percussion into PCM. This is deliberately independent
// of Web Audio so the compositions and loop boundaries can be tested directly.
export function composeMusic(track: MusicTrack, sampleRate=24000) {
 const spec=MUSIC_TRACKS.find(t=>t.id===track);
 if(!spec)throw new Error('Choose an available background track.');
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000)throw new Error('Unsupported sample rate.');
 const beat=60/spec.bpm, duration=beat*32, length=Math.round(duration*sampleRate);
 const left=new Float32Array(length),right=new Float32Array(length);
 const roots=track==='garden'?[60,65,62,67,60,64,65,67]:track==='slow'?[57,60,53,55,57,53,60,55]:[60,57,65,67,60,64,57,67];
 let seed=track==='morning'?90210:track==='garden'?43827:71773;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 function note(midi:number,start:number,seconds:number,level:number,pan:number,pad=false){
  const freq=440*2**((midi-69)/12),first=Math.round(start*sampleRate),count=Math.round(seconds*sampleRate);
  for(let j=0;j<count;j++){
   const t=j/sampleRate,p=t/seconds,attack=Math.min(1,t/(pad?.18:.008)),release=Math.min(1,(seconds-t)/.08);
   const envelope=attack*release*(pad?Math.sin(Math.PI*p)**.7:Math.exp(-t*(track==='garden'?4.2:2.5)));
   const tone=Math.sin(2*Math.PI*freq*t)+.22*Math.sin(2*Math.PI*freq*2*t)*Math.exp(-t*3)+.08*Math.sin(2*Math.PI*freq*3*t)*Math.exp(-t*5);
   const v=tone*envelope*level,index=(first+j)%length;
   left[index]+=v*Math.sqrt((1-pan)/2);right[index]+=v*Math.sqrt((1+pan)/2);
  }
 }
 const melody=track==='garden'?[7,12,4,9,7,4,12,16]:track==='slow'?[12,7,4,11,7,12,4,7]:[4,7,12,7,9,4,11,7];
 roots.forEach((root,bar)=>{
  const start=bar*beat*4,minor=[57,62,64].includes(root),third=minor?3:4;
  [0,third,7,14].forEach((interval,i)=>note(root+interval,start+i*.018,beat*3.8,track==='slow'?.075:.085,(i-1.5)*.33,track==='slow'));
  note(root-24,start,beat*2.9,.15,0);
  if(track!=='slow')note(root-24,start+beat*2,beat*1.5,.105,0);
  const count=track==='slow'?2:4;
  for(let n=0;n<count;n++)note(root+melody[(bar+n*2)%melody.length],start+beat*(n*(4/count)+.5),beat*(track==='slow'?2:.8),track==='garden'?.11:.075,n%2?.35:-.35);
  if(track!=='slow')for(let eighth=0;eighth<8;eighth++){
   const first=Math.round((start+eighth*beat/2)*sampleRate);
   let previous=0;
   for(let j=0;j<sampleRate*.055;j++){const t=j/sampleRate,white=noise(),v=(white-previous)*Math.exp(-t*85)*(eighth%2?.016:.026);previous=white;const index=(first+j)%length;left[index]+=v*.7;right[index]+=v;}
  }
 });
 // A short edge fade avoids clicks where the loop wraps. The melody itself is
 // written as eight repeating bars, rather than sampled from existing music.
 const edge=Math.round(.012*sampleRate);
 for(let i=0;i<length;i++){const fade=Math.min(1,i/edge,(length-1-i)/edge);left[i]=Math.tanh(left[i]*1.4)*fade;right[i]=Math.tanh(right[i]*1.4)*fade;}
 return {left,right,sampleRate,duration:length/sampleRate};
}

export type MusicSession = {
 stream: MediaStream;
 play: (offset:number,segmentDuration:number,totalDuration:number)=>void;
 pause: ()=>void;
 close: ()=>Promise<void>;
};

/** Call from a user gesture before fetching clips so audio permission is ready. */
export async function createMusicSession(track: MusicTrack, volume: number, monitor=false): Promise<MusicSession> {
 if(typeof AudioContext==='undefined')throw new Error('Music export needs Web Audio support. Try a current Chrome, Edge, or Safari browser.');
 const context=new AudioContext();
 let source:AudioBufferSourceNode|undefined;
 let closed=false;
 try {
  await context.resume();
  if(context.state!=='running')throw new Error('Audio is blocked. Click the music preview once, then try export again.');
  const pcm=composeMusic(track),buffer=context.createBuffer(2,pcm.left.length,pcm.sampleRate);
  buffer.getChannelData(0).set(pcm.left);buffer.getChannelData(1).set(pcm.right);
  const destination=context.createMediaStreamDestination(),gain=context.createGain();
  gain.gain.value=0;gain.connect(destination);if(monitor)gain.connect(context.destination);
  const level=musicVolume(volume);
  const pause=()=>{if(source){source.stop();source.disconnect();source=undefined;}gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);};
  return {
   stream:destination.stream,
   play(offset,segmentDuration,totalDuration){
    if(closed)throw new Error('The music session has ended. Start export again.');
    pause();const now=context.currentTime,fade=Math.min(1,totalDuration/4);
    const envelope=(time:number)=>level*Math.max(0,Math.min(1,time/fade,(totalDuration-time)/fade));
    gain.gain.setValueAtTime(envelope(offset),now);
    for(const point of [fade,totalDuration-fade,totalDuration])if(point>offset&&point<offset+segmentDuration)gain.gain.linearRampToValueAtTime(envelope(point),now+point-offset);
    gain.gain.linearRampToValueAtTime(envelope(offset+segmentDuration),now+segmentDuration);
    source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);source.start(now,offset%buffer.duration);
   },
   pause,
   async close(){if(closed)return;closed=true;pause();destination.stream.getTracks().forEach(t=>t.stop());gain.disconnect();await context.close();},
  };
 } catch(error) {await context.close();throw error;}
}
