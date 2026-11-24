import {FileJson} from 'lucide-react';
import {ProductionControls} from '../production-controls';
import MusicControls from '../music-controls';
import type {GenerationSettings} from '../../lib/generation-settings';
import type {MusicChoice} from '../../lib/music';

export function VideoSettings({planned, duration, captions, generation, music, volume, locked, onDuration, onToggleCaptions, onGeneration, onMusic, onVolume}: {
 /** The recipe has a shot plan, which sets each shot's length. */
 planned: boolean;
 duration: number;
 captions: boolean;
 generation: GenerationSettings;
 music: MusicChoice;
 volume: number;
 locked: boolean;
 onDuration: (seconds: number) => void;
 onToggleCaptions: () => void;
 onGeneration: (settings: GenerationSettings) => void;
 onMusic: (music: MusicChoice) => void;
 onVolume: (volume: number) => void;
}) {
 return <details className="guided-video-settings">
  <summary>Video settings, music & spending</summary>
  <div className="settings-section">
   <div className="setting-split">
    <label>{planned ? 'Shot lengths' : 'Default scene length'}<select value={planned ? 'planned' : duration} disabled={locked || planned} onChange={e => onDuration(Number(e.target.value))}>{planned ? <option value="planned">Planned per shot · 2–5s</option> : <>{[2, 3, 4, 5, 10].map(n => <option key={n} value={n}>{n} seconds</option>)}</>}</select></label>
   </div>
   <div className="toggle-row"><span><FileJson size={16}/>Step captions on export</span><button role="switch" aria-checked={captions} aria-label="Step captions on export" disabled={locked} className={`toggle ${captions ? 'on' : ''}`} onClick={onToggleCaptions}><span/></button></div>
   {generation.videoModel === 'kling' && <p className="fineprint">The selected video option requires 5- or 10-second clips. Durations and costs include that minimum.</p>}
   <ProductionControls settings={generation} disabled={locked} onChange={onGeneration}/>
   <MusicControls track={music} volume={volume} onTrack={onMusic} onVolume={onVolume} disabled={locked}/>
  </div>
 </details>;
}
