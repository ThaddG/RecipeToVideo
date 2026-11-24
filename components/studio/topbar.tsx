import {ChevronRight, Menu, Settings} from 'lucide-react';

const viewTitles: Record<string, string> = {studio: 'Video studio', examples: 'Examples', process: 'Our process'};

export function Topbar({view, locked, sidebarOpen, status, onOpenSidebar, onToggleView, onSettings}: {
 view: string;
 locked: boolean;
 sidebarOpen: boolean;
 status: string;
 onOpenSidebar: () => void;
 onToggleView: () => void;
 onSettings: () => void;
}) {
 return <header className="topbar">
  <button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={onOpenSidebar}><Menu size={21}/></button>
  <div><button className="breadcrumb-button" disabled={locked} onClick={onToggleView}>Workspace</button> <ChevronRight size={13}/><strong>{viewTitles[view] ?? 'My projects'}</strong></div>
  <span className="draft-status"><span/>{status}</span>
  <button className="icon-button mobile-settings" onClick={onSettings} aria-label="Settings"><Settings size={19}/></button>
 </header>;
}
