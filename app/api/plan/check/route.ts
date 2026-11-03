import {diagnosePlanning,planningDiagnosis} from '../../../../lib/planning-diagnostics';
export async function POST(request:Request){
 const key=request.headers.get('x-gemini-key');if(!key||key.length>1000)return Response.json({error:'Add your Planning service API key in Settings before running diagnostics.'},{status:401});
 const id=crypto.randomUUID();
 const results=await diagnosePlanning(key),diagnosis=planningDiagnosis(results);
 console.info('Planning diagnostics',{id,results});
 return Response.json({id,results,diagnosis},{headers:{'Cache-Control':'no-store'}});
}
