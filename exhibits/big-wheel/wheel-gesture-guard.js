// Keep a wheel gesture from becoming a tap on the dock after pointer release.
export class WheelGestureGuard{
 constructor(dock,{delay=(fn,ms)=>globalThis.setTimeout(fn,ms),cancel=id=>globalThis.clearTimeout(id)}={}){
  this.dock=dock;this.delay=delay;this.cancel=cancel;this.timer=0;this.locked=false;
  for(const type of ['pointerdown','pointerup','click','dblclick','contextmenu'])dock.addEventListener(type,event=>{
   if(!this.locked)return;
   event.preventDefault();event.stopImmediatePropagation();
  },{capture:true,passive:false});
 }
 setLocked(value){
  this.locked=value;this.dock.inert=value;
  if(value)this.dock.setAttribute('data-wheel-gesture','true');
  else this.dock.removeAttribute('data-wheel-gesture');
 }
 begin(){this.cancel(this.timer);this.timer=0;this.setLocked(true);}
 release(){
  if(!this.locked)return;
  this.cancel(this.timer);
  this.timer=this.delay(()=>{this.timer=0;this.setLocked(false);},450);
 }
 reset(){this.cancel(this.timer);this.timer=0;this.setLocked(false);}
}
