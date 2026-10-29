import {project} from './wheel-fallback.js?v=22';

// The same camera as the wheel, including object-fit letterboxing and the
// landed facet's small offset from the pointer. Coordinates are CSS pixels.
export function payoutPath(wheel,bank,position,viewportWidth){
 const scale=Math.min(wheel.width/760,wheel.height/840);
 const angle=(position-Math.round(position))*Math.PI/10;
 const panel=project([0,Math.sin(angle)*3.12,Math.cos(angle)*3.12]);
 const clamp=x=>Math.max(104,Math.min(viewportWidth-104,x));
 return {
  x:clamp(wheel.left+(wheel.width-760*scale)/2+panel.x*scale),
  y:wheel.top+(wheel.height-840*scale)/2+panel.y*scale,
  bankX:bank.left+bank.width/2,bankY:bank.top+bank.height/2,
  restingX:clamp(bank.left+bank.width/2),restingY:bank.bottom+25,
 };
}

// Pure presentation: never writes a wallet, awards a prize, or blocks controls.
export class PayoutFlight{
 constructor({get,position,reduced,onArrive=()=>{},delay=(f,ms)=>globalThis.setTimeout(f,ms),clearDelay=id=>globalThis.clearTimeout(id)}){
  Object.assign(this,{get,position,reduced,onArrive,delay,clearDelay});
  this.pending=[];this.batch=0;this.arrival=0;this.finish=0;this.generation=0;
 }
 deposit(event,{celebrate=true,label='Score prize'}={}){
  if(event.delta<=0||!['payout','bonus'].includes(event.kind))return false;
  this.pending.push({amount:event.delta,celebrate,label});
  if(!this.batch)this.batch=this.delay(()=>{this.batch=0;this.flush();},40);
  return true;
 }
 geometry(){
  const wheel=this.get('wheel').getBoundingClientRect(),bank=this.get('bank-amount').getBoundingClientRect();
  if(!wheel.width||!wheel.height||!bank.width||this.get('bank-amount').hidden)return null;
  return payoutPath(wheel,bank,this.position(),globalThis.innerWidth||wheel.right||wheel.width);
 }
 place(path){
  const style=this.get('payout-flight').style;
  for(const [key,value]of Object.entries(path))style.setProperty('--'+key,value+'px');
 }
 clearVisual(){
  this.generation++;this.clearDelay(this.arrival);this.clearDelay(this.finish);
  this.arrival=this.finish=0;this.get('payout-flight').hidden=true;
  this.get('bank-amount').removeAttribute('data-collected');
 }
 flush(){
  const entries=this.pending.splice(0);if(!entries.length)return;
  this.clearVisual();const path=this.geometry();if(!path)return;
  const total=entries.reduce((sum,e)=>sum+e.amount,0),celebrate=entries.at(-1).celebrate;
  const labels=[...new Set(entries.map(e=>e.label))];
  this.place(path);const layer=this.get('payout-flight'),bank=this.get('bank-amount');
  layer.setAttribute('data-mode',this.reduced?'static':'deposit');
  layer.setAttribute('data-tone',celebrate?'gold':'quiet');
  this.get('payout-amount').textContent='+$'+total.toLocaleString();
  this.get('payout-label').textContent=labels.length>1?'Score + bonus · banked':labels[0]+' · banked';
  this.get('payout-coins').hidden=this.reduced||!celebrate;
  void layer.offsetWidth;layer.hidden=false;
  const generation=this.generation;
  const arrive=()=>{if(this.generation!==generation)return;bank.setAttribute('data-collected',celebrate?'gold':'quiet');if(celebrate&&!this.reduced)this.onArrive();};
  if(this.reduced)arrive();else this.arrival=this.delay(arrive,1170);
  this.finish=this.delay(()=>{if(this.generation===generation)this.clearVisual();},this.reduced?1800:2100);
 }
 landed(value){
  if(this.pending.length||this.reduced)return;
  this.clearVisual();const path=this.geometry();if(!path)return;
  this.place(path);const layer=this.get('payout-flight');
  layer.setAttribute('data-mode','score');layer.setAttribute('data-tone','quiet');
  this.get('payout-amount').textContent=value===100?'$1.00':value+'¢';
  this.get('payout-label').textContent='On the wheel';this.get('payout-coins').hidden=true;
  void layer.offsetWidth;layer.hidden=false;
  this.finish=this.delay(()=>this.clearVisual(),1250);
 }
 clear(){this.clearDelay(this.batch);this.batch=0;this.pending=[];this.clearVisual();}
}
