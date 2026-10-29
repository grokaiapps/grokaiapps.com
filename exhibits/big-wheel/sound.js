const MONEY_SOUNDS=['fee','refund','cash','loss','even','powerup','jackpot'];
// HTML media playback alongside Web Audio avoids relying on a suspended effects context.
export class GameSound {
 constructor(){this.enabled=false;this.elements=new Map();this.tickIndex=0;for(const name of['welcome','win','bust','stop','again','tick',...MONEY_SOUNDS])this.elements.set(name,Array.from({length:name==='tick'?4:1},()=>{const a=new Audio(new URL('./audio/'+name+'.wav?v=18',import.meta.url).href);a.preload='auto';a.setAttribute('playsinline','');a.volume=name==='tick'?.55:.8;return a;}));}
 async enable(){try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}this.enabled=true;const welcome=this.elements.get('welcome')[0];welcome.muted=false;welcome.currentTime=0;
 // Prime every reusable media element in this explicit user gesture.
 const prime=[];for(const[name,list]of this.elements)if(name!=='welcome')for(const a of list){a.muted=true;const p=a.play();if(p)prime.push(p.then(()=>{a.pause();a.currentTime=0;a.muted=false;}).catch(()=>{a.muted=false;}));}
 const result=welcome.play();try{await Promise.race([result,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Audio startup timeout')),5000))]);return true;}catch{this.enabled=false;return false;}}
 setEnabled(on){this.enabled=on;for(const list of this.elements.values())for(const a of list){a.muted=!on;if(!on)a.pause();}}
 play(name){if(!this.enabled||document.hidden)return;if(name==='welcome')for(const[cue,list]of this.elements)if(cue!==name)for(const a of list)a.pause();if(MONEY_SOUNDS.includes(name)||name==='bust')for(const cue of [...MONEY_SOUNDS,'bust'])if(cue!==name)for(const a of this.elements.get(cue)||[])a.pause();const list=this.elements.get(name);if(!list)return;const a=list[name==='tick'?this.tickIndex++%list.length:0];a.currentTime=0;a.muted=false;const p=a.play();if(p)p.catch(()=>{document.dispatchEvent(new Event('game-audio-blocked'));});}
}
