import {W, H, LEFT, RIGHT, SLOT, RADIUS, PEG_RADIUS, DIVIDER_TOP, FLOOR, PEGS, GUIDES, VALUES, PlinkoPhysics} from './physics.js';

const $ = id => document.getElementById(id);
const money = n => '$' + n.toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('board'), ctx = canvas.getContext('2d');
const physics = new PlinkoPhysics();
let chipsTotal = 5, remaining = 5, total = 0, drops = [], active = false, gameOver = false;
let aim = .5, mode = 'quick', lastTime = 0, accumulator = 0, frameTime = 0;
let resultTimer, calloutTimer, frameId, hitSlot = -1, hitUntil = 0, soundOn = true;
let pointerId = null, releaseToDrop = false, pricingQuestions = [], pricingIndex = 0, pricingAnswered = false, prizeWins = 0;
let audioContext, mainGain, lastPing = 0;
const pegFlashes = new Map(), particles = [];
const timers = new Set();
let dirty = true;

function later(fn, delay) {
  const t = setTimeout(() => { timers.delete(t); fn(); }, delay);
  timers.add(t); return t;
}
function cancelTimers() { for (const t of timers) clearTimeout(t); timers.clear(); }
function wake() { dirty = true; if (!frameId) frameId = requestAnimationFrame(tick); }

function initAudio() {
  if (!soundOn) return;
  try {
    if (!audioContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext = new Audio(); mainGain = audioContext.createGain();
      mainGain.gain.value = .24; mainGain.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { /* The game stays playable when audio is unavailable. */ }
}
function tone(frequency, duration = .13, volume = .25, delay = 0, type = 'sine', endFrequency) {
  if (!soundOn || !audioContext || audioContext.state !== 'running') return;
  const time = audioContext.currentTime + delay, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .007);
  gain.gain.exponentialRampToValueAtTime(.001, time + duration);
  oscillator.connect(gain); gain.connect(mainGain); oscillator.start(time); oscillator.stop(time + duration + .03);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function ping(id, force) {
  pegFlashes.set(id, frameTime + 210);
  if (frameTime - lastPing < 45) return;
  lastPing = frameTime;
  const notes = [1046.5, 1318.5, 1568, 1760, 2093, 1174.7];
  tone(notes[id % notes.length], .065 + force * .075, .12 + force * .2);
  tone(2400 + id % 5 * 200, .04, .05);
}
function winSound(value) {
  if (value === 0) { tone(196,.23,.3,0,'triangle',147); tone(130.8,.4,.2,.18,'triangle',98); return; }
  const notes = value === 10000 ? [523.25,659.25,783.99,1046.5,783.99,1046.5,1318.5,1568] : [523.25,659.25,783.99,1046.5];
  notes.forEach((n,i) => { tone(n,.26,.28,i*.1,'triangle'); tone(n/2,.25,.14,i*.1); });
  if (value === 10000) [523.25,659.25,783.99].forEach(n=>tone(n,.9,.2,.83,'triangle'));
}

// The board is drawn at a fixed logical size; physics stays identical at every screen size.
const base = document.createElement('canvas'); base.width = W * 2; base.height = H * 2;
const bg = base.getContext('2d'); bg.scale(2, 2);
function roundRect(c,x,y,w,h,r,fill,stroke,line=1) {
  c.beginPath(); c.roundRect(x,y,w,h,r); if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
}
function drawBase() {
  const field = bg.createLinearGradient(0,0,W,H); field.addColorStop(0,'#743d94'); field.addColorStop(.48,'#c24284'); field.addColorStop(1,'#8b2b66');
  bg.fillStyle=field; bg.fillRect(0,0,W,H);
  const rays=['#dc65a038','#62277b36','#f0a5c72d','#70267f38','#f18eb42e','#70267f38','#f0a5c72d','#62277b36','#dc65a038'];
  for(let i=0;i<9;i++){bg.beginPath();bg.moveTo(W/2,-140);bg.lineTo(LEFT+i*SLOT,670);bg.lineTo(LEFT+(i+1)*SLOT,670);bg.closePath();bg.fillStyle=rays[i];bg.fill();}
  bg.strokeStyle='#f8aace20'; bg.lineWidth=1.2;
  for(let row=0;row<13;row++){const y=102+row*44;bg.beginPath();for(let j=0;j<=18;j++){const x=LEFT+j*SLOT/2;const yy=y+((j+row)%2)*22;j?bg.lineTo(x,yy):bg.moveTo(x,yy);}bg.stroke();}
  const top=bg.createLinearGradient(0,0,0,91);top.addColorStop(0,'#392044');top.addColorStop(1,'#673068');
  bg.fillStyle=top;bg.fillRect(LEFT,0,RIGHT-LEFT,90);bg.fillStyle='#f6c06f';bg.fillRect(LEFT,88,RIGHT-LEFT,3);
  bg.font='700 20px Arial';bg.textAlign='left';bg.fillStyle='#f9dbac8a';bg.fillText('DRAG',53,51);bg.textAlign='right';bg.fillText('RELEASE',667,51);
  bg.strokeStyle='#f9dbac55';bg.lineWidth=2;bg.beginPath();bg.moveTo(138,44);bg.lineTo(188,44);bg.moveTo(532,44);bg.lineTo(582,44);bg.stroke();
  const rail=bg.createLinearGradient(0,0,26,0);rail.addColorStop(0,'#b27c37');rail.addColorStop(.45,'#ffec9d');rail.addColorStop(.7,'#ddb25a');rail.addColorStop(1,'#8f552d');
  bg.fillStyle=rail;bg.fillRect(0,0,LEFT,H);bg.save();bg.translate(W,0);bg.scale(-1,1);bg.fillRect(0,0,LEFT,H);bg.restore();
  bg.strokeStyle='#ffe5b19c';bg.lineWidth=2;bg.strokeRect(LEFT,92,RIGHT-LEFT,568);
  for(let side=0;side<2;side++) {
    const points=GUIDES[side];bg.beginPath();bg.moveTo(side?RIGHT:LEFT,0);
    for(const point of points)bg.lineTo(point.x,point.y);
    bg.lineTo(side?RIGHT:LEFT,FLOOR);bg.closePath();bg.fillStyle='#d5a65a';bg.fill();
    bg.beginPath();points.forEach((p,i)=>i?bg.lineTo(p.x,p.y):bg.moveTo(p.x,p.y));bg.strokeStyle='#ffe5a4';bg.lineWidth=5;bg.stroke();
  }
  for(const p of PEGS) {
    bg.beginPath();bg.ellipse(p.x+2,p.y+6,8,6,0,0,Math.PI*2);bg.fillStyle='#42244977';bg.fill();
    const g=bg.createRadialGradient(p.x-2,p.y-3,1,p.x,p.y,PEG_RADIUS+1);g.addColorStop(0,'#ffffff');g.addColorStop(.55,'#fff5da');g.addColorStop(1,'#c399ae');
    bg.beginPath();bg.arc(p.x,p.y,PEG_RADIUS,0,Math.PI*2);bg.fillStyle=g;bg.fill();
    bg.beginPath();bg.arc(p.x-1.4,p.y-2,1.8,0,Math.PI*2);bg.fillStyle='#fff';bg.fill();
  }
  for(let i=0;i<9;i++) {
    const x=LEFT+i*SLOT;const zero=VALUES[i]===0, center=i===4;
    const panel=bg.createLinearGradient(x,0,x+SLOT,0);
    if(zero){panel.addColorStop(0,'#eee0ae');panel.addColorStop(.5,'#fff8cf');panel.addColorStop(1,'#e8d79d');}
    else if(center){panel.addColorStop(0,'#de4131');panel.addColorStop(.5,'#f45435');panel.addColorStop(1,'#c72f2b');}
    else{panel.addColorStop(0,'#ecb63c');panel.addColorStop(.5,'#ffe079');panel.addColorStop(1,'#e5af37');}
    bg.fillStyle=panel;bg.fillRect(x+3,DIVIDER_TOP+4,SLOT-6,FLOOR-DIVIDER_TOP+15);
    bg.save();bg.translate(x+SLOT/2,DIVIDER_TOP+(FLOOR-DIVIDER_TOP)/2+2);bg.rotate(-Math.PI/2);
    bg.fillStyle=center?'#fff4c0':zero?'#a63342':'#8d302d';bg.font=`900 ${center?32:36}px Arial`;bg.textAlign='center';bg.textBaseline='middle';
    bg.fillText(money(VALUES[i]),0,1);bg.restore();
  }
  for(let i=1;i<9;i++){const x=LEFT+i*SLOT;roundRect(bg,x-3.5,DIVIDER_TOP,7,FLOOR-DIVIDER_TOP+10,3.5,'#fff1b3','#be843d',1);}
  const bottom=bg.createLinearGradient(0,797,0,H);bottom.addColorStop(0,'#ffeda2');bottom.addColorStop(.28,'#ebbd5d');bottom.addColorStop(1,'#966331');bg.fillStyle=bottom;bg.fillRect(LEFT,797,RIGHT-LEFT,23);
}
drawBase();

function drawChip(c, ghost = false) {
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle || 0);
  if(ghost)ctx.globalAlpha=.98;
  ctx.shadowColor='#24112788';ctx.shadowBlur=7;ctx.shadowOffsetY=5;
  const g=ctx.createRadialGradient(-7,-8,1,0,0,RADIUS);g.addColorStop(0,'#fff4af');g.addColorStop(.55,'#ffda69');g.addColorStop(1,'#d69325');
  ctx.beginPath();ctx.arc(0,0,RADIUS,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.lineWidth=2.2;ctx.strokeStyle='#fff2ae';ctx.stroke();ctx.beginPath();ctx.arc(0,0,RADIUS-5,0,Math.PI*2);ctx.strokeStyle='#c4832a';ctx.lineWidth=1.1;ctx.stroke();
  ctx.strokeStyle='#a76525';ctx.lineWidth=1;
  for(let i=0;i<20;i++){const a=i*Math.PI/10;ctx.beginPath();ctx.moveTo(Math.cos(a)*16,Math.sin(a)*16);ctx.lineTo(Math.cos(a)*18,Math.sin(a)*18);ctx.stroke();}
  ctx.fillStyle='#a24c27';ctx.font='bold 24px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('$',0,1);ctx.restore();
}
function resizeCanvas() {
  const rect=canvas.getBoundingClientRect(), scale=Math.min(3,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);wake();
}
new ResizeObserver(resizeCanvas).observe(canvas);
// Embedded phone views can expose a layout viewport taller than the visible area.
// Size the game from the visible viewport and the board from its remaining space.
const show = document.querySelector('.show');
const boardSpace = document.querySelector('.board-space');
function fitViewport() {
  const viewport = window.visualViewport;
  const heights = [window.innerHeight, document.documentElement.clientHeight].filter(n => n > 0);
  if (viewport && Math.abs(viewport.scale - 1) < .05 && viewport.height > 0) heights.push(viewport.height);
  const top = Math.max(0, show.getBoundingClientRect().top - (viewport?.offsetTop || 0));
  if (heights.length) show.style.height = Math.max(1, Math.floor(Math.min(...heights) - top)) + 'px';
  fitBoard();
}
function fitBoard() {
  const spaceStyle = getComputedStyle(boardSpace), frame = $('board-frame'), frameStyle = getComputedStyle(frame);
  const px = (style, name) => parseFloat(style[name]) || 0;
  const width = boardSpace.clientWidth - px(spaceStyle, 'paddingLeft') - px(spaceStyle, 'paddingRight');
  const height = boardSpace.clientHeight - px(spaceStyle, 'paddingTop') - px(spaceStyle, 'paddingBottom');
  const frameX = px(frameStyle, 'paddingLeft') + px(frameStyle, 'paddingRight') + px(frameStyle, 'borderLeftWidth') + px(frameStyle, 'borderRightWidth');
  const frameY = px(frameStyle, 'paddingTop') + px(frameStyle, 'paddingBottom') + px(frameStyle, 'borderTopWidth') + px(frameStyle, 'borderBottomWidth');
  const scale = Math.max(0, Math.min((width - frameX) / W, (height - frameY) / H));
  frame.style.width = Math.max(1, Math.floor(W * scale + frameX)) + 'px';
  frame.style.height = Math.max(1, Math.floor(H * scale + frameY)) + 'px';
}
new ResizeObserver(fitBoard).observe(boardSpace);
window.addEventListener('resize', fitViewport);
window.visualViewport?.addEventListener('resize', fitViewport);
window.addEventListener('pageshow', fitViewport);
function draw(now) {
  ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0,W,H);
  if(hitSlot>=0 && now<hitUntil){ctx.save();ctx.globalAlpha=.2+.13*Math.sin(now/110);ctx.fillStyle=hitSlot===4?'#fff5b0':'#fff';ctx.fillRect(LEFT+hitSlot*SLOT+5,DIVIDER_TOP+5,SLOT-10,FLOOR-DIVIDER_TOP-7);ctx.restore();}
  for(const [i,until] of pegFlashes){if(until<now){pegFlashes.delete(i);continue;}const p=PEGS[i];if(!p)continue;ctx.beginPath();ctx.arc(p.x,p.y,PEG_RADIUS+5,0,Math.PI*2);ctx.fillStyle=`rgba(255,243,164,${(until-now)/330})`;ctx.fill();}
  if(active || (physics.chip?.settled && !gameOver && hitSlot>=0)) drawChip(physics.chip);
  if(!active && !gameOver && remaining>0){
    const x=aimX();ctx.save();ctx.strokeStyle='#ffe5a988';ctx.setLineDash([4,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,75);ctx.lineTo(x,108);ctx.stroke();ctx.restore();
    drawChip({x,y:51,angle:0},true);
  }
  for(const p of particles){ctx.save();ctx.globalAlpha=Math.min(1,p.life);ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-3,p.w,6);ctx.restore();}
}
function tick(now) {
  frameId=null;frameTime=now;
  const dt=lastTime?Math.min((now-lastTime)/1000,.045):1/60;lastTime=now;
  const modalOpen=!!document.querySelector('dialog[open]');
  if(active && !document.hidden && !modalOpen){
    accumulator+=dt;
    while(accumulator>=1/180 && active){const landed=physics.step(1/180,ping);accumulator-=1/180;if(landed)onLand(landed);}
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;p.angle+=p.spin*dt;p.life-=dt*.45;if(p.life<=0||p.y>H+10)particles.splice(i,1);}
  draw(now);dirty=false;
  if((active || particles.length || pegFlashes.size || now<hitUntil) && !document.hidden)frameId=requestAnimationFrame(tick);
  else lastTime=0;
}
function aimX(){return LEFT+RADIUS+2+aim*(RIGHT-LEFT-RADIUS*2-4);}
function setAim(value){aim=clamp(value,0,1);$('aim').value=aim*100;$('aim').setAttribute('aria-valuetext',aim<.05?'Far left':aim>.95?'Far right':Math.abs(aim-.5)<.025?'Center':Math.round(aim*100)+'% from the left');wake();}
function updateUI(){
  $('score').textContent=money(total);$('potential').textContent=money(chipsTotal*10000);$('chip-count').textContent=`${remaining} / ${chipsTotal}`;
  $('chips').innerHTML=Array.from({length:chipsTotal},(_,i)=>`<span class="chip ${i<drops.length?'used':i===drops.length&&active?'active':''}" aria-hidden="true">$</span>`).join('');
  $('chips').setAttribute('aria-label',`${remaining} ${remaining===1?'chip':'chips'} remaining${active?', one chip dropping':''}`);
  $('history').innerHTML=Array.from({length:chipsTotal},(_,i)=>{
    const done=i<drops.length,live=i===drops.length&&active;
    return `<li class="${done?(drops[i]===10000?'jackpot':''):live?'live':'waiting'}"><span>Chip ${String(i+1).padStart(2,'0')}</span><strong>${done?money(drops[i]):live?'In play…':'—'}</strong></li>`;
  }).join('');
  $('drop').disabled=active;$('drop-label').textContent=active?'HERE IT GOES…':gameOver?'PLAY AGAIN':'DROP CHIP';
  $('aim').disabled=active||gameOver;$('mode-label').textContent=mode==='quick'?'FIVE-CHIP QUICK PLAY':'THE PRICING ROUND';
}
function setStatus(text){$('status').textContent=text;}
function newGame(count=5,newMode='quick'){
  cancelTimers();active=false;gameOver=false;pointerId=null;releaseToDrop=false;chipsTotal=count;remaining=count;total=0;drops=[];mode=newMode;
  physics.chip=null;hitSlot=-1;hitUntil=0;accumulator=0;particles.length=0;pegFlashes.clear();
  $('board-callout').classList.remove('visible','jackpot');$('board-frame').classList.remove('hit');
  setAim(.5);updateUI();setStatus(count===5?'Five chips. The board is yours.':`${count} ${count===1?'chip. Make it count.':'chips. The board is yours.'}`);wake();
}
function drop(){
  if(active || document.querySelector('dialog[open]'))return;
  initAudio();
  if(gameOver){newGame();return;}
  if(remaining<=0)return;
  clearTimeout(calloutTimer);$('board-callout').classList.remove('visible','jackpot');hitSlot=-1;
  active=true;remaining--;accumulator=0;physics.drop(aimX());
  tone(780,.15,.18,0,'sine',240);updateUI();setStatus(`Chip ${drops.length+1} is on its way…`);wake();
}
function confetti(big){
  if(reducedMotion.matches)return;
  const colors=['#ffdb65','#fff6bd','#e979ab','#58c4b3','#ef584a'];
  for(let i=0;i<(big?105:35);i++)particles.push({x:W/2+(Math.random()-.5)*200,y:H*.45,vx:(Math.random()-.5)*500,vy:-50-Math.random()*320,angle:Math.random()*6.28,spin:(Math.random()-.5)*10,w:5+Math.random()*8,life:1+Math.random()*.4,color:colors[i%colors.length]});
}
function onLand(result){
  active=false;
  if(result.stuck){remaining++;physics.chip=null;setStatus('A stuck chip! You get a free re-drop.');updateUI();wake();return;}
  drops.push(result.value);total+=result.value;hitSlot=result.slot;hitUntil=frameTime+1900;
  gameOver=remaining===0;updateUI();winSound(result.value);
  $('score').classList.remove('flash');void $('score').offsetWidth;$('score').classList.add('flash');
  $('board-frame').classList.add('hit');later(()=>$('board-frame').classList.remove('hit'),1500);
  $('callout-label').textContent=result.value===10000?'TEN THOUSAND!':result.value===0?'SO CLOSE!':'ON THE BOARD!';
  $('callout-value').textContent=money(result.value);$('board-callout').classList.toggle('jackpot',result.value===10000);$('board-callout').classList.add('visible');
  calloutTimer=later(()=>{$('board-callout').classList.remove('visible');hitSlot=-1;physics.chip=null;wake();},2200);
  if(result.value>0)confetti(result.value===10000);
  setStatus(result.value===10000?`$10,000! ${gameOver?'What a finish!':remaining+' '+(remaining===1?'chip':'chips')+' to go.'}`:result.value===0?`No score on that chip. ${gameOver?'Your game is complete.':'Try another spot!'}`:`${money(result.value)} added! ${gameOver?'Your game is complete.':remaining+' '+(remaining===1?'chip':'chips')+' to go.'}`);
  if(gameOver)resultTimer=later(showResults,result.value===10000?2400:1800);
}
function showResults(){
  $('final-score').textContent=money(total);
  $('result-title').textContent=total>=10000?'Now that’s Plinko!':total>0?'Look at that!':'The board had other plans.';
  $('result-subtitle').textContent=`${chipsTotal} ${chipsTotal===1?'chip':'chips'}. ${drops.filter(x=>x===10000).length?drops.filter(x=>x===10000).length+' in the $10,000 slot.':'Every bounce a possibility.'}`;
  $('result-drops').innerHTML=drops.map(n=>`<span class="${n===10000?'big-win':''}">${money(n)}</span>`).join('');
  if(!document.querySelector('dialog[open]'))$('results-dialog').showModal();
}

const PRIZES=[
  {name:'Two-slice toaster',description:'A compact toaster with a removable crumb tray.',price:42},
  {name:'Electric kettle',description:'A 1.7-liter kettle with automatic shutoff.',price:36},
  {name:'Mini waffle maker',description:'A small waffle maker for a big breakfast.',price:24},
  {name:'Cordless hand mixer',description:'A rechargeable mixer with three speed settings.',price:67},
  {name:'Digital kitchen scale',description:'A glass-top scale with a clear digital display.',price:28},
  {name:'Insulated travel mug',description:'A 20-ounce stainless-steel mug with a leak-resistant lid.',price:31},
  {name:'Tabletop fan',description:'A compact fan with three speeds and a tilting head.',price:46},
  {name:'Popcorn maker',description:'A hot-air popper for movie-night popcorn.',price:38},
  {name:'Rechargeable lantern',description:'A dimmable camping lantern with a carry handle.',price:53},
  {name:'Personal blender',description:'A single-serve blender with two travel cups.',price:59},
  {name:'Electric citrus juicer',description:'A countertop juicer with a removable pitcher.',price:47},
  {name:'Pour-over coffee set',description:'A glass coffee server with a reusable stainless-steel filter.',price:34}
];
function showPricingIntro(){
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  clearTimeout(resultTimer);
  $('pricing-content').innerHTML=`<span class="eyebrow">FIRST, A LITTLE PRICE GUESSING</span><h2>Earn your way<br>to the board.</h2><p class="intro-copy">One chip is on the house. Win up to four more by choosing the correct digit in each prize’s price.</p><div class="rule"><b>1</b><p>Two digits are shown. <strong>Only one is correct</strong> in its position. Pick the first or last digit.</p></div><div class="rule"><b>+1</b><p>Each correct guess earns another chip to drop for up to <strong>$10,000</strong>.</p></div><button id="start-pricing" class="primary">LET’S GUESS SOME PRICES</button><button class="secondary" data-close="pricing-dialog">BACK TO THE BOARD</button><p class="mini-note">Starts a new game. Prices are sample game values.</p>`;
  $('start-pricing').addEventListener('click',startPricing);$('pricing-dialog').showModal();
}
function startPricing(){
  initAudio();newGame(1,'pricing');prizeWins=0;pricingIndex=0;
  const pool=[...PRIZES];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  pricingQuestions=pool.slice(0,4).map(p=>{const correct=Math.random()<.5?0:1,digits=String(p.price).split('');const wrong=1-correct;let next;do{next=String(Math.floor(Math.random()*(wrong===0?9:10))+(wrong===0?1:0));}while(next===digits[wrong]);digits[wrong]=next;return{...p,correct,digits};});
  renderQuestion();tone(523,.1,.2);tone(784,.2,.2,.1);
}
function renderQuestion(){
  pricingAnswered=false;const q=pricingQuestions[pricingIndex];
  $('pricing-content').innerHTML=`<div class="pricing-status"><span>PRIZE ${pricingIndex+1} OF 4</span><strong>${chipsTotal} ${chipsTotal===1?'CHIP':'CHIPS'} EARNED</strong></div><h2 class="prize-name">${q.name}</h2><p class="prize-description">${q.description}</p><span class="prize-tag">SAMPLE PRIZE · GAME PRICE</span><p class="pricing-prompt">Which digit is correct in its position?</p><div class="digits"><span class="price-dollar">$</span><button class="digit-button" data-digit="0" aria-label="First digit, ${q.digits[0]}">${q.digits[0]}<small>FIRST</small></button><button class="digit-button" data-digit="1" aria-label="Last digit, ${q.digits[1]}">${q.digits[1]}<small>LAST</small></button></div><p id="price-reveal" class="price-reveal" role="status">Pick a digit to reveal the price.</p><button class="primary" id="next-prize" hidden>${pricingIndex===3?'TAKE YOUR CHIPS TO THE BOARD':'NEXT PRIZE'}</button>`;
  $('pricing-content').querySelectorAll('[data-digit]').forEach(b=>b.addEventListener('click',()=>answerPrice(Number(b.dataset.digit))));
  $('next-prize').addEventListener('click',()=>{if(pricingIndex<3){pricingIndex++;renderQuestion();$('pricing-content').querySelector('[data-digit]').focus();}else finishPricing();});
}
function answerPrice(choice){
  if(pricingAnswered)return;pricingAnswered=true;initAudio();const q=pricingQuestions[pricingIndex],correct=choice===q.correct;
  $('pricing-content').querySelectorAll('[data-digit]').forEach(b=>{b.disabled=true;b.classList.add(Number(b.dataset.digit)===q.correct?'correct':'wrong');});
  if(correct){prizeWins++;chipsTotal++;remaining++;tone(659,.16,.25);tone(1046,.28,.25,.1);}else{tone(220,.18,.18,0,'triangle',165);}
  const r=$('price-reveal');r.classList.toggle('miss',!correct);r.innerHTML=`<strong>${correct?'That’s right! You earned a chip.':'Not this time. Keep that free chip!'}</strong>The game price is ${money(q.price)}.`;
  if(!correct && chipsTotal>1)r.innerHTML=`<strong>Not this time. Your chips are safe.</strong>The game price is ${money(q.price)}.`;
  $('next-prize').hidden=false;$('next-prize').focus();updateUI();
}
function finishPricing(){
  $('pricing-dialog').close();setStatus(`${chipsTotal} ${chipsTotal===1?'chip':'chips'} earned. Let’s make ${chipsTotal===1?'it':'them'} count!`);$('drop').focus();wake();
}

$('aim').addEventListener('input',e=>{if(!active&&!gameOver)setAim(Number(e.target.value)/100);});
$('drop').addEventListener('click',drop);
canvas.addEventListener('pointerdown',e=>{
  if(active||gameOver||pointerId!==null||e.button!==0||document.querySelector('dialog[open]'))return;
  initAudio();pointerId=e.pointerId;
  const rect=canvas.getBoundingClientRect();
  releaseToDrop=(e.clientY-rect.top)/rect.height*H<=91;
  canvas.setPointerCapture(pointerId);pointerAim(e);
  if(releaseToDrop)setStatus('Release to drop your chip.');
});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointerId&&!active)pointerAim(e);});
function releasePointer(e){
  if(e.pointerId!==pointerId)return;
  const launch=releaseToDrop&&e.type==='pointerup';
  pointerId=null;releaseToDrop=false;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(launch)drop();else if(!active&&!gameOver)setStatus('Aim your chip, then tap Drop chip.');
}
canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('lostpointercapture',releasePointer);
function pointerAim(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;setAim((x-LEFT-RADIUS-2)/(RIGHT-LEFT-RADIUS*2-4));}
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
  const tag=document.activeElement?.tagName;
  if((e.code==='ArrowLeft'||e.code==='ArrowRight')&&tag!=='INPUT'&&!active&&!gameOver){e.preventDefault();setAim(aim+(e.code==='ArrowRight'?.025:-.025));}
  if(e.code==='Space'&&tag!=='BUTTON'&&tag!=='A'&&tag!=='INPUT'){e.preventDefault();drop();}
});
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound').title=soundOn?'Sound on':'Sound off';if(soundOn){initAudio();if(mainGain)mainGain.gain.value=.24;tone(784,.1,.2);}else if(mainGain)mainGain.gain.value=0;});
$('help').addEventListener('click',()=>{$('help-dialog').showModal();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)$(b.dataset.close).close();});
for(const d of document.querySelectorAll('dialog')){
  d.addEventListener('close',()=>{lastTime=0;accumulator=0;if(gameOver&&d.id!=='results-dialog'&&d.id!=='reset-dialog'&&!document.querySelector('dialog[open]'))resultTimer=later(showResults,350);wake();});
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
}
$('pricing').addEventListener('click',showPricingIntro);$('mobile-pricing').addEventListener('click',showPricingIntro);$('result-pricing').addEventListener('click',showPricingIntro);
$('new-game').addEventListener('click',()=>{if(active||drops.length)$('reset-dialog').showModal();else{initAudio();newGame();}});
$('confirm-reset').addEventListener('click',()=>{$('reset-dialog').close();newGame();});
$('replay').addEventListener('click',()=>{$('results-dialog').close();initAudio();newGame();$('drop').focus();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{setStatus('Full screen isn’t available in this view.');}});
if(!document.fullscreenEnabled)$('fullscreen').hidden=true;
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;if(document.hidden){if(audioContext?.state==='running')audioContext.suspend().catch(()=>{});}else{if(soundOn&&audioContext)initAudio();wake();}});
newGame();fitViewport();resizeCanvas();
