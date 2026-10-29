import {money} from './rules.js?v=18';
import {roundPayout,roundReturn} from './wallet.js?v=18';
import {cash,signedCash} from './money-feedback.js?v=25';
import {roundView} from './round-flow.js?v=25';

// Explain settled results from the rules and ledger; never award money here.
export function resultView(game,options={}){
 const view=spinResultView(game,options);
 if(options.missedReward==='short')view.detail='Gold-card bonus not earned: complete a full turn to collect it. '+view.detail;
 if(options.missedReward==='bust')view.detail='Gold-card bonus not earned: your total went over $1.00. '+view.detail;
 const p=game.player,r=roundReturn(p,options.fees||0,options.extra||0);
 view.summary=options.noPull?'Pull down, then release while moving.':
  options.missedReward==='short'?'Full turn required · No gold-card bonus.':
  options.missedReward==='bust'?'Over $1.00 · No gold-card bonus.':
  options.full===false?(game.stage==='bonus'?'Bonus forfeited · '+cash(p.cash)+' prize safe.':'Full turn required · Hold longer.'):
  game.stage==='done'?'Highest safe total wins.':
  game.stage==='bonus'?(options.earned>0?'Bonus banked.':cash(p.cash)+' prize safe · No extra charge.'):
  game.stage==='tie'?'Highest tie-break spin wins.':
  p.total>100?'Over $1.00 · $0 score prize'+(options.extra?' · Bonus kept.':'.'):
  p.total===100?'$1,000 awarded · Free bonus spin next.':
  ['choice','spin'].includes(game.action)?(options.arcade?'Cash out: '+signedCash(r.net)+' net · ':'')+'Bust above '+money(100-p.total)+'.':
  options.arcade?cash(r.payout)+' received − '+cash(options.fees||0)+' spent.':'Score locked · Turn complete.';
 return view;
}
function spinResultView(game,{arcade=false,fees=0,extra=0,full=true,value=0,earned=0,refund=0,usedFree=false,cashout=false,noPull=false}={}){
 const p=game.player,r=roundReturn(p,fees,extra);
 const equation=p.spins.map(money).join(' + ')+(p.spins.length>1?' = '+money(p.total):'');
 const next=game.action==='spin'||game.action==='choice'?'Hold, then release to spin.':'Next: '+roundView(game,{arcade,fees,extra}).nextLabel+'.';
 const ledger=cash(r.payout)+' received − '+cash(fees)+' spent = '+signedCash(r.net)+' net.';
 const net=r.net>0?signedCash(r.net)+' profit':r.net<0?cash(-r.net)+' net loss':'$0 net · break-even';
 const base={tone:'neutral',icon:'✓',title:'Spin complete',amount:money(p.total),why:equation,detail:'',next};
 if(noPull)return {...base,tone:'retry',icon:'↻',title:'Give it a stronger pull',amount:'No charge',why:'The wheel needs a forward spin to count.',detail:'Pull down firmly and release while moving.'};
 if(game.stage==='done')return {...base,tone:game.winner?'win':'bust',icon:game.winner?'★':'!',title:game.winner?game.winner.name+' wins!':'Everyone went over',amount:game.winner?money(game.winner.total):'No winner',why:game.winner&&game.winner.tie?'Tie-break: '+money(game.winner.tie)+'. Highest spin wins.':'Highest total at or below $1.00 wins.',detail:'Round complete.',next:'Next: Play again.'};
 if(!full&&game.stage!=='bonus')return {...base,tone:'retry',icon:'↻',title:'Spin too short',amount:refund?cash(refund)+' returned':usedFree?'Free spin restored':'No charge',why:'The wheel stopped before one full turn.',detail:'This spin adds nothing to your score.',next:'Hold longer, then release. Try again.'};
 if(game.stage==='bonus'){
  if(earned>0)return {...base,tone:'jackpot',icon:'★',title:'Bonus jackpot!',amount:signedCash(earned),why:money(value)+' bonus landing → '+cash(earned)+'.',detail:arcade?ledger:cash(p.cash)+' total prize money.',next};
  return {...base,tone:'miss',icon:'↻',title:full?'Bonus missed':'Bonus spin too short',amount:'$0 extra',why:full?'Landed on '+money(value)+'. Only 5¢, 15¢ or $1.00 wins the bonus.':'Less than one full turn forfeits this bonus.',detail:'Your '+cash(p.cash)+' prize is safe. No money was deducted.',next};
 }
 if(game.stage==='tie')return {...base,tone:earned?'win':'neutral',icon:earned?'★':'✓',title:'Tie-break spin',amount:money(value),why:'Highest tie-break spin wins.',detail:earned?'A perfect dollar also earns $1,000.':'This score is separate from your original total.',next};
 if(p.total>100)return {...base,tone:'bust',icon:'!',title:'Bust · over $1.00',amount:arcade?net:'Out this turn',why:equation+'. No score prize.',detail:arcade?(extra?cash(extra)+' bonus kept. ':'')+cash(fees)+' spent on spins. No extra bust charge.':'Your combined spins passed the $1.00 limit.',next};
 if(p.total===100)return {...base,tone:'jackpot',icon:'★',title:'Perfect dollar!',amount:'+$1,000',why:equation+' → $1,000 prize.',detail:arcade?'Banked. '+cash(fees)+' spin costs; '+signedCash(r.net)+' net so far.':'Your dollar score earns a free bonus spin.',next};
 if(game.action==='choice'||game.action==='spin'){
  const collect=roundPayout(p.total);
  return {...base,tone:'score',icon:'✓',title:money(value)+' on the wheel',amount:money(p.total)+' total',why:arcade?'Cash out '+cash(collect)+(extra?' + '+cash(extra)+' bonus already banked':'')+' = '+signedCash(r.net)+' net after spin costs.':equation+'. '+(game.action==='choice'?'Stay or add another spin.':'Reach '+money(game.leader)+' to stay in contention.'),detail:'More than '+money(100-p.total)+' on the next spin means a bust.',next:game.action==='choice'?(arcade?'Choose Cash out or Spin again.':'Choose Keep '+money(p.total)+' or Spin again.'):'Spin again to reach '+money(game.leader)+' or better.'};
 }
 return {...base,tone:arcade?(r.net>0?'win':r.net<0?'loss':'even'):'score',icon:arcade&&r.net>0?'★':r.net<0?'−':'✓',title:cashout?(arcade?'Cashed out':'Score kept'):p.spins.length===2?'Two spins complete':'Score locked',amount:arcade?net:money(p.total)+' final',why:arcade?(p.spins.length>1?equation+'. ':'')+p.total+'¢ × $2 = '+cash(roundPayout(p.total))+' score prize.':equation,detail:arcade?ledger+(extra?' Includes '+cash(extra)+' bonus.':''):'Your score is locked in.',next};
}

export class ResultFeedback{
 constructor(get){this.get=get;this.active=false;}
 show(view){
  const card=this.get('result-card');card.hidden=true;card.setAttribute('data-tone',view.tone);
  for(const key of ['icon','title','amount','why','detail','next','summary'])this.get('result-'+key).textContent=view[key];
  this.get('announcement').setAttribute('data-result','true');
  this.active=true;void card.offsetWidth;this.syncVisibility();
 }
 // A collected reward owns the visible slot until acknowledged. Keep the
 // latest score explanation ready underneath, without moving the wheel.
 syncVisibility(){
  this.get('result-card').hidden=!this.active||!this.get('panel-reward').hidden;
  this.get('announcement').scrollTop=0;
 }
 clear(){this.active=false;this.get('announcement').scrollTop=0;this.get('result-card').hidden=true;this.get('announcement').removeAttribute('data-result');}
}
