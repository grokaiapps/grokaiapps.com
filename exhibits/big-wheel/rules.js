export const VALUES=[100,15,80,35,60,20,40,75,55,95,50,85,30,65,10,45,70,25,90,5];
export const money=n=>n===100?'$1.00':n>100?'$'+(n/100).toFixed(2):n+'¢';
export const bonus=n=>n===100?25000:(n===5||n===15)?10000:0;
export const landed=position=>VALUES[((-Math.round(position)%20)+20)%20];
export class Showdown {
 constructor(count=1){this.players=Array.from({length:count},(_,i)=>({name:count===1?'You':'Player '+(i+1),spins:[],total:0,cash:0,earned:false,bonusDone:false,tie:0}));this.index=0;this.stage='normal';this.action='spin';this.message='Get as close to $1.00 as you can without going over.';this.queue=[];this.winner=null;this.bonusTie=false;}
 get player(){return this.players[this.index];}
 get leader(){return Math.max(0,...this.players.slice(0,this.index).map(p=>p.total<=100?p.total:0));}
 award(p){if(!p.earned){p.earned=true;p.cash+=1000;}}
 spin(value,full=true){if(this.action!=='spin'&&this.action!=='choice')return;const p=this.player;
  if(!full){if(this.stage==='bonus'){p.bonusDone=true;p.tie=0;this.message='Less than one revolution. The bonus is forfeited.'+(this.bonusTie?' Spin again for the tie-break only.':'');this.action=this.bonusTie?'spin':'next';}else{this.message='One full revolution, please! Spin again.';}return;}
  if(this.stage==='bonus'){const prize=p.bonusDone?0:bonus(value);p.cash+=prize;p.bonusDone=true;p.tie=value;this.message=prize?'Bonus! '+p.name+' won $'+prize.toLocaleString()+'.':'The spin landed on '+money(value)+'.';this.action='next';return;}
  if(this.stage==='tie'){p.tie=value;if(value===100)this.award(p);this.message=p.name+' spun '+money(value)+' in the spin-off.';this.action='next';return;}
  p.spins.push(value);p.total+=value;
  if(p.total>100){this.message=money(p.total)+' — over a dollar. You’re out of this round.';this.action='next';}
  else if(p.total===100){this.award(p);this.message='One dollar! $1,000 and a bonus spin!';this.action='next';}
  else if(p.spins.length===2||(this.index===2&&this.leader===0)){this.message=p.name+' finished with '+money(p.total)+'.';this.action='next';}
  else{this.message='You have '+money(p.total)+'. '+(p.total<this.leader?'You need '+money(this.leader)+' to tie. Spin again.':'Stay, or add one more spin?');this.action=p.total<this.leader?'spin':'choice';}
 }
 stay(){if(this.action==='choice'){this.message=this.player.name+' stays on '+money(this.player.total)+'.';this.action='next';}}
 next(){if(this.action!=='next')return;
  if(this.stage==='normal'&&this.index<this.players.length-1){this.index++;this.action='spin';this.message=this.index===2&&this.leader===0?'The other players went over. You win; take one spin for a dollar!':this.player.name+', come on up!'+(this.leader?' Beat '+money(this.leader)+'.':'');return;}
  if(this.stage==='normal'){const safe=this.players.filter(p=>p.total<=100);this.contenders=safe.filter(p=>p.total===Math.max(...safe.map(p=>p.total)));const eligible=this.players.map((p,i)=>p.earned&&!p.bonusDone?i:-1).filter(i=>i>=0);this.bonusTie=this.contenders.length>1&&this.contenders[0].total===100;if(eligible.length){this.beginQueue('bonus',eligible);return;}this.resolve();return;}
  if(this.queue.length){this.index=this.queue.shift();this.action='spin';this.message=this.stage==='bonus'?'Bonus spin for '+this.player.name+'!':'One spin for '+this.player.name+'.';return;}
  if(this.stage==='bonus'){if(this.bonusTie)this.reduceTie();this.bonusTie=false;this.resolve();return;}
  if(this.stage==='tie'){this.reduceTie();const eligible=this.players.map((p,i)=>p.earned&&!p.bonusDone?i:-1).filter(i=>i>=0);this.bonusTie=this.contenders.length>1&&this.contenders.every(p=>p.tie===100);if(eligible.length){this.beginQueue('bonus',eligible);return;}this.resolve();}
 }
 reduceTie(){const high=Math.max(...this.contenders.map(p=>p.tie));this.contenders=this.contenders.filter(p=>p.tie===high);}
 beginQueue(stage,ids){this.stage=stage;this.queue=[...ids];this.index=this.queue.shift();this.action='spin';this.message=stage==='bonus'?'Bonus spin! Green pays $10,000. The dollar pays $25,000.':'A tie! One spin each. Highest amount wins.';}
 resolve(){if(this.contenders.length>1){this.beginQueue('tie',this.contenders.map(p=>this.players.indexOf(p)));return;}this.winner=this.contenders[0]||null;this.stage='done';this.action='done';this.message=this.players.length===1?(this.player.total>100?'Over a dollar. Give it another spin!':this.player.total===100?'A perfect dollar. What a finish!':'You finished on '+money(this.player.total)+'. Try for a dollar again!'):(this.winner?this.winner.name+' wins the Showcase Showdown!':'Everyone went over. Play again!');}
}
