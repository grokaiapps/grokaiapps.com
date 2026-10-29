// A leaf spring riding the separator pegs. Wheel position still owns scoring.
export function pointerRest(position){
 const offset=position-Math.round(position),t=Math.max(0,Math.min(1,(Math.abs(offset)-.27)/.23));
 return -Math.sign(offset)*.36*t*t*(3-2*t);
}
export function stepPointer(s,position,dt){
 const target=pointerRest(position),steps=Math.max(1,Math.ceil(dt*240)),h=Math.min(dt,.1)/steps;
 for(let i=0;i<steps;i++){s.velocity+=(240*(target-s.bend)-20*s.velocity)*h;s.bend+=s.velocity*h;}
 s.bend=Math.max(-.5,Math.min(.5,s.bend));return Math.abs(s.bend-target)<.0005&&Math.abs(s.velocity)<.002;
}
export class TurnHistory{
 constructor(storage){this.storage=storage;this.rows=[];try{const data=JSON.parse(storage?.getItem('big-wheel-turns-v1')||'[]');if(Array.isArray(data))this.rows=data.filter(x=>x&&typeof x.player==='string'&&x.player.length<30&&Number.isInteger(x.total)&&x.total>=5&&x.total<=200&&Array.isArray(x.spins)&&x.spins.length<=2&&x.spins.every(n=>Number.isInteger(n)&&n>=5&&n<=100)).slice(0,5);}catch{}}
 add(player){this.rows.unshift({player:player.name,total:player.total,spins:[...player.spins]});this.rows=this.rows.slice(0,5);try{this.storage?.setItem('big-wheel-turns-v1',JSON.stringify(this.rows));}catch{}}
}
