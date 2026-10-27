'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Upload, Bookmark, LoaderCircle } from 'lucide-react';
import { parseRecipe, type Recipe } from '../lib/recipe';
import { browserImportBookmark, MAX_IMPORT_FILE } from '../lib/browser-import';

export default function RecipeImportOptions({locked, blocked, sourceURL, onImport}:{locked:boolean;blocked:boolean;sourceURL:string;onImport:(recipe:Recipe)=>void}) {
 const bookmark = useRef<HTMLAnchorElement>(null);
 const [reading,setReading]=useState(false), [error,setError]=useState('');
 useEffect(()=>{bookmark.current?.setAttribute('href',browserImportBookmark(window.location.origin));},[]);
 let website: string | undefined;
 try {const u=new URL(sourceURL);if(u.protocol==='https:'&&!u.username&&!u.password)website=u.href;}catch{}
 async function readFile(file?: File) {
  if(!file)return;
  setError('');setReading(true);
  try {
   if(file.size>MAX_IMPORT_FILE)throw new Error('Choose a saved HTML page or Recipe JSON file smaller than 15 MB.');
   const text=await file.text();
   const recipe=parseRecipe(text,website);
   onImport(recipe);
  } catch(e) {setError(e instanceof Error?e.message:'Could not read this recipe file.');}
  finally{setReading(false);}
 }
 return <details className={`browser-import ${blocked?'blocked':''}`} open={blocked||undefined}>
  <summary>{blocked?'This website needs a browser import':'Import from your browser or a saved file'}</summary>
  <div className="browser-import-body">
   <p>Some recipe sites block server requests. Import the recipe from a page you can open normally.</p>
   <div className="browser-import-method"><Bookmark size={17}/><div><strong>Send directly from the recipe page</strong><p>Drag <a ref={bookmark} href="#browser-import" draggable onClick={e=>{e.preventDefault();setError('Drag “Send to Simmer” to your bookmarks bar, then click that bookmark while viewing the recipe website.');}}>Send to Simmer</a> to your browser’s bookmarks bar. Open the recipe, then click the bookmark to bring its ingredients, steps, and photos here.</p><small>The bookmark reads Recipe data only when you click it. It opens Simmer with a local import; no API key is required.</small></div></div>
   {website&&<a className="external-link" href={website} target="_blank" rel="noreferrer">Open your recipe<ArrowUpRight size={13}/></a>}
   <div className="browser-import-method"><Upload size={17}/><div><strong>Or import a saved page</strong><p>Use your browser’s “Save Page As” command and choose HTML. Select that .html file below. Recipe .json files also work.</p><label className={`secondary file-import ${locked||reading?'disabled':''}`}>{reading?<LoaderCircle className="spin" size={14}/>:<Upload size={14}/>}Choose recipe file<input aria-label="Choose recipe HTML or JSON file" type="file" accept=".html,.htm,.json,.jsonld,text/html,application/json,application/ld+json" disabled={locked||reading} onChange={e=>{void readFile(e.target.files?.[0]);e.target.value='';}}/></label><small>Files are read on this device. Original website photo links are preserved.</small></div></div>
   {error&&<p className="file-import-error" role="alert">{error}</p>}
  </div>
 </details>;
}
