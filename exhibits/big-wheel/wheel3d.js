import {paintPanel} from './panel-art.js?v=22';
import {makeWheelRenderer as fallback} from './wheel-fallback.js?v=22';
const TAU=Math.PI*2,R=3.12,HALF=1.68,YAW=.42,DIST=12,F=1140;
const C=Math.cos(YAW),S=Math.sin(YAW);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const normal=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return n.map(v=>v/l);};
const project=([x,y,z])=>({z:S*x+C*z});
export function makeWheelRenderer(canvas,values){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
 if(!gl){const paint=fallback(canvas.getContext('2d'),values);return (p,k,rewards)=>{canvas.getContext('2d').setTransform(canvas.width/760,0,0,canvas.height/840,0,0);paint(p,k,rewards);};}
 const vs=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(vs,`
 attribute vec3 aPosition;attribute vec3 aColor;attribute vec2 aUV;
 attribute vec3 aNormal;attribute float aMetal;
 varying vec3 color;varying vec2 uv;varying vec3 world;varying vec3 normal;varying float metal;
 void main(){float x=.91308894*aPosition.x-.40776045*aPosition.z;
 float z=.40776045*aPosition.x+.91308894*aPosition.z;float w=12.0-z;
 gl_Position=vec4((426.0*2.0/760.0-1.0)*w+1140.0*x*2.0/760.0,
 (1.0-385.0*2.0/840.0)*w-1140.0*aPosition.y*2.0/840.0,31.0/29.0*w-60.0/29.0,w);
 color=aColor;uv=aUV;world=aPosition;normal=aNormal;metal=aMetal;}`);gl.compileShader(vs);
 const fs=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(fs,`
 precision mediump float;
 varying vec3 color;varying vec2 uv;varying vec3 world;varying vec3 normal;varying float metal;
 uniform sampler2D atlas;
 void main(){
 vec3 N=normalize(normal),V=normalize(vec3(4.8931254,0.0,10.957067)-world);
 vec3 key=normalize(vec3(-.6,-.8,.95)),fill=normalize(vec3(1.0,-.2,.6));
 float diffuse=max(0.0,dot(N,key)),bounce=max(0.0,dot(N,fill));
 vec4 base=uv.x<0.0?vec4(color,1.0):texture2D(atlas,uv)*vec4(color,1.0);
 vec3 lit=base.rgb*(.43+.55*diffuse+.16*bounce);
 if(metal>.5){
  vec3 r=reflect(-V,N);
  // Broad overhead studio light and two tall softbox reflections on real geometry.
  float stripA=exp(-pow((r.x+.32)/.17,2.0)-pow((r.y+.36)/.82,4.0));
  float stripB=exp(-pow((r.x-.36)/.075,2.0)-pow(r.y/.78,4.0));
  float ceiling=smoothstep(.0,.88,-r.y);
  vec3 environment=vec3(.09,.14,.20)+vec3(.36,.44,.53)*ceiling;
  environment+=vec3(.82,.80,.77)*stripA+vec3(.48,.70,.89)*stripB;
  float fresnel=pow(1.0-max(0.0,dot(N,V)),3.0);
  lit=base.rgb*(environment+.16+.12*diffuse)+vec3(.13,.2,.26)*fresnel;
  float brush=sin(world.y*180.0+sin(world.z*31.0)*.4)*.004;
  lit+=vec3(brush);
 }else{
  float gloss=pow(max(0.0,dot(N,normalize(key+V))),60.0);
  float row=180.0/1024.0;
  lit+=vec3(.20,.24,.27)*gloss;
  if(uv.x>=0.0){float rim=smoothstep(1.35,1.68,abs(world.x));lit*=1.0-rim*.12;
   // The three special numeral faces catch the studio light without rainbow effects.
   if((uv.y<row&&uv.x<.5)||(uv.y>4.0*row&&uv.y<5.0*row&&uv.x>.75)){lit+=base.rgb*.14;}}
 }
 gl_FragColor=vec4(clamp(lit,0.0,1.0),base.a);
 }`);gl.compileShader(fs);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D shader could not initialize: '+gl.getProgramInfoLog(program));gl.useProgram(program);
 const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;const g=atlas.getContext('2d');
 let rewardKey='';
 function paintAtlas(rewards=[]){values.forEach((value,i)=>{g.save();g.translate(i%4*512,Math.floor(i/4)*180);paintPanel(g,value,512,180,rewards.find(r=>r.value===value));g.restore();});}
 paintAtlas();
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const[name,size,offset]of[['aPosition',3,0],['aColor',3,12],['aUV',2,24],['aNormal',3,32],['aMetal',1,44]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,48,offset);}gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
 const textures=values.map((_,i)=>i+1);let bufferCapacity=0,vertexData=new Float32Array(0);
 return function draw(position,kick=0,rewards=[]){const key=rewards.map(r=>r.value+':'+r.kind+':'+Boolean(r.claimed)).join(',');if(key!==rewardKey){rewardKey=key;paintAtlas(rewards);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);}const faces=[];
 function face(points,color,metal=false,tex=null,normals=null){
 const n=normal(...points),center=points[0].map((_,i)=>points.reduce((s,p)=>s+p[i],0)/points.length),view=[DIST*S-center[0],-center[1],DIST*C-center[2]];
 if(dot(n,view)<=0)return;faces.push({points,color,tex,n,metal,normals});}

 function ring(x1,x2,r1,r2,segments=80){for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU;const p=(x,r,t)=>[x,Math.sin(t)*r,Math.cos(t)*r];const pts=[p(x1,r1,a),p(x1,r1,b),p(x2,r2,b),p(x2,r2,a)],aim=x1===x2?[1,0,0]:[0,Math.sin((a+b)/2),Math.cos((a+b)/2)];if(dot(normal(...pts),aim)<0)pts.reverse();const side=x1===x2;face(pts,[201,216,230],true,null,side?null:pts.map(p=>{const r=Math.hypot(p[1],p[2]);const dr=r2-r1,dx=x2-x1,l=Math.hypot(dr,dx);return [-dr/l,dx/l*p[1]/r,dx/l*p[2]/r];}));}}
 function cap(x,r,color,y=0,z=0,segments=80){face(Array.from({length:segments},(_,i)=>{const a=-i/segments*TAU;return[x,y+Math.sin(a)*r,z+Math.cos(a)*r];}),color,true);}
 function box(x,y,z,w,h,d,color){const p=[[x-w/2,y-h/2,z-d/2],[x+w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z-d/2],[x-w/2,y+h/2,z-d/2],[x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2]];for(const ids of[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[0,1,5,4],[7,6,2,3]])face(ids.map(i=>p[i]),color,true);}
 // A grounded support and axle behind the drum.
 box(0,3.67,-.4,4.6,.3,2.4,[110,120,139]);box(-1.95,1.65,-.6,.35,4,1,[147,155,166]);box(1.95,1.65,-.6,.35,4,1,[147,155,166]);
 // Twenty rigid numbered facets around a cylinder; the side plates rotate with it.
 for(let n=0;n<20;n++){const a=(n+position)*Math.PI/10-Math.PI/20,b=a+Math.PI/10;face([[-HALF,Math.sin(a)*R,Math.cos(a)*R],[HALF,Math.sin(a)*R,Math.cos(a)*R],[HALF,Math.sin(b)*R,Math.cos(b)*R],[-HALF,Math.sin(b)*R,Math.cos(b)*R]],[255,255,255],false,textures[n]);}
 // Solid side plate, recessed concentric rings and chamfered chrome edges.
 cap(HALF+.11,R,[122,137,150]);cap(HALF+.14,R*.88,[57,73,88]);
 ring(HALF+.15,HALF+.19,R*.89,R*.88);ring(HALF+.2,HALF+.2,R*.72,R*.74);ring(HALF+.21,HALF+.21,R*.44,R*.452);
 for(const x of[-HALF,HALF]){ring(x-.07,x-.025,R-.01,R+.075);ring(x-.025,x+.045,R+.075,R+.075);ring(x+.045,x+.095,R+.075,R-.01);}
 cap(HALF+.32,.38,[196,212,225]);ring(HALF+.14,HALF+.32,.38,.38);
 cap(HALF+.335,.25,[125,151,174]);cap(HALF+.34,.13,[219,229,238]);
 // Fasteners sit proud of the rotating side plate, with a recessed center.
 for(let i=0;i<10;i++){const a=(i/10+position/20)*TAU,y=Math.sin(a)*R*.81,z=Math.cos(a)*R*.81;
 cap(HALF+.22,.065,[211,224,235],y,z,10);cap(HALF+.224,.023,[35,45,58],y,z,8);}

 // Raised grip blocks on both rims are attached to the rotating geometry.
 for(let n=0;n<20;n++){const a=(n+position+.5)*Math.PI/10;
 for(const x of[-HALF-.04,HALF+.04]){
 const p=[[-.065,-.095,-.045],[.065,-.095,-.045],[.065,.095,-.045],[-.065,.095,-.045],[-.04,-.075,.055],[.04,-.075,.055],[.04,.075,.055],[-.04,.075,.055]].map(([dx,dy,dz])=>[x+dx,dy*Math.cos(a)+(R+.09+dz)*Math.sin(a),-dy*Math.sin(a)+(R+.09+dz)*Math.cos(a)]);
 for(const ids of[[4,5,6,7],[5,1,2,6],[0,4,7,3],[0,1,5,4],[7,6,2,3]])face(ids.map(i=>p[i]),[220,232,241],true);
 }}

 // Flexible leaf spring: the base stays fixed while its tip bends around pegs.
 const px=-HALF-.72,pz=R+.22,leaf=(x,y=0)=>[px+x,y-kick*.70*(x/.72)**2,pz];
 face([leaf(-.03,-.10),leaf(.08,-.10),leaf(.08,.10),leaf(-.03,.10)],[107,137,161],true);
 for(let i=0;i<8;i++){const x=.04+i*.052,X=x+.052;face([leaf(x,-.025),leaf(X,-.025),leaf(X,.025),leaf(x,.025)],[222,233,242],true);}
 face([leaf(.43,-.145),leaf(.72),leaf(.43,.145)],[224,237,246]);
 face([leaf(.465,-.09),leaf(.67),leaf(.465,.09)].map(p=>[p[0],p[1],p[2]+.018]),[245,57,74]);
 const data=[];
 for(const f of faces){const uvs=f.tex?(()=>{const i=f.tex-1,x=i%4*512,y=Math.floor(i/4)*180;return[[x/2048,y/1024],[(x+512)/2048,y/1024],[(x+512)/2048,(y+180)/1024],[x/2048,(y+180)/1024]];})():null;for(let i=1;i<f.points.length-1;i++)for(const j of[0,i,i+1])data.push(...f.points[j],...f.color.map(v=>v/255),...(uvs?uvs[j]:[-1,-1]),...(f.normals?f.normals[j]:f.n),f.metal?1:0);}
 gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 // Grow GPU storage only when the visible mesh exceeds its previous size.
 // Reallocating a WebGL buffer every frame can exhaust mobile graphics memory.
 if(data.length>bufferCapacity){bufferCapacity=Math.ceil(data.length*1.2);vertexData=new Float32Array(bufferCapacity);gl.bufferData(gl.ARRAY_BUFFER,vertexData.byteLength,gl.DYNAMIC_DRAW);}
 vertexData.set(data);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertexData.subarray(0,data.length));gl.drawArrays(gl.TRIANGLES,0,data.length/12);
 };}
