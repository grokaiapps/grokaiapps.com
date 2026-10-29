export const SCENES=['glacier','midnight','emerald','graphite'];
export class StageThemes{
 constructor(storage,random=Math.random){this.storage=storage;this.random=random;this.choice='auto';this.current='midnight';try{const saved=JSON.parse(storage?.getItem('big-wheel-scene-v1')||'null');if(saved&&(saved.choice==='auto'||SCENES.includes(saved.choice))){this.choice=saved.choice;if(SCENES.includes(saved.current))this.current=saved.current;}}catch{}this.next();}
 save(){try{this.storage?.setItem('big-wheel-scene-v1',JSON.stringify({choice:this.choice,current:this.current}));}catch{}}
 next(){if(this.choice==='auto'){const options=SCENES.filter(x=>x!==this.current);this.current=options[Math.min(options.length-1,Math.floor(this.random()*options.length))];}else this.current=this.choice;this.save();return this.current;}
 select(choice){if(choice!=='auto'&&!SCENES.includes(choice))return;this.choice=choice;this.next();}
}
