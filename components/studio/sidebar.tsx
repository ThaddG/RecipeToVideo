import {ArrowUpRight, BookOpen, ChefHat, Clapperboard, Film, FolderOpen, Leaf, Plus, Settings, X} from 'lucide-react';

export type StudioView = 'studio' | 'projects' | 'examples' | 'process';

export function Sidebar({open, view, locked, projectCount, connected, onClose, onView, onNew, onGuide, onSettings}: {
 open: boolean;
 view: string;
 locked: boolean;
 projectCount: number;
 connected: boolean;
 onClose: () => void;
 onView: (view: StudioView) => void;
 onNew: () => void;
 onGuide: () => void;
 onSettings: () => void;
}) {
 return <>
  <button className={`sidebar-overlay ${open ? 'visible' : ''}`} aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={onClose}/>
  <aside className={`sidebar ${open ? 'is-open' : ''}`} onClick={onClose}>
   <button className="sidebar-close icon-button" aria-label="Close menu" onClick={onClose}><X size={19}/></button>
   {/* A full page load on the brand link is intentional: it resets the studio. */}
   {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
   <a className="brand" href="/" aria-label="Simmer home"><span className="brandmark"><ChefHat size={24}/></span><span>simmer<span className="brand-dot">.</span></span></a>
   <div className="workspace-label">YOUR CREATIVE KITCHEN</div>
   <nav>
    <button className={view === 'studio' ? 'nav active' : 'nav'} onClick={() => onView('studio')}><Clapperboard size={19}/>Video studio</button>
    <button className={view === 'projects' ? 'nav active' : 'nav'} disabled={locked} onClick={() => onView('projects')}><FolderOpen size={19}/>My projects<span className="count">{projectCount}</span></button>
    <button className={view === 'examples' ? 'nav active' : 'nav'} disabled={locked} onClick={() => onView('examples')}><BookOpen size={19}/>Examples</button>
    <button className={view === 'process' ? 'nav active' : 'nav'} onClick={() => onView('process')}><Film size={19}/>Our process</button>
   </nav>
   <button className="new-project" disabled={locked} onClick={onNew}><Plus size={17}/>New project</button>
   <div className="sidebar-bottom">
    <div className="little-note"><span className="note-icon"><Leaf size={20}/></span><strong>Good food. Great stories.</strong><p>A recipe is just the beginning.<br/>Make something worth sharing.</p></div>
    <button className="nav" onClick={onGuide}><BookOpen size={18}/>A little guidance<ArrowUpRight size={15}/></button>
    <button className="nav" onClick={onSettings}><Settings size={18}/>Settings<span className={`connection ${connected ? 'connected' : ''}`}/></button>
    <div className="profile"><span className="avatar">S</span><div><strong>Your workspace</strong><small>Personal recipe studio</small></div></div>
   </div>
  </aside>
 </>;
}
