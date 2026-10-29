import {paintPanel} from './panel-art.js?v=22';
// Perspective-projected 3D geometry. All faces share the same camera and depth buffer order.
const TAU=Math.PI*2,R=3.12,HALF=1.68,YAW=.42,DIST=12,F=1140;
const C=Math.cos(YAW),S=Math.sin(YAW);
export function project([x,y,z]){const depth=S*x+C*z,k=F/(DIST-depth);return {x:426+(C*x-S*z)*k,y:385+y*k,z:depth};}
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const normal=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return n.map(v=>v/l);};
function texture(value,reward){const t=document.createElement('canvas');t.width=640;t.height=150;paintPanel(t.getContext('2d'),value,640,150,reward);return t;}
function tri(ctx,img,src,dst){const[a,b,c]=src,[p,q,r]=dst;const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<.001)return;const aa=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det,bb=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det,cc=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det,dd=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;ctx.save();const mx=(p.x+q.x+r.x)/3,my=(p.y+q.y+r.y)/3;ctx.beginPath();for(const[v,i]of[[p,0],[q,1],[r,2]]){const dx=v.x-mx,dy=v.y-my,l=Math.hypot(dx,dy),x=v.x+dx/l*.45,y=v.y+dy/l*.45;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.clip();ctx.transform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);ctx.drawImage(img,0,0);ctx.restore();}
function mapTexture(ctx,img,points){const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);const point=(u,v)=>project(lerp(lerp(points[0],points[1],u),lerp(points[3],points[2],u),v));const cols=6,rows=2;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let u=x/cols,v=y/rows,U=(x+1)/cols,V=(y+1)/rows;const d=[point(u,v),point(U,v),point(U,V),point(u,V)],s=[{x:u*640,y:v*150},{x:U*640,y:v*150},{x:U*640,y:V*150},{x:u*640,y:V*150}];tri(ctx,img,[s[0],s[1],s[2]],[d[0],d[1],d[2]]);tri(ctx,img,[s[0],s[2],s[3]],[d[0],d[2],d[3]]);}}
export function makeWheelRenderer(ctx,values){let textures=values.map(v=>texture(v)),rewardKey='';return function draw(position,kick=0,rewards=[]){const key=rewards.map(r=>r.value+':'+r.kind+':'+Boolean(r.claimed)).join(',');if(key!==rewardKey){rewardKey=key;textures=values.map(v=>texture(v,rewards.find(r=>r.value===v)));}ctx.clearRect(0,0,760,840);const faces=[];
 function face(points,color,metal=false,tex=null){const n=normal(...points),center=points[0].map((_,i)=>points.reduce((s,p)=>s+p[i],0)/points.length),view=[DIST*S-center[0],-center[1],DIST*C-center[2]];if(dot(n,view)<=0)return;const diffuse=Math.max(0,dot(n,[-.35,-.6,.72])),spec=Math.pow(Math.max(0,dot(n,[-.12,-.25,.96])),18);faces.push({points,color,tex,shade:metal?.37+.55*diffuse+.75*spec:.6+.4*diffuse,depth:project(center).z});}
 function ring(x1,x2,r1,r2,segments=80){for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU;const p=(x,r,t)=>[x,Math.sin(t)*r,Math.cos(t)*r];const pts=[p(x1,r1,a),p(x1,r1,b),p(x2,r2,b),p(x2,r2,a)],aim=x1===x2?[1,0,0]:[0,Math.sin((a+b)/2),Math.cos((a+b)/2)];if(dot(normal(...pts),aim)<0)pts.reverse();face(pts,[195,205,216],true);}}
 function cap(x,r,color){face(Array.from({length:80},(_,i)=>{const a=-i/80*TAU;return[x,Math.sin(a)*r,Math.cos(a)*r];}),color,true);}
 function box(x,y,z,w,h,d,color){const p=[[x-w/2,y-h/2,z-d/2],[x+w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z-d/2],[x-w/2,y+h/2,z-d/2],[x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2]];for(const ids of[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[0,1,5,4],[7,6,2,3]])face(ids.map(i=>p[i]),color,true);}
 // A grounded support and axle behind the drum.
 const shadow=ctx.createRadialGradient(382,782,15,382,782,260);shadow.addColorStop(0,'#010713b0');shadow.addColorStop(1,'#01071300');ctx.save();ctx.translate(0,580);ctx.scale(1,.26);ctx.fillStyle=shadow;ctx.fillRect(70,500,650,550);ctx.restore();
 box(0,3.67,-.4,4.6,.3,2.4,[110,120,139]);box(-1.95,1.65,-.6,.35,4,1,[147,155,166]);box(1.95,1.65,-.6,.35,4,1,[147,155,166]);
 // Twenty rigid numbered facets around a cylinder; the side plates rotate with it.
 for(let n=0;n<20;n++){const a=(n+position)*Math.PI/10-Math.PI/20,b=a+Math.PI/10;face([[-HALF,Math.sin(a)*R,Math.cos(a)*R],[HALF,Math.sin(a)*R,Math.cos(a)*R],[HALF,Math.sin(b)*R,Math.cos(b)*R],[-HALF,Math.sin(b)*R,Math.cos(b)*R]],[255,255,255],false,textures[n]);}
 // Solid side plate, recessed concentric rings and chamfered chrome edges.
 cap(HALF+.11,R,[57,65,76]);cap(HALF+.14,R*.88,[27,34,43]);
 ring(HALF+.15,HALF+.19,R*.89,R*.88);ring(HALF+.2,HALF+.2,R*.72,R*.74);
 for(const x of[-HALF,HALF]){ring(x-.07,x-.025,R-.01,R+.075);ring(x-.025,x+.045,R+.075,R+.075);ring(x+.045,x+.095,R+.075,R-.01);}
 cap(HALF+.32,.38,[212,218,225]);ring(HALF+.14,HALF+.32,.38,.38);
 // Raised grip blocks on both rims are attached to the rotating geometry.
 for(let n=0;n<20;n++){const a=(n+position+.5)*Math.PI/10;for(const x of[-HALF-.04,HALF+.04])box(x,Math.sin(a)*(R+.08),Math.cos(a)*(R+.08),.12,.12,.12,[231,226,204]);}
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){const ps=f.points.map(project);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(f.tex){ctx.fillStyle='#171b21';ctx.fill();mapTexture(ctx,f.tex,f.points);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(0,0,0,'+Math.max(0,1-f.shade)+')';ctx.fill();}else{ctx.fillStyle='rgb('+f.color.map(v=>Math.min(255,Math.round(v*f.shade))).join(',')+')';ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.5;ctx.stroke();}}
 // Same flexible tip and contact displacement as the WebGL renderer.
 const leaf=(x,y=0)=>project([-HALF-.72+x,y-kick*.70*(x/.72)**2,R+.22]);
 function polygon(points,fill,stroke=null){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
 for(let i=0;i<8;i++){const x=.04+i*.052,X=x+.052;polygon([leaf(x,-.025),leaf(X,-.025),leaf(X,.025),leaf(x,.025)],'#d9eaf5');}
 polygon([leaf(.43,-.145),leaf(.72),leaf(.43,.145)],'#f5394a','#e0edf6');
 };}
