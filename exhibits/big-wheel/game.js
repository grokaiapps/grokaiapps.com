import {WheelGestureGuard} from './wheel-gesture-guard.js?v=31';
import {ResultFeedback,resultView} from './result-feedback.js?v=30';
import {setupGameMenu} from './games-menu.js?v=2';
import {MoneyJournal,MoneyFeedback,cash,signedCash} from './money-feedback.js?v=25';
import {PayoutFlight} from './payout-flight.js?v=25';
import {StageThemes,SCENES} from './themes.js?v=12';
import {pointerRest,stepPointer,TurnHistory} from './pointer.js?v=11';
import {GameSound} from './sound.js?v=21';
import {Wallet,SPIN_COST,roundPayout,roundReturn} from './wallet.js?v=18';
import {BlackPanelBonuses} from './bonuses.js?v=18';
import {makeWheelRenderer} from './wheel3d.js?v=24';
import {createWheel,grab,moveGrip,release,cancelGrip,step,FIXED_STEP} from './physics.js?v=7';
import {VALUES,money,landed,Showdown} from './rules.js?v=18';
import {isRoundComplete,roundView} from './round-flow.js?v=25';
const $=id=>document.getElementById(id), canvas=$('wheel');
const wheelGestureGuard=new WheelGestureGuard(document.querySelector('.console'));
let game=new Showdown(),position=0,animation=null,drag=null,muted=false,audio=null,master=null,token=0,paused=false,pointerKick=0,rumble=null,noise=null,frameId=0,lastControlEnd=-Infinity,lastWheelPaint=0,rendererLost=false;
const sfx=new GameSound();let storage;try{storage=window.localStorage;}catch{}const wallet=new Wallet(storage);let arcade=true,roundPaid=false,fxTimer=0;
const scenes=new StageThemes(storage),panelBonuses=new BlackPanelBonuses();
let roundFees=0,roundBlackCash=0,roundFreeUsed=0,roundFreeEarned=0,roundStartBalance=wallet.balance;
let roundNumber=1,roundStarting=false,roundIntroTimer=0,panelReward=null,shownRoundPhase='playing';
function applyScene(){(document.documentElement||document.querySelector('.show')).setAttribute('data-scene',scenes.current);for(const name of SCENES)$('scene-'+name).setAttribute('aria-pressed',String(scenes.current===name));$('scene-shuffle').checked=scenes.choice==='auto';}
for(const name of SCENES)$('scene-'+name).onclick=()=>{scenes.select(name);applyScene();};
$('scene-shuffle').onchange=()=>{scenes.select($('scene-shuffle').checked?'auto':scenes.current);applyScene();};applyScene();
const pastTurns=new TurnHistory(storage);let recordedTurns=new WeakSet();const spring={bend:0,velocity:0};let settleFrame=0,settleTime=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const payoutFlight=new PayoutFlight({get:$,position:()=>position,reduced,onArrive(){tone(1568,.15,'sine',0,.05);tone(2093,.22,'sine',.06,.045);}});
const resultFeedback=new ResultFeedback($);
function explainResult(options={}){moneyFeedback.dismiss();resultFeedback.show(resultView(game,{arcade,fees:roundFees,extra:roundBlackCash,...options}));}
const moneyJournal=new MoneyJournal(storage),moneyFeedback=new MoneyFeedback({get:$,reduced,balance:wallet.balance,flight:payoutFlight});
function changeMoney(amount,kind,title,detail){const before=wallet.balance;if(!wallet.change(amount))return false;const event=moneyJournal.record(before,wallet.balance,kind,title,detail);moneyFeedback.event(event,{celebrate:kind==='bonus'||wallet.balance>roundStartBalance,label:kind==='bonus'?(game.stage==='bonus'?'Dollar bonus':'Black-panel bonus'):game.player.total===100?'Perfect dollar':'Score prize'});if(kind==='fee'||kind==='refund')sfx.play(kind);return true;}
function showMoneyActivity(){$('receipt').close();if(animation?.model.held)endGrip(true);$('activity-balance').textContent=cash(wallet.balance);$('activity-free').textContent=wallet.freeSpins+' free '+(wallet.freeSpins===1?'spin':'spins')+' saved';const list=$('money-activity-list');list.textContent='';for(const row of moneyJournal.rows){const item=document.createElement('li'),head=document.createElement('div'),title=document.createElement('b'),delta=document.createElement('strong'),detail=document.createElement('p'),path=document.createElement('small');item.setAttribute('data-kind',row.kind);title.textContent=row.title;delta.textContent=row.delta===0?'$0 change':signedCash(row.delta);head.append(title,delta);detail.textContent=row.detail;path.textContent=cash(row.before)+' → '+cash(row.after);item.append(head,detail,path);list.append(item);}$('activity-empty').hidden=moneyJournal.rows.length>0;$('money-activity').showModal();}

async function unlock(){try{if(navigator.audioSession)navigator.audioSession.type='playback';audio??=new(window.AudioContext||window.webkitAudioContext)();if(!master){master=audio.createGain();master.gain.value=muted?0:.25;const compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;master.connect(compressor);compressor.connect(audio.destination);noise=audio.createBuffer(1,audio.sampleRate*.25,audio.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);}await audio.resume();return audio.state==='running';}catch{return false;}}
function tone(f,d=.08,type='sine',delay=0,gain=.2){if(!audio||audio.state!=='running'||muted||document.hidden)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(gain,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
function clack(){if(!audio||audio.state!=='running'||muted||document.hidden)return;const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),t=audio.currentTime;source.buffer=noise;filter.type='bandpass';filter.frequency.value=1700;filter.Q.value=.8;gain.gain.setValueAtTime(.38,t);gain.gain.exponentialRampToValueAtTime(.001,t+.055);source.connect(filter);filter.connect(gain);gain.connect(master);source.start(t);source.stop(t+.065);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
function tick(direction=1){if(sfx.enabled)sfx.play('tick');else{tone(486,.19,'square',0,.12);}}
function drive(speed){if(!audio||audio.state!=='running')return;if(!rumble){const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=noise;source.loop=true;filter.type='lowpass';source.connect(filter);filter.connect(gain);gain.connect(master);gain.gain.value=0;source.start();rumble={source,filter,gain};}rumble.filter.frequency.setTargetAtTime(150+Math.abs(speed)*26,audio.currentTime,.08);rumble.gain.gain.setTargetAtTime(document.hidden||$('games-menu').open||$('instructions').open?0:Math.min(.08,Math.abs(speed)*.002),audio.currentTime,.05);}
function stopDrive(){if(rumble){rumble.source.stop();rumble.source.disconnect();rumble.filter.disconnect();rumble.gain.disconnect();rumble=null;}}
function win(){sfx.play('jackpot');}
function lose(){sfx.play('bust');}
function react(kind,label){clearTimeout(fxTimer);const el=$('celebration');el.className='celebration '+kind;el.innerHTML='<strong>'+label+'</strong>'+(kind==='win'&&!reduced?Array.from({length:12},(_,i)=>'<i style="--x:'+((i*37)%100)+'%;--delay:'+((i%8)*.06)+'s;--turn:'+(i*67)+'deg;--hue:'+(i%3===0?'#69d4ff':i%3===1?'#bde7ff':'#edf5ff')+'"></i>').join(''):'');document.querySelector('.console').classList.remove('react-bust','react-win');void el.offsetWidth;document.querySelector('.console').classList.add('react-'+kind);fxTimer=setTimeout(()=>{el.className='celebration';el.innerHTML='';document.querySelector('.console').classList.remove('react-bust','react-win');},2200);}
function bankUpdate(){if(arcade){moneyFeedback.sync(wallet.balance);$('spin-price').textContent=game.stage==='bonus'?'BONUS · FREE':wallet.freeSpins?'FREE SPIN ×'+wallet.freeSpins:'$100 / spin';}$('bank-amount').hidden=!arcade;$('spin-price').hidden=!arcade;}
function playRoundResultSound(){
 const net=roundReturn(game.player,roundFees,roundBlackCash).net;
 sfx.play(game.player.total>100?'bust':net<0?'loss':net===0?'even':(game.player.total===100||net>=1000)?'jackpot':'cash');
}
function presentRoundResult(reward=null){
 const result=roundReturn(game.player,roundFees,roundBlackCash),loss=result.net<0;
 const detail=cash(result.payout)+' received − '+cash(result.fees)+' spent.'+(roundBlackCash?' Includes '+cash(roundBlackCash)+' black-panel bonus.':'')+(reward?.kind==='free-spin'?' Next regular spin free.':'');
 moneyFeedback.cue({kind:loss?'loss':reward?'powerup-coins':result.net>0?'profit':'even',title:loss?'Round finished · net loss':result.net>0?'Round finished · profit':'Round finished · even',amount:signedCash(result.net),detail});
 if(!reward)playRoundResultSound();
 react(loss?'bust':result.net>0?'win':'again','');
}
function payRound(reward=null){
 if(!arcade||roundPaid||game.stage!=='normal'||game.action!=='next')return;
 roundPaid=true;const pay=roundPayout(game.player.total);
 if(pay)changeMoney(pay,'payout','Score prize collected',game.player.total+'¢ × $2 = '+cash(pay)+'. Added to your bank.');
 bankUpdate();presentRoundResult(reward);
}
function awardBlackPanel(value,full){
 if(!arcade)return false;const reward=panelBonuses.claim(value,{full,stage:game.stage,total:game.player.total});if(!reward)return false;
 const coin=reward.kind==='coins'||wallet.freeSpins>=99;
 if(coin){roundBlackCash+=50;changeMoney(50,'bonus',value+'¢ black-panel reward','Extra $50 banked now. You keep it even if the next spin goes over.');}
 else{wallet.addFreeSpin();roundFreeEarned++;moneyJournal.record(wallet.balance,wallet.balance,'free-spin',value+'¢ free-spin reward','One free regular spin saved. Used automatically on your next regular spin.');}
 bankUpdate();return {...reward,kind:coin?'coins':'free-spin'};
}
function showPanelReward(reward){
 // Rewards have no timeout. Scoring, cash-out and bank animations cannot erase them.
 panelReward=reward;moneyFeedback.dismiss();
 const coin=reward.kind==='coins',card=$('panel-reward');
 card.hidden=true;card.setAttribute('data-kind',reward.kind);
 $('reward-source').textContent=reward.value+'¢ · Bonus collected';
 $('reward-amount').textContent=coin?'+$50 bonus cash':'+1 free spin';
 $('reward-detail').textContent=coin?'Banked. Yours to keep.':'Next regular spin: $0.';
 $('reward-coin').hidden=!coin;$('reward-spin-icon').hidden=coin;
 $('reward-dismiss').setAttribute('aria-label','Got it. Dismiss '+(coin?'$50 cash reward':'free-spin reward')+'.');
 void card.offsetWidth;card.hidden=false;$('announcement').setAttribute('data-reward','true');resultFeedback.syncVisibility();
 $('money-announcer').textContent=[$('reward-source').textContent,$('reward-amount').textContent,$('reward-detail').textContent].join('. ');
 draw();
}
function dismissPanelReward(){
 panelReward=null;$('panel-reward').hidden=true;$('announcement').removeAttribute('data-reward');resultFeedback.syncVisibility();
}
function updateRecent(){
 if(game.stage==='normal'&&game.action==='next'&&!recordedTurns.has(game.player)){pastTurns.add(game.player);recordedTurns.add(game.player);}
 $('recent-scores').textContent=pastTurns.rows.length?pastTurns.rows.map(x=>x.total>100?'Out':money(x.total)).join(' · '):'No finished turns yet';
 const list=$('recent-list');list.textContent='';
 for(const [i,row] of pastTurns.rows.entries()){const item=document.createElement('li');const name=document.createElement('span'),value=document.createElement('b');name.textContent=(i===0?'Latest · ': '')+row.player;value.textContent=money(row.total)+(row.total>100?' · Out':'');item.append(name,value);list.append(item);}
 $('recent-current').textContent=game.player.spins.length?'Current: '+money(game.player.total):'Current: not spun yet';
 $('recent-empty').hidden=!!pastTurns.rows.length;
}
function updateReceipt(){
 const available=arcade&&!animation&&game.action==='next'&&['normal','bonus'].includes(game.stage);
 $('receipt-open').hidden=!available;$('round-paid-label').hidden=available;
 if(!available)return;
 const p=game.player;
 const {scorePayout,payout,fees,net}=roundReturn(p,roundFees,roundBlackCash),bust=p.total>100;
 $('receipt').setAttribute('data-result',bust?'bust':net>=0?'win':'loss');
 $('receipt-title').textContent=bust?'Over a dollar':game.stage==='bonus'?'Bonus result':p.total===100?'You hit $1.00!':'Cashed out';
 $('receipt-amount').textContent=cash(scorePayout);
 $('receipt-score').textContent=p.spins.map(money).join(' + ')+(p.spins.length>1?' = '+money(p.total):'');
 $('receipt-change-label').textContent=net<0?'Your bank lost':net>0?'Your bank gained':'You broke even';
 $('receipt-before').textContent=cash(roundStartBalance);$('receipt-payout').textContent='+'+cash(scorePayout);$('receipt-extra').textContent='+'+cash(roundBlackCash);$('receipt-free').textContent=roundFreeUsed+' used · '+roundFreeEarned+' earned';$('receipt-extra-row').hidden=!roundBlackCash;$('receipt-free-row').hidden=!(roundFreeUsed||roundFreeEarned);
 $('receipt-note').textContent=bust?'No score prize. Any black-panel cash you already collected stays in your bank.':net<0?'You received '+cash(payout)+', but paid '+cash(fees)+' for spins. The difference is your loss.':p.total===100&&game.stage==='normal'?'Your $1,000 is banked. Your dollar bonus spin is free.':'All cash shown is already in your bank. No additional charge or collection step.';

 $('receipt-formula').textContent=bust?p.spins.map(money).join(' + ')+' = '+money(p.total)+'. Over $1.00 means a $0 score prize.':p.total<100?p.total+'¢ × $2 = '+cash(scorePayout)+'. This is your score prize, before spin costs.':game.stage==='bonus'?'$1,000 dollar award + $'+(p.cash-1000).toLocaleString()+' bonus.':'Exact $1.00 pays $1,000 and earns a free bonus spin.';
 $('receipt-fees').textContent=(fees?'−':'')+cash(fees)+' ('+(fees/SPIN_COST)+' paid'+(roundFreeUsed?', '+roundFreeUsed+' free':'')+')';$('receipt-net').textContent=(net<0?'−':'+')+'$'+Math.abs(net).toLocaleString();$('receipt-bank').textContent='$'+wallet.balance.toLocaleString();
 $('receipt-continue').textContent=$('next-label').textContent;
 $('receipt-sparks').innerHTML='';
 $('headline').textContent=bust?'Over $1.00 · '+signedCash(net):p.total===100&&game.stage==='normal'?'Perfect $1.00 · '+signedCash(net):net===0?'You broke even':cash(Math.abs(net))+(net<0?' lost this round':' profit this round');
 $('message').textContent=cash(payout)+' received − '+cash(fees)+' spent.'+(p.total===100&&game.stage==='normal'?' Free bonus next.':bust?' No extra charge.':'');
 return {payout,fees,net};
}
function render(){bankUpdate();updateRecent();const p=game.player,busy=!!animation||paused||roundStarting,held=!!animation?.model.held; $('total').textContent=p.spins.length?money(p.total):'—';$('cash').textContent='$'+(p.cash+(arcade?roundBlackCash+(roundPaid?roundPayout(p.total):0):0)).toLocaleString();$('turn').textContent=(game.players.length===1?'Your':p.name+ ' ·')+' total';$('history').innerHTML=p.spins.length?`<span>Spin 1 <b>${money(p.spins[0])}</b></span><span>Spin 2 <b>${p.spins.length>1?money(p.spins[1]):'—'}</b></span>`:'<span>Spin 1 <b>—</b></span><span>Spin 2 <b>—</b></span>';
 $('scoreboard').innerHTML=game.players.length===1?'':game.players.map((x,i)=>`<div class="contestant ${i===game.index?'active':''}">${x.name}<b>${(game.stage==='tie'||game.bonusTie)&&x.tie?money(x.tie):x.total>100?'OUT':x.spins.length?money(x.total):'—'}</b></div>`).join('');
 $('headline').textContent=held?'You have the wheel':animation?'Around it goes…':game.stage==='done'?(game.players.length===1?'Your final score':game.winner?.name+' wins!'):game.stage==='bonus'?'The bonus spin!':game.stage==='tie'?'Spin-off!':p.total===100?'ONE DOLLAR!':p.total>100?'Over a dollar!':p.spins.length?'Stay or spin?':'Give it a spin!';
 if(!animation&&game.action==='next'&&game.stage==='normal'&&p.total<100)$('headline').textContent='That’s '+money(p.total)+'!';
 $('message').textContent=held?'Lift and pull to rock it. Pull down firmly, then let go.':animation?'Your pull sets the pace. It needs one full turn.':game.message;
 $('spin').hidden=!['spin','choice'].includes(game.action);$('stay').hidden=game.action!=='choice';$('next').hidden=!['next','done'].includes(game.action);
 $('spin').setAttribute('data-state',held?'held':animation?'spinning':'ready');document.querySelector('.console').setAttribute('data-outcome',p.total>100?'bust':p.total===100?'dollar':'normal');
 const choice=game.action==='choice',charge=arcade?(game.stage==='bonus'||wallet.freeSpins?' · FREE':' · $100'):'';
 const spinLabel=held?'Release to spin':animation?'Wheel spinning…':game.stage==='bonus'?'Spin for the bonus':game.stage==='tie'?'Spin to break the tie':p.spins.length?'Spin again':'Spin the wheel';
 const spinHelp=held?(arcade&&game.stage!=='bonus'?(wallet.freeSpins?'Release · free spin':'Release · pay $100'):animation.model.motor?'Let go of the button':'Let go of the wheel'):animation?'Wait for it to stop':'Hold, then release'+charge;
 $('spin').innerHTML='<span>'+spinLabel+'</span><small>'+spinHelp+'</small>';
 $('spin').setAttribute('aria-label',spinLabel+'. '+spinHelp);
 $('stay').innerHTML='<span>'+(arcade?'Cash out':'Keep '+money(p.total))+'</span><small>'+(arcade?'Collect $'+roundPayout(p.total):'End your turn')+'</small>';
 document.querySelector('.actions').setAttribute('data-choice',String(choice&&!busy));
 if(!busy&&game.message.startsWith('One full revolution')){$('headline').textContent='That spin was too short';$('message').textContent='Hold the spin button longer, then release.'+(arcade?' Your payment or free spin was returned.':' The spin does not count.');}
 if(!busy&&choice){$('headline').textContent=money(100-p.total)+' from $1.00';$('message').textContent=arcade?'Collect '+cash(roundPayout(p.total))+' now, or spin again. Over '+money(100-p.total)+' more loses the score prize.':'A second spin adds to your total. More than '+money(100-p.total)+' puts you over $1.00.';}
 if(!busy&&game.stage==='normal'&&game.action==='spin'&&!p.spins.length&&game.message.startsWith('Get as close')){$('headline').textContent='Aim for $1.00';$('message').textContent=arcade?'Up to 2 spins. Cash out before you go over. '+(wallet.freeSpins?'Your next spin is free.':'Each spin costs $100.'):'Add up to two spins without going over $1.00.';}
 if(held){$('headline').textContent=animation.model.motor?'Let go when you’re ready':'Pull down, then let go';$('message').textContent=animation.model.motor?'Keep holding for a stronger spin. Release the button to let the wheel coast.':'Keep your finger on the wheel as you pull. Release while moving downward.';}
 if(animation&&!held){$('headline').textContent='Let’s see where it lands';$('message').textContent='The red pointer marks your score when the wheel stops.';}
 if(!busy&&game.action==='next'&&game.stage==='normal'&&arcade&&p.total<100){$('headline').textContent='$'+roundPayout(p.total)+' collected';$('message').textContent=money(p.total)+' final score. Your payout is already in your bank.';}
 if(!busy&&game.action==='next'&&game.stage==='normal'&&p.total>100){$('headline').textContent='Over $1.00';$('message').textContent=money(p.spins[0])+' + '+money(p.spins[1])+' = '+money(p.total)+'. '+(arcade?'No payout this round.':'Your turn is over.');}

 const round=roundView(game,{number:roundNumber,arcade,fees:roundFees,extra:roundBlackCash,freeSpins:wallet.freeSpins});
 $('next-label').textContent=round.nextLabel;$('next-help').textContent=round.nextHelp;
 $('next').setAttribute('data-action',round.nextAction);$('next').setAttribute('aria-label',round.nextLabel+'. '+round.nextHelp);
 for(const id of ['stay','next','solo','party','arcade','restart'])$(id).disabled=busy;$('spin').disabled=busy&&!animation?.model.motor;
 $('hint').textContent=held?'Keep holding to lift, pull down, or brake.':animation?'One full forward turn makes it count.':'Grab the wheel, rock it, then pull down and release.';
 canvas.setAttribute('aria-label',held?'Wheel held. Move up or down, then release.':animation?'Wheel spinning':`Wheel stopped on ${money(landed(position))}. Drag up and down, then pull down and release.`);document.querySelector('.swipe').textContent=held?'Release to let go':animation?'Watch the red pointer':'Drag the wheel down, then release';document.querySelector('.wheel-area').classList.toggle('held',held);updateReceipt();updateRoundUI(round);
}
function updateRoundUI(round){
 const dock=document.querySelector('.console');
 const phase=roundStarting?'starting':round.phase;
 dock.setAttribute('data-phase',phase);dock.setAttribute('data-return',round.tone);
 $('round-games').hidden=!round.complete;$('round-games').disabled=!!animation||paused||roundStarting;
 if(round.complete)$('turn').textContent='Final score';
 $('round-label').textContent=round.label;
 $('round-state').textContent=roundStarting?'Get ready':animation?'Spinning':round.status;
 $('round-transition').hidden=!roundStarting;
 $('round-transition-title').textContent=game.stage==='bonus'?'Free bonus spin':game.stage==='tie'?'Tie-break':game.players.length>1?game.player.name+' · ready':'Round '+roundNumber;
 $('round-transition-detail').textContent=game.stage==='bonus'?'Your dollar prize is safe':'Ready to spin';
 if(!animation&&(round.complete||round.phase==='bonus-ready'||round.phase==='turn-complete')){
  moneyFeedback.dismiss();
  if(round.headline)$('headline').textContent=round.headline;
  if(round.detail)$('message').textContent=round.detail;
 }
 if(roundStarting){$('headline').textContent='Round '+roundNumber+' · ready';$('message').textContent=arcade?(game.stage==='bonus'?'Free bonus spin. Your dollar prize is safe.':wallet.freeSpins?'Your next spin is free. Hold, then release.':'Hold, then release to spin. $100 is charged on release.'):'Hold, then release to spin.';}
 if(!animation&&phase!==shownRoundPhase&&['complete','bonus-ready','turn-complete'].includes(phase))$('next').focus?.({preventScroll:true});
 shownRoundPhase=phase;
}
function beginRoundIntro({sound=true}={}){
 clearTimeout(roundIntroTimer);roundIntroTimer=0;
 if(sound)sfx.play('welcome');
 roundStarting=!reduced;render();
 if(reduced){if(canGrab())$('spin').focus?.({preventScroll:true});return;}
 roundIntroTimer=setTimeout(()=>{roundIntroTimer=0;roundStarting=false;render();if(canGrab())$('spin').focus?.({preventScroll:true});},650);
}
let paintWheel=makeWheelRenderer(canvas,VALUES);
function draw(){if(rendererLost)return;const rewards=arcade&&game.stage==='normal'?[...panelBonuses.active,...(panelReward?[{...panelReward,claimed:true}]:[])]:[];paintWheel(position,reduced?pointerRest(position):spring.bend,rewards);}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();rendererLost=true;cancelAnimationFrame(frameId);frameId=0;stopDrive();});
canvas.addEventListener('webglcontextrestored',()=>{try{paintWheel=makeWheelRenderer(canvas,VALUES);rendererLost=false;lastWheelPaint=0;if(animation){animation.last=performance.now();scheduleFrame();}draw();}catch{rendererLost=true;}});
function settlePointer(){cancelAnimationFrame(settleFrame);settleTime=performance.now();const start=settleTime;
 function settle(now){settleFrame=0;const done=stepPointer(spring,position,(now-settleTime)/1000);settleTime=now;draw();if(!done&&now-start<1200&&!animation)settleFrame=requestAnimationFrame(settle);else{spring.bend=pointerRest(position);spring.velocity=0;draw();}}
 if(reduced){spring.bend=pointerRest(position);draw();}else settleFrame=requestAnimationFrame(settle);
}
function canGrab(){return !roundStarting&&!$('games-menu').open&&!$('money-activity').open&&!$('receipt').open&&!$('recent-dialog').open&&!$('instructions').open&&!animation&&!paused&&!$('startup').open&&!$('result-details').open&&['spin','choice'].includes(game.action);}
function beginGrip(motor=false){
 if(!canGrab())return false;if(arcade&&game.stage!=='bonus'&&wallet.balance<SPIN_COST&&!wallet.freeSpins){$('bank-empty').showModal();return false;}
 resultFeedback.clear();dismissPanelReward();payoutFlight.clear();moneyFeedback.dismiss();cancelAnimationFrame(settleFrame);settleFrame=0;const model=createWheel(position);grab(model,motor);
 animation={model,accumulator:0,last:performance.now(),cancelled:false,scoring:false,charged:0,usedFree:false};
 // Start motion immediately; unlocking audio must not delay hand control.
 if(!muted)void unlock();render();scheduleFrame();return true;
}
function scheduleFrame(){if(!rendererLost&&!frameId)frameId=requestAnimationFrame(frame);}
function advance(now){
 if(!animation)return;
 const a=animation,dt=Math.max(0,Math.min(.12,(now-a.last)/1000));a.last=now;
 if(document.hidden||$('games-menu').open||$('instructions').open||$('money-activity').open){drive(0);return;}
 a.accumulator+=dt;let crossed=0;
 while(a.accumulator>=FIXED_STEP&&!a.model.done){const crossing=step(a.model);if(crossing)crossed=crossing;a.accumulator-=FIXED_STEP;}
 position=a.model.position;stepPointer(spring,position,dt);if(crossed)tick(crossed);drive(a.model.velocity);
}
function frame(now){
 frameId=0;if(!animation)return;advance(now);
 if(document.hidden||$('games-menu').open||$('instructions').open||$('money-activity').open){scheduleFrame();return;}
 // Physics and pointer ticks still advance at display rate; the expensive
 // geometry upload is limited to roughly 30 frames a second on phones.
 if(animation.model.done){finishSpin();return;}
 if(window.innerWidth>700||now-lastWheelPaint>=32){draw();lastWheelPaint=now;}
 scheduleFrame();
}
function finishSpin(){
 const a=animation;animation=null;pointerKick=0;stopDrive();settlePointer();draw();
 wheelGestureGuard.release();
 if(a.scoring&&!a.cancelled){
  const full=a.model.forwardDistance>=20,value=landed(position),before=game.player.cash;game.spin(value,full);
  if(!full&&a.charged){roundFees-=a.charged;changeMoney(a.charged,'refund','Spin refunded','Too short to count. Your $100 is back.');}
  if(!full&&a.usedFree){wallet.addFreeSpin();roundFreeUsed--;moneyJournal.record(wallet.balance,wallet.balance,'free-spin','Free spin returned','The spin was too short. Your saved free spin was restored.');moneyFeedback.cue({kind:'powerup-spin',title:'Too short to count',amount:'FREE SPIN RETURNED',detail:'Try a longer hold. No money or free spin was lost.'});sfx.play('refund');}
  const earned=game.player.cash-before;
  if(arcade&&earned)changeMoney(earned,game.stage==='bonus'?'bonus':'payout',game.stage==='bonus'?'Dollar bonus collected':'Perfect dollar collected',game.stage==='bonus'?money(value)+' bonus landing pays '+cash(earned)+'.':'An exact $1.00 pays $1,000. A free dollar bonus spin is next.');
  const marked=arcade&&game.stage==='normal'&&panelBonuses.active.some(r=>r.value===value);
  const rewarded=awardBlackPanel(value,full);
  const missedReward=marked&&!rewarded?(!full?'short':'bust'):null;
  if(arcade&&full&&game.stage==='normal'&&game.action==='choice'&&!earned&&!rewarded)payoutFlight.landed(value);
  if(game.action==='next'){
   if(arcade&&game.stage==='normal')payRound(rewarded);
   else if(arcade){if(earned)presentRoundResult();else{sfx.play('loss');moneyFeedback.cue({kind:'loss',title:full?'Dollar bonus missed':'Bonus spin too short',amount:'$0 EXTRA',detail:'Your $1,000 prize stays in your bank.'});react('again','');}}
   else if(earned){win();react('win','');}else if(game.player.total>100){lose();react('bust','');}else sfx.play('stop');
  }else if(!full){if(!a.charged&&!a.usedFree)sfx.play('again');react('again','');}
  else if(!rewarded&&(game.action==='choice'||game.action==='spin')){
   sfx.play('stop');
   if(arcade)moneyFeedback.cue({kind:'preview',title:money(game.player.total)+' total',amount:cash(roundPayout(game.player.total))+' to collect',detail:'Tap Cash out to bank your score prize. Spin costs are deducted separately.'});
  }
  if(arcade&&game.player.total>100)moneyJournal.record(wallet.balance,wallet.balance,'bust','Over $1.00 — no score prize','Spin costs were already paid. Previously collected black-panel bonuses are kept.');
  if(rewarded){showPanelReward(rewarded);sfx.play('powerup');if(game.action!=='next')react('win','');}
  render();explainResult({full,value,earned,refund:!full?a.charged:0,usedFree:a.usedFree,missedReward});return;
 }
 else if(!a.cancelled){game.message='Pull down firmly and release while the wheel is moving.';render();explainResult({noPull:true});return;}
 render();
}
function endGrip(cancelled=false){
 if(!animation?.model.held)return;
 advance(performance.now());const a=animation;
 if(cancelled){a.cancelled=true;cancelGrip(a.model);}
 else{
  a.scoring=a.model.velocity>.08;
  if(a.scoring&&arcade&&game.stage!=='bonus'){
   if(wallet.useFreeSpin()){a.usedFree=true;roundFreeUsed++;moneyJournal.record(wallet.balance,wallet.balance,'free-spin','Free spin used','This regular spin cost $0. The two-spin round limit still applies.');moneyFeedback.cue({kind:'free',title:'Free spin used',amount:'$0 SPENT',detail:'One saved free spin used instead of the $100 fee.'});sfx.play('powerup');}
   else if(changeMoney(-SPIN_COST,'fee','Spin '+(game.player.spins.length+1)+' paid','$100 paid to spin. A short spin is refunded.')){a.charged=SPIN_COST;roundFees+=SPIN_COST;}
   else{a.scoring=false;a.cancelled=true;cancelGrip(a.model);}
  }else if(a.scoring&&arcade&&game.stage==='bonus')moneyFeedback.cue({kind:'free',title:'Dollar bonus spin',amount:'$0 SPENT',detail:'Your $1,000 prize is safe. This bonus spin is always free.'});
  release(a.model);
 }
 // Keep the dock covered throughout the coast. A button-held spin can only
 // cover it after pointerup, or the button would lose its captured pointer.
 if(drag){if(cancelled)wheelGestureGuard.release();}
 else if(!cancelled&&a.scoring)wheelGestureGuard.begin();
 drag=null;canvas.style.cursor='grab';lastControlEnd=performance.now();render();scheduleFrame();
}
function reset(count=game.players.length,{increment=false,intro=true}={}){wheelGestureGuard.reset();resultFeedback.clear();clearTimeout(roundIntroTimer);roundIntroTimer=0;roundStarting=false;if(increment)roundNumber++;dismissPanelReward();moneyFeedback.clear(wallet.balance);panelBonuses.reset();roundFees=0;roundBlackCash=0;roundFreeUsed=0;roundFreeEarned=0;roundStartBalance=wallet.balance;$('receipt').close();scenes.next();applyScene();cancelAnimationFrame(settleFrame);settleFrame=0;spring.bend=0;spring.velocity=0;recordedTurns=new WeakSet();roundPaid=false;token++;cancelAnimationFrame(frameId);frameId=0;stopDrive();pointerKick=0;animation=null;paused=false;drag=null;game=new Showdown(count);position=0;for(const[id,selected]of[['arcade',arcade],['solo',!arcade&&count===1],['party',!arcade&&count===3]]){$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));}draw();if(intro)beginRoundIntro();else render();}
$('result-dismiss').onclick=()=>{for(const key of ['title','amount','why','detail','next'])$('detail-'+key).textContent=$('result-'+key).textContent;$('result-details').showModal();};
$('reward-dismiss').onclick=()=>{const hadReward=!!panelReward;dismissPanelReward();moneyFeedback.dismiss();draw();render();if(hadReward&&arcade&&game.action==='next')playRoundResultSound();const action=['next','done'].includes(game.action)?$('next'):$('spin');action.focus?.({preventScroll:true});};
$('stay').onclick=()=>{if(animation||roundStarting||game.action!=='choice')return;game.stay();payRound();render();explainResult({cashout:true});};
$('next').onclick=()=>{
 if(animation||roundStarting||!['next','done'].includes(game.action))return;
 resultFeedback.clear();dismissPanelReward();moneyFeedback.dismiss();$('receipt').close();
 if(isRoundComplete(game)){reset(game.players.length,{increment:true});return;}
 const previous=game.stage;game.next();
 if(game.stage==='bonus'&&(previous!=='bonus'||game.action==='spin')){position=VALUES.indexOf(5)*-1+20;spring.bend=pointerRest(position);spring.velocity=0;}
 draw();render();
 if(game.stage==='done'){if(game.winner)win();explainResult();}else if(game.action==='spin')beginRoundIntro();
};
$('arcade').onclick=()=>{roundNumber=1;arcade=true;reset(1);};$('solo').onclick=()=>{roundNumber=1;arcade=false;reset(1);};$('party').onclick=()=>{roundNumber=1;arcade=false;reset(3);};$('restart').onclick=()=>{reset();$('instructions').close();};async function enableSound(){muted=false;const mediaPromise=sfx.enable();const webPromise=unlock();const results=await Promise.allSettled([mediaPromise,webPromise]);const ok=results[0].status==='fulfilled'&&results[0].value===true;if(master)master.gain.value=.38;muted=!ok;$('sound').setAttribute('aria-pressed',String(!ok));$('sound').setAttribute('aria-label',ok?'Mute sound':'Enable sound');return ok;}
$('sound').onclick=async()=>{if(muted||!sfx.enabled){await enableSound();}else{muted=true;sfx.setEnabled(false);if(master)master.gain.value=0;$('sound').setAttribute('aria-pressed','true');$('sound').setAttribute('aria-label','Enable sound');}};
$('enable-sound').onclick=async()=>{$('startup-status').textContent='Starting the sound…';if(await enableSound()){$('startup').close();beginRoundIntro({sound:false});}else $('startup-status').textContent='Playback was blocked. Tap again, or play without sound and try Safari.';};
$('silent-start').onclick=()=>{muted=true;sfx.setEnabled(false);$('sound').setAttribute('aria-label','Enable sound');$('sound').setAttribute('aria-pressed','true');$('startup').close();beginRoundIntro({sound:false});};
$('fresh-bank').onclick=()=>{const before=wallet.balance;wallet.fresh();roundNumber=1;$('bank-empty').close();reset(1);moneyFeedback.event(moneyJournal.record(before,wallet.balance,'reset','New run funded','Your starting bank has been reset to $1,000 in play money.'));};$('free-bank').onclick=()=>{roundNumber=1;arcade=false;$('bank-empty').close();reset(1);};
document.addEventListener('game-audio-blocked',()=>{sfx.enabled=false;$('sound').setAttribute('aria-pressed','true');$('sound').setAttribute('aria-label','Sound blocked: tap to enable');$('audio-status').textContent='Playback was blocked. Tap Test Sound to enable it again.';});
$('bank-amount').onclick=showMoneyActivity;$('receipt-activity').onclick=showMoneyActivity;
$('receipt-open').onclick=()=>{if(updateReceipt()){tipOnce();$('receipt').showModal();}};
function tipOnce(){const t=$('receipt-tip');if(!t)return;let seen=true;try{seen=sessionStorage.getItem('grokaiapps-tip-shown')==='1';if(!seen)sessionStorage.setItem('grokaiapps-tip-shown','1');}catch(e){seen=true;}t.hidden=seen;}
$('receipt-continue').onclick=()=>{$('receipt').close();$('next').onclick();};
$('recent').onclick=()=>{if(animation?.model.held)endGrip(true);$('recent-dialog').showModal();};
$('help').onclick=()=>{if(animation?.model.held)endGrip(true);$('instructions').showModal();drive(0);};document.addEventListener('visibilitychange',()=>{if(document.hidden)payoutFlight.clear();if(document.hidden&&animation?.model.held)endGrip(true);if(animation)animation.last=performance.now();drive(0);});$('test').onclick=async()=>{$('audio-status').textContent=await enableSound()?'Fanfare playing. Raise your media volume if needed.':'Playback was blocked. Try opening the game in Safari.';};
function panelScale(){const box=canvas.getBoundingClientRect();return Math.min(box.width/760,box.height/840)*367*Math.PI/10;}
canvas.onpointerdown=e=>{
 if(e.button!==0||!e.isPrimary||!canGrab())return;
 if(!beginGrip())return;
 wheelGestureGuard.begin();
 drag={id:e.pointerId,y:e.clientY,anchor:position,pixelsPerPanel:panelScale()};
 canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';e.preventDefault();
};
canvas.onpointermove=e=>{
 if(!drag||drag.id!==e.pointerId||!animation?.model.held)return;
 moveGrip(animation.model,drag.anchor+(e.clientY-drag.y)/drag.pixelsPerPanel);advance(performance.now());
};
canvas.onpointerup=e=>{if(drag?.id!==e.pointerId)return;e.preventDefault();canvas.onpointermove(e);endGrip();};
canvas.onpointercancel=e=>{if(drag?.id===e.pointerId)endGrip(true);};
canvas.onlostpointercapture=e=>{if(drag?.id===e.pointerId)endGrip(true);};
const pullButton=$('spin');let buttonPointer=null;
pullButton.onpointerdown=e=>{if(e.button!==0||!e.isPrimary||!beginGrip(true))return;buttonPointer=e.pointerId;pullButton.setPointerCapture(e.pointerId);e.preventDefault();};
pullButton.onpointerup=e=>{if(buttonPointer!==e.pointerId)return;buttonPointer=null;endGrip();};
pullButton.onpointercancel=pullButton.onlostpointercapture=e=>{if(buttonPointer!==e.pointerId)return;buttonPointer=null;endGrip(true);};
pullButton.onkeydown=e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();if(!e.repeat)beginGrip(true);};
pullButton.onkeyup=e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();if(animation?.model.motor)endGrip();};
pullButton.onblur=()=>{if(animation?.model.motor)endGrip(true);};
// Assistive technology may activate a button without pointer or key events.
pullButton.onclick=e=>{e.preventDefault();if(e.detail===0&&performance.now()-lastControlEnd>300&&beginGrip(true)){const a=animation;setTimeout(()=>{if(animation===a)endGrip();},750);}};
window.addEventListener('blur',()=>{if(animation?.model.held)endGrip(true);});
function fit(){const height=Math.min(window.innerHeight,window.visualViewport?.height||Infinity);const dpr=Math.min(window.innerWidth<=700?1.5:2,window.devicePixelRatio||1);const width=Math.round(760*dpr),pixelsHigh=Math.round(840*dpr);if(canvas.width===width&&canvas.height===pixelsHigh&&document.querySelector('.show').style.height===height+'px')return;payoutFlight.clear();if(animation?.model.held)endGrip(true);if(canvas.width!==width)canvas.width=width;if(canvas.height!==pixelsHigh)canvas.height=pixelsHigh;$('wheel').style.maxHeight='100%';document.querySelector('.show').style.height=height+'px';draw();}window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);fit();draw();render();$('startup').showModal();

setupGameMenu({beforeOpen(){payoutFlight.clear();if(animation?.model.held)endGrip(true);drive(0);},afterClose(){if(animation){animation.last=performance.now();scheduleFrame();}}});
