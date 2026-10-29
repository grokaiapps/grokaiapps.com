import {money} from './rules.js?v=18';
import {roundReturn} from './wallet.js?v=18';
import {cash,signedCash} from './money-feedback.js?v=25';

// A dollar's free bonus is part of the same round. A multiplayer turn is not a round.
export function isRoundComplete(game){
 return game.action==='done'||(game.players.length===1&&game.action==='next'&&
  (game.stage==='bonus'||(game.stage==='normal'&&game.player.total!==100)));
}
export function roundView(game,{number=1,arcade=false,fees=0,extra=0,freeSpins=0}={}){
 const p=game.player,complete=isRoundComplete(game),ended=game.action==='next';
 const result=roundReturn(p,fees,extra);
 const view={complete,phase:'playing',label:'Round '+number,status:game.stage==='bonus'?'Free bonus':game.stage==='tie'?'Tie-break':p.spins.length?'1 spin left':game.index===2&&game.leader===0?'One spin':'Spin 1 of 2',tone:'neutral',nextAction:'continue',nextLabel:'Continue',nextHelp:'',headline:null,detail:null};
 if(complete){
  view.phase='complete';view.label='Round '+number+' complete';
  view.nextAction='round';view.nextLabel='Play again';
  view.nextHelp='Round '+(number+1)+(arcade&&freeSpins?' · next spin free':' · no charge to start');
  if(arcade){
   view.tone=result.net>0?'profit':result.net<0?'loss':'even';
   view.status=p.total>100?'Over $1.00':result.net>0?'Profit':result.net<0?'Net loss':'Break-even';
   view.headline=result.net>0?signedCash(result.net)+' profit':result.net<0?signedCash(result.net)+' net loss':'Break-even · $0 net';
   view.detail=cash(result.payout)+' received − '+cash(result.fees)+' spent.'+(p.total>100?' No extra charge.':'');
  }else{
   view.tone=game.players.length>1?(game.winner?'profit':'loss'):p.total>100?'loss':p.total===100?'profit':'even';
   view.status=game.players.length>1?'Final result':p.total>100?'Over $1.00':'Final score';
   view.headline=game.players.length>1?(game.winner?game.winner.name+' wins!':'Everyone went over'):p.total>100?'Over $1.00':money(p.total)+' · final score';
   const tiedWinner=game.winner&&game.players.filter(player=>player.total===game.winner.total).length>1;
   view.detail=game.players.length>1?(game.winner?tiedWinner?money(game.winner.total)+' score · '+money(game.winner.tie)+' tie-break.':money(game.winner.total)+' wins the round.':'A fresh round starts everyone at zero.'):'Choose Play again to start a new round.';
  }
 }else if(ended){
  view.phase='turn-complete';view.label='Round '+number;view.status=p.name==='You'?'Score locked':p.name+' finished';
  if(game.stage==='normal'&&game.index<game.players.length-1){
   view.nextAction='player';view.nextLabel='Next: '+game.players[game.index+1].name;view.nextHelp='Pass the device';
  }else if(game.stage==='normal'&&p.total===100&&game.players.length===1){
   view.phase='bonus-ready';view.status='Bonus unlocked';view.tone='profit';
   view.nextAction='bonus';view.nextLabel='Play free bonus';view.nextHelp=arcade?'$1,000 already banked':'$1,000 prize earned';
   view.headline='Perfect $1.00!';view.detail=arcade?'Your $1,000 is banked. One free bonus spin to finish this round.':'You earned $1,000 and a free bonus spin.';
  }else if(game.stage==='normal'&&game.players.some(player=>player.earned&&!player.bonusDone)){
   view.phase='bonus-ready';view.status='Bonus spins next';view.tone='profit';view.nextAction='bonus';
   view.nextLabel='Play free bonus';view.nextHelp='Dollar winners take their bonus spins';
  }else{
   view.nextLabel=game.queue.length?'Next: '+game.players[game.queue[0]].name:'Show round result';
   view.nextHelp=game.queue.length?'Pass the device':'Resolve bonuses and ties';
  }
 }
 return view;
}
