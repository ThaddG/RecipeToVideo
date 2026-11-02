import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generationPlan,runVideoJobs,pollWithRetry,VideoRequestError,failureMessage} from '../lib/video-jobs.ts';
const done=id=>({id,status:'SUCCEEDED'});
function harness(initial=[],extras={}){
 const jobs=[...initial],created=[],polled=[],writes=[],waits=[];
 return {jobs,created,polled,writes,waits,options:{count:initial.length,getJob:i=>jobs[i],write:(i,job)=>{writes.push([i,{...job}]);jobs[i]=job;},create:async i=>{created.push(i);return {id:`new-${i}`,status:'PENDING'};},poll:async id=>{polled.push(id);return done(id);},wait:async ms=>{waits.push(ms);},requestId:()=> 'request-test',...extras}};
}
test('resume summary counts running tasks separately from new charges',()=>{
 const p=generationPlan([done('one'),done('two'),{id:'three',status:'RUNNING'},undefined,undefined],5);
 assert.deepEqual(p.completed,[0,1]);assert.deepEqual(p.tracking,[2]);assert.deepEqual(p.fresh,[3,4]);assert.equal(p.newCount,2);
});
test('resume reuses completed and running tasks and only creates unstarted scenes',async()=>{
 const h=harness([done('one'),done('two'),{id:'three',status:'RUNNING'},undefined]);await runVideoJobs(h.options);
 assert.deepEqual(h.created,[3]);assert.deepEqual(h.polled,['three','new-3']);assert.equal(h.jobs[2].status,'SUCCEEDED');
 assert.equal(h.writes.find(([i,j])=>i===3&&j.id==='new-3')[1].status,'PENDING');
});
test('temporary status failures retry the same task without creating a replacement',async()=>{
 let n=0;const h=harness([{id:'existing',status:'RUNNING'}],{poll:async id=>{assert.equal(id,'existing');if(n++<2)throw new VideoRequestError('Temporary outage',503);return done(id);}});await runVideoJobs(h.options);
 assert.deepEqual(h.created,[]);assert.equal(n,3);assert.deepEqual(h.waits,[5000,10000]);
});
test('exhausted network retries retain the task ID for the next resume',async()=>{
 const h=harness([{id:'existing',status:'RUNNING'}],{poll:async()=>{throw new TypeError('Failed to fetch');}});await assert.rejects(runVideoJobs(h.options),/task ID is saved/);assert.equal(h.jobs[0].id,'existing');assert.deepEqual(h.created,[]);
});
test('authentication failures stop immediately without creating a task',async()=>{
 let calls=0;await assert.rejects(pollWithRetry('existing',{poll:async()=>{calls++;throw new VideoRequestError('Invalid key',401);},wait:async()=>assert.fail('should not retry')}),/Invalid key/);assert.equal(calls,1);
});
test('an ambiguous creation is recorded and blocked from automatic paid retry',async()=>{
 const h=harness([undefined],{create:async()=>{throw new TypeError('Connection lost');}});await assert.rejects(runVideoJobs(h.options),/submission could not be confirmed/);assert.equal(h.jobs[0].status,'SUBMISSION_UNKNOWN');
 let calls=0;h.options.create=async()=>{calls++;return done('duplicate');};await assert.rejects(runVideoJobs(h.options),/unconfirmed submission/);assert.equal(calls,0);
});
test('a definite rejected creation remains eligible for an explicitly confirmed retry',async()=>{
 const h=harness([undefined],{create:async()=>{throw new VideoRequestError('Not enough credits',402);}});await assert.rejects(runVideoJobs(h.options),/not submitted/);assert.equal(h.jobs[0].status,'NOT_SUBMITTED');assert.equal(generationPlan(h.jobs,1).newCount,1);
});
test('pausing after submission saves the ID and resuming polls it without another create',async()=>{
 let paused=false;const h=harness([undefined],{paused:()=>paused});const create=h.options.create;h.options.create=async i=>{const job=await create(i);paused=true;return job;};await runVideoJobs(h.options);assert.equal(h.jobs[0].id,'new-0');assert.deepEqual(h.polled,[]);paused=false;await runVideoJobs(h.options);assert.deepEqual(h.created,[0]);assert.deepEqual(h.polled,['new-0']);
});
test('a failed provider task stops with its reason and does not auto-retry in the same run',async()=>{
 const h=harness([done('keep'),{id:'failed',status:'RUNNING'},undefined],{poll:async()=>({id:'failed',status:'FAILED',failure:'Input rejected',failureCode:'ASSET.INVALID'})});await assert.rejects(runVideoJobs(h.options),/Scene 2 failed: Input rejected.*ASSET.INVALID/);assert.deepEqual(h.created,[]);assert.equal(h.jobs[0].id,'keep');assert.deepEqual(generationPlan(h.jobs,3).retry,[1]);
});
test('missing tasks are exposed for review rather than recreated while polling',async()=>{
 const h=harness([{id:'missing',status:'RUNNING'}],{poll:async()=>{throw new VideoRequestError('Task not found',404);}});await assert.rejects(runVideoJobs(h.options),/Check progress/);assert.equal(h.jobs[0].status,'MISSING');assert.equal(h.created.length,0);
});
test('a failed completed-clip download does not stop the next video scene',async()=>{
 const h=harness([{id:'one',status:'RUNNING'},undefined],{onComplete:async()=>{throw new Error('Download unavailable');}});await runVideoJobs(h.options);assert.deepEqual(h.created,[1]);assert.ok(h.jobs.every(j=>j.status==='SUCCEEDED'));
});
test('storage failure before submission prevents spending credits',async()=>{
 let called=false;const h=harness([undefined],{write:()=>{throw new Error('Storage full');},create:async()=>{called=true;return done('new');}});await assert.rejects(runVideoJobs(h.options),/Storage full/);assert.equal(called,false);
});
test('monitoring timeout retains the processing task',async()=>{
 let clock=0;const h=harness([{id:'existing',status:'THROTTLED'}],{now:()=>clock+=2000,timeoutMs:1000,poll:async id=>({id,status:'RUNNING'})});await assert.rejects(runVideoJobs(h.options),/Monitoring paused/);assert.equal(h.jobs[0].status,'RUNNING');assert.equal(h.jobs[0].id,'existing');
});
test('failure details normalize both Error and provider objects',()=>{assert.equal(failureMessage(new Error('Network down')),'Network down');assert.equal(failureMessage({message:'Provider reason'}),'Provider reason');});
