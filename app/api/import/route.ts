import { parseRecipe } from '../../../lib/recipe';
import { publicFetch, RecipeFetchError } from '../../../lib/network';
export async function POST(request: Request) {
 try {
  if (Number(request.headers.get('content-length')) > 10000) throw new Error('Request too large.');
  const { url } = await request.json() as {url?:unknown};
  if (typeof url !== 'string' || url.length > 2000) throw new Error('Enter a recipe URL.');
  const page = await publicFetch(url);
  const recipe = parseRecipe(page.text, page.url);
  recipe.source = page.url;
  return Response.json({recipe});
 } catch (e) {
  if (e instanceof RecipeFetchError) return Response.json({error:e.message,code:e.code,upstreamStatus:e.upstreamStatus}, {status:422});
  return Response.json({error:e instanceof Error?e.message:'Could not import recipe.',code:'IMPORT_FAILED'}, {status:400});
 }
}
