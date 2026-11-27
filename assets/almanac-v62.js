import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
export function mountAlmanac(host){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.75));renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,50);camera.position.set(0,0,8);
 scene.add(new T.HemisphereLight(0xe7ddff,0x302050,2));for(const [x,y,z,c] of [[3,4,4,0xbca5ff],[-3,-1,2,0x8866ff],[0,2,-4,0xffffff]]){const l=new T.PointLight(c,35);l.position.set(x,y,z);scene.add(l)}
 const group=new T.Group();scene.add(group);const mat=new T.MeshPhysicalMaterial({color:0xbda5ff,metalness:.25,roughness:.19,clearcoat:1});const edge=new T.MeshPhysicalMaterial({color:0xede5ff,roughness:.12,metalness:.5,clearcoat:1});
 const cube=new T.BoxGeometry(.65,.65,.65),ring=new T.TorusGeometry(1.1,.12,16,64),shape=new T.Shape();for(let i=0;i<8;i++){const a=Math.PI/2+i*Math.PI/4,r=i%2?.46:1.55;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y)}shape.closePath();const star=new T.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:true,bevelSize:.13,bevelThickness:.13,bevelSegments:5,steps:1});star.center();
 function mesh(g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);group.add(o);return o}
 let chapter=0,raf=0,visible=false,drag=false,lastX=0,lastY=0,rx=.2,ry=0,scale=1,last=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function select(i){chapter=i;group.clear();if(i===0)mesh(star,edge);if(i===1)for(let j=0;j<3;j++)mesh(cube,j===1?edge:mat,(j-1)*.82,Math.sin(j*2)*.35,0);if(i===2){for(let x=-2;x<=2;x++)for(let z=-1;z<=1;z++){const o=mesh(cube,mat,x*.53,-.55+Math.sin(x+z)*.22,z*.53);o.scale.set(.78,.65,.78)}mesh(star,edge,0,.65,0).scale.setScalar(.45)}if(i===3){const m=new T.MeshPhysicalMaterial({color:0xe34d49,roughness:.28,emissive:0x661010,emissiveIntensity:.35});for(let x=-3;x<=3;x++)for(let y=-2;y<=2;y++)if(Math.abs(x)+Math.abs(y)===3||x===0&&Math.abs(y)<=1)mesh(cube,m,x*.39,y*.39,0).scale.setScalar(.52);group.userData.temp=m}if(i===4)for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(Math.abs(x)+Math.abs(y)+Math.abs(z)>1)mesh(cube,mat,x*.82,y*.82,z*.82).scale.setScalar(.68);if(i===5){mesh(ring,mat).rotation.x=.8;mesh(ring,edge).rotation.y=1.1;mesh(star,edge).scale.setScalar(.45)}scale=reduced.matches?1:.72;draw()}
 function draw(){if(!visible)return;group.rotation.set(rx,ry,0);group.scale.setScalar(scale);renderer.render(scene,camera)}
 function tick(t){raf=0;if(!visible||document.hidden)return;const dt=Math.min(.05,(t-(last||t))/1000);last=t;if(!drag&&!reduced.matches)ry+=dt*.28;scale+=(1-scale)*Math.min(1,dt*8);draw();if(!reduced.matches)raf=requestAnimationFrame(tick)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
 const ro=new ResizeObserver(resize);ro.observe(host);
 function show(v){visible=v;cancelAnimationFrame(raf);raf=0;last=0;if(v){resize();draw();if(!reduced.matches&&!document.hidden)raf=requestAnimationFrame(tick)}}
 host.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;host.setPointerCapture(e.pointerId)});
 host.addEventListener('pointermove',e=>{if(!drag)return;ry+=(e.clientX-lastX)*.012;rx+=(e.clientY-lastY)*.012;lastX=e.clientX;lastY=e.clientY;draw()});
 for(const n of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(n,()=>drag=false);
 document.addEventListener('visibilitychange',()=>show(visible));reduced.addEventListener('change',()=>show(visible));
 const original=select;return {select(i){group.userData.temp?.dispose();group.userData.temp=null;original(i)},show};
}