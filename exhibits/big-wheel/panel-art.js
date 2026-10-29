import {WHEEL_DIGITS} from './wheel-digits.js?v=20';

// Show reference: red glitter 100 on black, green glitter 5/15 on light green,
// cream ordinary numerals, gold numeral outlines, and narrow silver separators.
// https://www.cbsnews.com/news/drew-carey-the-price-is-right/
const materials=new Map();
function flecked(g,name,base,colors){
 if(!g.createPattern)return base;
 if(materials.has(name))return materials.get(name);
 const tile=document.createElement('canvas');tile.width=tile.height=64;
 const p=tile.getContext('2d');p.fillStyle=base;p.fillRect(0,0,64,64);
 let seed=7813;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<1300;i++){
  const x=random()*64,y=random()*64,size=.3+random()*.9;
  p.fillStyle=colors[i%colors.length];p.fillRect(x,y,size,size*.65);
 }
 const pattern=g.createPattern(tile,'repeat')||base;materials.set(name,pattern);return pattern;
}
function numeralPath(g,value){
 const digits=String(value).split('').map(d=>WHEEL_DIGITS[d]),sy=140/1792,sx=sy*1.35,gap=12;
 let x=320-(digits.reduce((sum,d)=>sum+d.width,0)*sx+gap*(digits.length-1))/2;
 g.beginPath();
 for(const digit of digits){
  for(const [op,...points]of digit.path){
   const p=points.map((v,i)=>i%2?159-v*sy:x+v*sx);
   if(op==='M')g.moveTo(...p);else if(op==='L')g.lineTo(...p);
   else if(op==='C')g.bezierCurveTo(...p);else if(op==='Q')g.quadraticCurveTo(...p);else g.closePath();
  }
  x+=digit.width*sx+gap;
 }
}
export function paintPanel(g,value,width,height,reward=null){
 g.save();g.scale(width/640,height/180);
 const dollar=value===100,green=value===5||value===15;
 const face=g.createLinearGradient(0,0,0,180);
 for(const [stop,color]of green?[[0,'#9bbd61'],[.45,'#87ac50'],[1,'#6b903f']]:[[0,'#20211e'],[.35,'#11120f'],[1,'#070806']])face.addColorStop(stop,color);
 g.fillStyle=face;g.fillRect(0,0,640,180);
 const silver=flecked(g,'silver','#a6adae',['#eef0e6','#d3d8d8','#7b8587']);
 g.fillStyle=silver;g.fillRect(0,0,640,4);g.fillRect(0,176,640,4);
 g.fillStyle='#ffffff66';g.fillRect(0,1,640,1);
 numeralPath(g,value);g.lineJoin='round';
 // Raised cut-out numbers have a gold edge and a dark inset, as on the prop.
 g.strokeStyle=flecked(g,'gold','#be9c48',['#f4e5a0','#dbc06b','#93752d']);g.lineWidth=16;
 g.shadowColor='#0009';g.shadowBlur=2;g.shadowOffsetY=3;g.stroke();
 g.shadowBlur=0;g.shadowOffsetY=0;g.strokeStyle='#161911';g.lineWidth=7;g.stroke();
 g.fillStyle=dollar?flecked(g,'red','#d51624',['#ff6551','#ed382b','#960717','#ffb5a0']):green?flecked(g,'green','#079b70',['#66e4b2','#15ba88','#005e4e','#a4e9c6']):'#f8f5df';g.fill();
 if(reward&&!dollar&&!green){
  g.fillStyle='#edd084';g.fillRect(25,57,80,62);g.fillStyle='#172535';g.textAlign='center';g.textBaseline='middle';g.font='800 25px Arial, sans-serif';g.fillText(reward.kind==='coins'?'+$50':reward.claimed?'+1':'FREE',65,80);g.font='700 13px Arial, sans-serif';g.fillText(reward.claimed?(reward.kind==='coins'?'BANKED':'SAVED'):(reward.kind==='coins'?'BONUS':'SPIN'),65,106);
 }
 g.restore();
}
