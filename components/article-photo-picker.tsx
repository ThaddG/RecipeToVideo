'use client';
import type {Recipe,Scene} from '../lib/recipe';
import {photoIdentity} from '../lib/article-photos';
export default function ArticlePhotoPicker({recipe,scene,disabled,onChoose}:{recipe:Recipe;scene:Scene;disabled:boolean;onChoose:(url?:string)=>void}){
 const photos=recipe.photos||[];
 if(!photos.length)return null;
 return <div className="article-photos">
  {scene.imageMatch&&<p className="photo-match"><strong>Suggested article photo</strong><span>{scene.imageMatch}</span>Matched using the publisher’s caption. Check that the cooking stage fits this shot.</p>}
  <details><summary>Choose from {photos.length} article photos</summary><p>Original photos from the recipe page. Choose one for this scene, or leave it for a generated frame.</p><div className="article-photo-grid">{photos.map(photo=><button type="button" key={photo.url} disabled={disabled} aria-pressed={!!scene.image&&photoIdentity(scene.image)===photoIdentity(photo.url)} onClick={()=>onChoose(photo.url)}><img loading="lazy" src={photo.url} alt={photo.alt||photo.caption}/><span>{photo.caption||photo.alt}</span></button>)}</div></details>
  {scene.image&&<button type="button" className="text-button" disabled={disabled} onClick={()=>onChoose()}>Remove step photo</button>}
 </div>;
}
