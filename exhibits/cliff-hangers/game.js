import {LIMIT, assessGuess, choosePrizes} from './rules.js';
import {AlpineAudio} from './audio.js';

const $ = id => document.getElementById(id), cash = n => '$' + n.toLocaleString('en-US');
const W = 1100, H = 760, STEP_MS = 470, START = {x:100,y:644}, END = {x:905,y:250};
const dx = END.x-START.x, dy = END.y-START.y, length = Math.hypot(dx,dy), normal = {x:-dy/length,y:dx/length}, angle = Math.atan2(dy,dx);
const canvas = $('board'), ctx = canvas.getContext('2d'), audio = new AlpineAudio(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const alpine = new Image(), climber = new Image(), prizesImage = new Image();
let loaded = false, loadError = false, phase = 'guess', round = 0, position = 0, displayPosition = 0;
let prizes = [], history = [], guessText = '', entry = '', outcome = null, gameToken = 0;
let motion = null, frameId = null, lastFrame = 0, lastMusicStep = -1, fallTime = 0, paused = false;
let calloutUntil = 0, gameClock = 0, particles = [], resultTimer;

const load = (image, src) => new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not load '+src));image.src=src;});
Promise.all([load(alpine,'./assets/alpine.png'),load(climber,'./assets/climber.png'),load(prizesImage,'./assets/prizes.png')]).then(()=>{loaded=true;$('board-loading').hidden=true;updateControls();wake();}).catch(()=>{loadError=true;$('board-loading').textContent='ARTWORK COULD NOT LOAD. RELOAD TO TRY AGAIN.';status('The artwork could not load. Please reload the game.');});

function status(text) { $('status').textContent = text; }
function point(step) { return {x:START.x+dx*step/LIMIT,y:START.y+dy*step/LIMIT}; }
function wake() { if (!frameId) frameId = requestAnimationFrame(tick); }
function boardSize() {
  const space=$('board-space'),frame=$('board-frame'),s=getComputedStyle(space),f=getComputedStyle(frame),px=(x,k)=>parseFloat(x[k])||0;
  const width=space.clientWidth-px(s,'paddingLeft')-px(s,'paddingRight'),height=space.clientHeight-px(s,'paddingTop')-px(s,'paddingBottom');
  const extraX=px(f,'paddingLeft')+px(f,'paddingRight')+px(f,'borderLeftWidth')+px(f,'borderRightWidth');
  const extraY=px(f,'paddingTop')+px(f,'paddingBottom')+px(f,'borderTopWidth')+px(f,'borderBottomWidth');
  const scale=Math.max(0,Math.min((width-extraX)/W,(height-extraY)/H));
  frame.style.width=Math.max(1,Math.floor(W*scale+extraX))+'px';frame.style.height=Math.max(1,Math.floor(H*scale+extraY))+'px';
}
function viewportSize() {
  const app=$('app'),v=window.visualViewport,heights=[window.innerHeight,document.documentElement.clientHeight].filter(n=>n>0);
  if(v&&Math.abs(v.scale-1)<.05&&v.height>0)heights.push(v.height);
  const top=Math.max(0,app.getBoundingClientRect().top-(v?.offsetTop||0));
  if(heights.length)app.style.height=Math.max(1,Math.floor(Math.min(...heights)-top))+'px';
  boardSize();
}
function canvasSize() {
  const r=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.max(1,Math.round(r.width*ratio));canvas.height=Math.max(1,Math.round(r.height*ratio));
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);wake();
}
new ResizeObserver(boardSize).observe($('board-space'));new ResizeObserver(canvasSize).observe(canvas);
window.addEventListener('resize',viewportSize);window.addEventListener('pageshow',viewportSize);window.visualViewport?.addEventListener('resize',viewportSize);

function drawTrack() {
  // This polygon is the playable mountain/cliff boundary, not a predicted path.
  ctx.save();ctx.beginPath();ctx.moveTo(START.x-24,START.y+22);ctx.lineTo(END.x+28,END.y+4);ctx.lineTo(END.x+40,H);ctx.lineTo(START.x-24,H);ctx.closePath();ctx.clip();
  ctx.fillStyle='#4e3a618f';ctx.fillRect(0,0,W,H);ctx.restore();
  ctx.beginPath();ctx.moveTo(END.x+31,END.y+11);ctx.lineTo(END.x+40,H);ctx.strokeStyle='#50314fa8';ctx.lineWidth=8;ctx.stroke();
  const p0=point(-.65),p1=point(25.48);
  ctx.save();ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.strokeStyle='#754830';ctx.lineWidth=69;ctx.shadowColor='#26322770';ctx.shadowBlur=5;ctx.shadowOffsetY=9;ctx.stroke();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle='#fff3b1';ctx.lineWidth=59;ctx.stroke();ctx.strokeStyle='#efc650';ctx.lineWidth=51;ctx.stroke();ctx.restore();
  const compact=canvas.clientWidth<450;
  for(let step=0;step<=LIMIT;step++){
    const p=point(step),major=step%5===0;
    ctx.strokeStyle=step>=24?'#a83e38':'#594730';ctx.lineWidth=major?3.5:2;
    ctx.beginPath();ctx.moveTo(p.x-normal.x*24,p.y-normal.y*24);ctx.lineTo(p.x-normal.x*(major?2:8),p.y-normal.y*(major?2:8));ctx.stroke();
    if(!compact||major){ctx.save();ctx.translate(p.x+normal.x*12,p.y+normal.y*12);ctx.rotate(angle);ctx.font=`800 ${compact?39:25}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=step>=20?'#a43133':'#3f3f30';ctx.fillText(String(step),0,0);ctx.restore();}
  }
  // A distinct final red stripe marks the edge after the 25th safe position.
  const edge=point(25.55);ctx.beginPath();ctx.moveTo(edge.x-normal.x*31,edge.y-normal.y*31);ctx.lineTo(edge.x+normal.x*31,edge.y+normal.y*31);ctx.strokeStyle='#c43b39';ctx.lineWidth=7;ctx.stroke();
  const label=point(24.5);ctx.save();ctx.translate(label.x+36,label.y+92);ctx.fillStyle='#4d315e';ctx.fillRect(-49,-18,98,35);ctx.fillStyle='#fff1b6';ctx.font='800 24px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('THE EDGE',0,0);ctx.restore();
}
function drawClimber() {
  if(!loaded)return;
  let p=point(displayPosition),x=p.x-normal.x*30,y=p.y-normal.y*30,rotation=0;
  const walking=phase==='climbing',height=182,width=height*climber.naturalWidth/climber.naturalHeight;
  if(walking&&!reducedMotion.matches){y-=Math.sin((motion?.elapsed||0)/STEP_MS*Math.PI*2)*3;rotation=Math.sin((motion?.elapsed||0)/STEP_MS*Math.PI*2)*.018;}
  if(phase==='falling'||phase==='lost'){
    const t=Math.min(fallTime/1000,2);x+=75*t;y+=60*t+300*t*t;rotation=t*2.9;
    if(reducedMotion.matches){x=p.x+45;y=p.y+Math.min(fallTime/.8,950);rotation=.2;}
  }
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.shadowColor='#201f2d66';ctx.shadowBlur=3;ctx.shadowOffsetX=3;ctx.shadowOffsetY=4;
  ctx.drawImage(climber,-width*.24,-height,width,height);ctx.restore();
}
function draw() {
  ctx.clearRect(0,0,W,H);if(!loaded)return;
  const s=Math.max(W/alpine.naturalWidth,H/alpine.naturalHeight),iw=alpine.naturalWidth*s,ih=alpine.naturalHeight*s;
  ctx.drawImage(alpine,(W-iw)/2,(H-ih)/2,iw,ih);drawTrack();drawClimber();
  for(const p of particles){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalAlpha=Math.min(p.life,1);ctx.fillStyle=p.color;ctx.fillRect(-4,-3,8,6);ctx.restore();}
}
function updateCounter(value=position) {
  const whole=Math.min(26,Math.max(0,Math.floor(value+.001))),left=Math.max(0,LIMIT-whole);
  $('steps-left').textContent=String(left);$('position-label').textContent=whole===0?'AT THE START':whole>25?'OVER THE EDGE':`STEP ${whole} OF 25`;
  const card=document.querySelector('.step-card');card.classList.toggle('danger',left<=5&&whole<=25);card.classList.toggle('fallen',whole>25);
  canvas.setAttribute('aria-label',whole>25?'The climber has fallen off at step 26.':`Climber at step ${whole} of 25. ${left} safe steps remain.`);
}
function updateControls() {
  const canGuess=phase==='guess'&&loaded;
  $('guess').disabled=!canGuess;$('lock').disabled=!canGuess||guessText==='';
  $('lock').textContent=phase==='starting'?'LET’S SEE…':phase==='climbing'?'HE’S CLIMBING…':phase==='falling'?'OVER THE EDGE!':'LOCK IT IN';
  $('guess-value').textContent=guessText||'—';
  for(let i=0;i<3;i++){const d=$('dot-'+i);d.className=i< history.length?(history[i].fell?'lost':'won'):i===round?'current':'';d.textContent=i<history.length?(history[i].fell?'×':'✓'):String(i+1);}
}
function showPrize() {
  const p=prizes[round];$('round-label').textContent=`SMALL PRIZE ${round+1} OF 3`;$('product-name').textContent=p.name;$('product-description').textContent=p.description;$('product-category').textContent=p.category;
  $('product-picture').style.backgroundPosition=`${p.id%3*50}% ${Math.floor(p.id/3)*50}%`;$('product-picture').setAttribute('aria-label',p.name);
  $('guess-panel').hidden=false;$('reveal-panel').hidden=true;guessText='';
  status(position===25?'You’re at the edge. This guess must be exact.':round===0?'Tap the price box to make your first guess.':`${LIMIT-position} safe steps left. Price the next prize.`);
  updateControls();viewportSize();
}
function newGame() {
  gameToken++;clearTimeout(resultTimer);audio.stop();phase='guess';round=0;position=0;displayPosition=0;history=[];guessText='';entry='';outcome=null;motion=null;fallTime=0;lastMusicStep=-1;particles=[];lastFrame=0;calloutUntil=0;
  prizes=choosePrizes();$('board-message').classList.remove('visible','bad');$('won-prizes').textContent='Keep him on the mountain to win.';updateCounter();showPrize();wake();
}
function callout(small,big,bad=false,duration=1500) {
  $('message-small').textContent=small;$('message-big').textContent=big;$('board-message').classList.toggle('bad',bad);$('board-message').classList.add('visible');calloutUntil=gameClock+duration;wake();
}
async function submitGuess() {
  if(phase!=='guess'||guessText===''||!loaded)return;
  const token=gameToken,guess=Number(guessText);outcome=assessGuess(position,guess,prizes[round].price);
  phase='starting';motion={elapsed:0,duration:Math.max(700,(outcome.end-position)*STEP_MS),from:position,to:outcome.end};lastMusicStep=-1;
  $('board-message').classList.remove('visible');updateControls();status('Is that the right price? Let’s see how far he goes…');
  await Promise.race([audio.unlock(),new Promise(r=>setTimeout(r,900))]);
  if(gameToken!==token)return;
  phase='climbing';updateControls();
  if(outcome.error===0){audio.effect('exact');callout('RIGHT ON THE MONEY!','NO STEPS!',false,1400);status('An exact guess! He stays right where he is.');}
  lastFrame=0;wake();
}
function finishClimb() {
  position=outcome.end;displayPosition=position;updateCounter();
  if(outcome.fell){phase='falling';fallTime=0;audio.effect('fall');callout('ONE STEP TOO FAR…','OVER THE EDGE!',true,1900);status('He went over the edge!');updateControls();return;}
  audio.stop();if(outcome.error!==0)audio.effect('stop');phase='reveal';revealPrice();
  if(round===2){phase='won';audio.effect('win');celebrate();callout('ALL THREE PRICES. STILL SAFE.','YOU WIN!',false,2400);$('next').textContent='SEE YOUR PRIZES';$('reveal-message').textContent='He stayed safe! You won the Swiss Alps getaway.';status('You won the Swiss Alps getaway!');}
}
function revealPrice() {
  history.push({...outcome,product:prizes[round]});$('guess-panel').hidden=true;$('reveal-panel').hidden=false;
  $('reveal-guess').textContent=cash(outcome.guess);$('reveal-actual').textContent=cash(outcome.price);$('reveal-error').textContent=cash(outcome.error);
  $('reveal-message').textContent=outcome.fell?'Over the edge. The grand prize is gone.':outcome.error===0?'Exactly right! Not a single step.':`${outcome.error} ${outcome.error===1?'step':'steps'} up. ${LIMIT-position} safe steps left.`;
  $('next').textContent=outcome.fell?'SEE YOUR RESULTS':round===2?'SEE YOUR PRIZES':'NEXT PRIZE';
  const kept=history.filter(h=>!h.fell);$('won-prizes').innerHTML=kept.length?kept.map(h=>`<span class="won-chip">${h.product.short}</span>`).join(''):'No small prizes secured.';
  updateControls();viewportSize();
}
function celebrate() {
  if(reducedMotion.matches)return;const colors=['#f7d471','#fff2ba','#dc6488','#75b59b','#8d73b1'];
  for(let i=0;i<90;i++)particles.push({x:W*.5+(Math.random()-.5)*500,y:100+Math.random()*150,vx:(Math.random()-.5)*200,vy:-60-Math.random()*140,angle:Math.random()*6,spin:(Math.random()-.5)*5,life:1+Math.random(),color:colors[i%5]});
}
function tick(now) {
  frameId=null;const dt=lastFrame?Math.min(60,now-lastFrame):0;lastFrame=now;
  const shouldPause=document.hidden||!!document.querySelector('dialog[open]');
  if(shouldPause){if(!paused)audio.stop();paused=true;lastFrame=0;draw();return;}
  if(paused){paused=false;lastMusicStep=-1;}
  gameClock+=dt;
  if(phase==='climbing'&&motion){
    motion.elapsed+=dt;
    const traveled=outcome.end-motion.from;
    if(traveled>0){
      const step=Math.min(traveled-1,Math.floor(motion.elapsed/STEP_MS));
      if(step!==lastMusicStep){lastMusicStep=step;audio.yodelBeat(step);}
      const progress=Math.min(traveled,motion.elapsed/STEP_MS),whole=Math.floor(progress),part=progress-whole;
      displayPosition=motion.from+whole+part*part*(3-2*part);updateCounter(displayPosition);
    }
    if(motion.elapsed>=motion.duration)finishClimb();
  } else if(phase==='falling'){
    fallTime+=dt;if(fallTime>=1500){phase='lost';revealPrice();}
  }
  if(calloutUntil&&gameClock>=calloutUntil){$('board-message').classList.remove('visible');calloutUntil=0;}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i],sec=dt/1000;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=110*sec;p.angle+=p.spin*sec;p.life-=sec*.5;if(p.life<=0||p.y>H+20)particles.splice(i,1);}
  draw();
  if(phase==='climbing'||phase==='falling'||particles.length||calloutUntil)frameId=requestAnimationFrame(tick);else lastFrame=0;
}
function showResults() {
  const won=phase==='won';$('result-eyebrow').textContent=won?'HE MADE IT!':'OH NO, YODELY GUY!';$('result-title').innerHTML=won?'You’re off to<br>the Swiss Alps.':'That was a<br>cliff hanger.';
  $('result-number').textContent=won?'$8,764':'STEP 26';$('result-copy').textContent=won?`You finished with ${history.reduce((n,h)=>n+h.error,0)} dollars of total error. The grand prize is yours!`:'The total error passed $25, sending the climber over the edge.';
  $('result-table').innerHTML='<div class="result-row heading"><span>PRIZE</span><span>GUESS</span><span>PRICE</span><span>ERROR</span></div>'+history.map(h=>`<div class="result-row"><span>${h.product.short}</span><span>${cash(h.guess)}</span><span>${cash(h.price)}</span><strong>${cash(h.error)}</strong></div>`).join('');
  const kept=history.filter(h=>!h.fell);$('result-kept').textContent=kept.length?'You also keep: '+kept.map(h=>h.product.short.toLowerCase()).join(', ')+'.':'No small prizes secured this time.';
  $('result-dialog').showModal();
}

function openKeypad() {
  if(phase!=='guess'||!loaded)return;entry=guessText;$('keypad-prize').textContent=prizes[round].name;updateEntry();$('keypad-dialog').showModal();audio.unlock();
}
function updateEntry() { $('keypad-value').textContent=entry===''?'$—':cash(Number(entry));$('set-price').disabled=entry===''; }
function key(value) {
  if(value==='clear')entry='';else if(value==='back')entry=entry.slice(0,-1);else if(/^\d$/.test(value)&&entry.length<3)entry=entry==='0'?value:entry+value;
  updateEntry();audio.effect('click');
}
function setPrice() { if(entry==='')return;guessText=String(Number(entry));$('keypad-dialog').close();updateControls();$('lock').focus();status('Ready? Lock in your price.'); }
$('guess').addEventListener('click',openKeypad);$('lock').addEventListener('click',submitGuess);
$('keypad').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(b)key(b.dataset.key);});$('set-price').addEventListener('click',setPrice);
document.addEventListener('keydown',e=>{
  if($('keypad-dialog').open){if(/^\d$/.test(e.key)){e.preventDefault();key(e.key);}else if(e.key==='Backspace'){e.preventDefault();key('back');}else if(e.key==='Delete'){e.preventDefault();key('clear');}else if(e.key==='Enter'){e.preventDefault();setPrice();}return;}
  if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^\d$/.test(e.key)&&phase==='guess'){e.preventDefault();openKeypad();key(e.key);}
});
$('next').addEventListener('click',()=>{if(phase==='won'||phase==='lost'){showResults();return;}if(phase!=='reveal')return;round++;phase='guess';showPrize();$('guess').focus();wake();});
function updateSoundButton(){ $('sound').setAttribute('aria-pressed',String(audio.enabled));$('sound').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');$('sound').title=audio.enabled?'Sound on':'Sound off'; }
$('sound').addEventListener('click',async()=>{audio.setEnabled(!audio.enabled);updateSoundButton();if(audio.enabled){const ok=await audio.unlock();if(ok)audio.effect('click');else status('Sound is unavailable in this view. Try opening the game in your browser.');}});
$('help').addEventListener('click',()=>{$('help-dialog').showModal();audio.stop();});
$('test-sound').addEventListener('click',async()=>{const ok=await audio.preview();updateSoundButton();$('sound-test-status').textContent=ok?'Playing a short yodel sample. Check your media volume if you cannot hear it.':'Audio could not start here. Try opening the game in your browser.';});
$('restart').addEventListener('click',()=>{if(history.length||phase!=='guess'){$('restart-dialog').showModal();audio.stop();}else newGame();});
$('confirm-restart').addEventListener('click',()=>{$('restart-dialog').close();newGame();});$('play-again').addEventListener('click',()=>{$('result-dialog').close();newGame();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)$(b.dataset.close).close();});
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('close',()=>{audio.stop();lastFrame=0;wake();});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
}
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden){audio.stop();if(audio.context?.state==='running')audio.context.suspend().catch(()=>{});}else{audio.unlock();wake();}});
newGame();viewportSize();canvasSize();
