import {test} from 'node:test';
import assert from 'node:assert/strict';
import {composeMusic,MUSIC_TRACKS,isMusicChoice,musicVolume,createMusicSession} from '../lib/music.ts';
for(const track of MUSIC_TRACKS)test(`${track.name} produces finite, audible, loopable stereo music`,()=>{
 const pcm=composeMusic(track.id,8000);assert.equal(pcm.left.length,pcm.right.length);assert.ok(pcm.duration>15&&pcm.duration<30);
 let sum=0,difference=0,peak=0;
 for(let i=0;i<pcm.left.length;i++){assert.ok(Number.isFinite(pcm.left[i]));peak=Math.max(peak,Math.abs(pcm.left[i]));sum+=pcm.left[i]**2;difference+=Math.abs(pcm.left[i]-pcm.right[i]);}
 assert.ok(Math.sqrt(sum/pcm.left.length)>.025);assert.ok(peak<1);assert.ok(difference>1);assert.equal(Math.abs(pcm.left[0]),0);assert.equal(Math.abs(pcm.left.at(-1)),0);
});
test('compositions are deterministic and each mood has a different arrangement',()=>{
 const first=composeMusic('garden',8000),again=composeMusic('garden',8000),other=composeMusic('morning',8000);assert.deepEqual(first.left,again.left);assert.notDeepEqual(first.left,other.left);
});
test('validates stored choices and bounds the volume',()=>{
 assert.ok(isMusicChoice('none'));assert.ok(isMusicChoice('morning'));assert.equal(isMusicChoice('unknown'),false);assert.equal(musicVolume(-1),0);assert.equal(musicVolume(3),1);assert.equal(musicVolume(NaN),.35);assert.throws(()=>composeMusic('unknown'),/available/);assert.throws(()=>composeMusic('morning',0),/sample rate/);
});
test('explains unavailable browser audio rather than creating a silent session',async()=>{
 await assert.rejects(()=>createMusicSession('morning',.3),/Web Audio support/);
});
