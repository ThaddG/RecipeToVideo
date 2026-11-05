import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e}}});
const {shotChoiceReady}=await import('../lib/studio-workflow.ts');
const {sampleRecipe}=await import('../lib/recipe.ts');
test('fresh imports with source photos require a planning choice before paid images or approval',()=>{
 assert.equal(shotChoiceReady(sampleRecipe),false);
 assert.equal(shotChoiceReady(sampleRecipe,[{prompt:'User is editing directions'}]),false);
 assert.equal(shotChoiceReady({...sampleRecipe,storyboardApproach:'original'}),true);
 assert.equal(shotChoiceReady({...sampleRecipe,production:{version:1}}),true);
});
test('saved image and video work remains resumable, while explicitly returning to planning requires a new choice',()=>{
 for(const frame of [{imageKey:'saved-frame'},{taskId:'running-image'},{status:'SUBMISSION_UNKNOWN'}])assert.equal(shotChoiceReady(sampleRecipe,[frame]),true);
 assert.equal(shotChoiceReady(sampleRecipe,[],[{id:'saved-video',status:'PENDING'}]),true);
 assert.equal(shotChoiceReady({...sampleRecipe,storyboardApproach:'choose'},[{imageKey:'saved-frame'}]),false);
});
