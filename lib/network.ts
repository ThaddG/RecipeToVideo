export class RecipeFetchError extends Error {
 code: string;
 upstreamStatus?: number;
 constructor(message: string, code: string, upstreamStatus?: number) { super(message); this.name='RecipeFetchError'; this.code=code; this.upstreamStatus=upstreamStatus; }
}
export function publicURL(value: string) { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !u.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) throw new Error('Use a public HTTPS website URL.'); return u; }
function privateIP(ip: string) { if (ip.includes(':')) return !/^2[0-9a-f]{3}:/i.test(ip) && !/^3[0-9a-f]{3}:/i.test(ip); const [a,b] = ip.split('.').map(Number); return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19)); }
export async function publicFetch(value: string, max = 2_000_000): Promise<{text: string;url:string}> {
 let url = publicURL(value);
 for (let hop=0;hop<5;hop++) {
  for (const type of ['A','AAAA']) { const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=${type}`, {headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(10000)}); if (!dns.ok) throw new Error('Unable to verify recipe website.'); const records = await dns.json() as {Answer?:{type:number;data:string}[]}; if (records.Answer?.some(a=>(a.type===1||a.type===28)&&privateIP(a.data))) throw new Error('Only public recipe websites are supported.'); }
  const response = await fetch(url, {redirect:'manual',headers:{accept:'text/html,application/ld+json'},signal:AbortSignal.timeout(15000)});
  if ([301,302,303,307,308].includes(response.status)) { url = publicURL(new URL(response.headers.get('location') || '',url).href); continue; }
  if (!response.ok) { await response.body?.cancel(); if ([401,402,403,429,503].includes(response.status)) throw new RecipeFetchError('This website blocked automatic import. Open it in your browser and use Send to Simmer, or import a saved HTML page.', 'WEBSITE_BLOCKED', response.status); throw new RecipeFetchError(`The recipe website returned ${response.status}. Check the link or import a saved HTML page.`, 'WEBSITE_UNAVAILABLE', response.status); }
  const reader=response.body?.getReader(); if (!reader) throw new Error('The website returned an empty page.'); let size=0; const decoder=new TextDecoder(); let text=''; while(true) {const r=await reader.read();if(r.done) break;size+=r.value.length;if(size>max){await reader.cancel();throw new Error('The recipe page is too large. Paste its Recipe JSON instead.');}text+=decoder.decode(r.value,{stream:true});} return {text:text+decoder.decode(),url:url.href};
 } throw new Error('Too many website redirects. Paste the Recipe JSON instead.');
}
