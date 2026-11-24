import {ArrowRight, ArrowUpRight, ChefHat, FolderOpen, Plus} from 'lucide-react';
import type {Project} from '../../lib/project';

export function ProjectsView({projects, onNew, onBack, onOpen}: {
 projects: Project[];
 onNew: () => void;
 onBack: () => void;
 onOpen: (project: Project) => void;
}) {
 return <>
  <div className="page-heading">
   <div><div className="eyebrow">YOUR COLLECTION</div><h1>Made in your kitchen.</h1><p>Your saved recipes and video projects, all in one place.</p></div>
   <button className="primary" onClick={onNew}><Plus size={17}/>New project</button>
  </div>
  <div className="project-grid">
   {projects.length === 0
    ? <div className="empty-state"><FolderOpen size={36}/><h2>A fresh start.</h2><p>Save a project from the studio and it will appear here.</p><button className="primary" onClick={onBack}>Back to studio<ArrowRight size={16}/></button></div>
    : projects.map(p => <button key={p.id} className="project-card" onClick={() => onOpen(p)}>
     {p.recipe.images[0] ? <img src={p.recipe.images[0]} alt=""/> : <div className="project-placeholder"><ChefHat size={40}/></div>}
     <div>
      <span className="eyebrow">{p.jobs.filter(j => j?.status === 'SUCCEEDED').length ? 'IN PRODUCTION' : 'DRAFT'}</span>
      <h2>{p.recipe.name}</h2>
      <p>{p.recipe.steps.length} scenes · {p.format} · {new Date(p.updated).toLocaleDateString()}</p>
     </div>
     <ArrowUpRight size={20}/>
    </button>)}
  </div>
 </>;
}
