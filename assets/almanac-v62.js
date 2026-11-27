import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
export function mountAlmanac(host){
 const mobile=matchMedia('(pointer:coarse)').matches;
 const maxDpr=mobile?1.2:1.65;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,maxDpr));renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.transmissionResolutionScale=mobile?.55:.8;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,50);camera.position.set(0,0,8);
 scene.add(new T.HemisphereLight(0xe7ddff,0x302050,2));for(const [x,y,z,c] of [[3,4,4,0xbca5ff],[-3,-1,2,0x8866ff],[0,2,-4,0xffffff]]){const l=new T.PointLight(c,35);l.position.set(x,y,z);scene.add(l)}
 // Procedural studio environment, generated once for physical reflections.
 const envScene=new T.Scene();envScene.background=new T.Color(0x292039);
 for(const [x,y,z,c] of [[-3,2,1,0xffffff],[3,1,-2,0x9b65ff],[0,-3,2,0x6750ad]]){const panel=new T.Mesh(new T.PlaneGeometry(4,5),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,0,0);envScene.add(panel)}
 const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromScene(envScene,.06);scene.environment=env.texture;scene.environmentIntensity=1.35;pmrem.dispose();envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
 const group=new T.Group();scene.add(group);const mat=new T.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.055,transmission:1,thickness:1.6,ior:1.46,dispersion:.025,attenuationColor:new T.Color(0xc8b1ff),attenuationDistance:30,clearcoat:.12,clearcoatRoughness:.12,envMapIntensity:.65});
 const red=mat.clone();red.color.set(0xffb3b3);red.attenuationColor.set(0xff4545);red.attenuationDistance=3;
 const facets=mat.clone();facets.side=T.DoubleSide;const redFacets=red.clone();redFacets.side=T.DoubleSide;
 let exploded=false,onscreen=true,quality=1,slow=0,fast=0,raf=0,chapter=0,visible=false,drag=false,rx=.2,ry=0,scale=1,last=0,amount=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let solid=null,shards=null,faces=[];
 function prism(outline,depth=.5){const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,steps:1,curveSegments:1});g.center();return g}
 function build(i){
 if(i===0)return prism(Array.from({length:8},(_,j)=>{const a=Math.PI/2+j*Math.PI/4,r=j%2?.48:1.5;return [Math.cos(a)*r,Math.sin(a)*r]}),.42);
 if(i===1)return new T.DodecahedronGeometry(1.45,0);
 if(i===2)return prism([[-1.45,-.8],[-1.1,-.15],[-.65,.05],[-.15,1.35],[.4,.45],[.72,.8],[1.45,-.8]],.7);
 if(i===3)return prism([[-1.55,0],[-.85,.65],[0,.85],[.85,.65],[1.55,0],[.85,-.65],[0,-.85],[-.85,-.65]],.55);
 if(i===4)return new T.IcosahedronGeometry(1.48,0);
 return new T.TorusGeometry(1.05,.38,5,12);
 }
 function select(i){chapter=i;exploded=false;amount=0;for(const child of [...group.children]){group.remove(child);child.geometry.dispose()}faces=[];
 let g=build(i);if(g.index){const old=g;g=g.toNonIndexed();old.dispose()}g.computeVertexNormals();solid=new T.Mesh(g,i===3?red:mat);group.add(solid);
 const pos=g.attributes.position;const data=new Float32Array(pos.count*3);
 for(let j=0;j<pos.count;j+=3){const a=new T.Vector3().fromBufferAttribute(pos,j),b=new T.Vector3().fromBufferAttribute(pos,j+1),c=new T.Vector3().fromBufferAttribute(pos,j+2);const center=a.clone().add(b).add(c).multiplyScalar(1/3);const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();faces.push({center,normal,local:[a.sub(center),b.sub(center),c.sub(center)],axis:new T.Vector3(Math.sin(j+1),Math.cos(j*2+1),.6).normalize()})}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(data,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('normal',new T.BufferAttribute(new Float32Array(data.length),3).setUsage(T.DynamicDrawUsage));shards=new T.Mesh(geo,i===3?redFacets:facets);shards.frustumCulled=false;group.add(shards);updateVoxels();draw()
 }
 const q=new T.Quaternion(),v=new T.Vector3(),offset=new T.Vector3(),n=new T.Vector3();
 function updateVoxels(){if(!solid||!shards)return;solid.visible=amount<.002;shards.visible=!solid.visible;if(solid.visible)return;const p=shards.geometry.attributes.position, normals=shards.geometry.attributes.normal;
 faces.forEach((f,i)=>{q.setFromAxisAngle(f.axis,amount*(.25+.35*Math.sin(i*2.4)));offset.copy(f.center).multiplyScalar(1+amount*.65).addScaledVector(f.normal,amount*.38);n.copy(f.normal).applyQuaternion(q);f.local.forEach((point,j)=>{v.copy(point).applyQuaternion(q).add(offset);p.setXYZ(i*3+j,v.x,v.y,v.z);normals.setXYZ(i*3+j,n.x,n.y,n.z)})});p.needsUpdate=true;normals.needsUpdate=true
 }
 function draw(){if(!visible||!onscreen||document.hidden)return;group.rotation.set(rx,ry,0);camera.position.z=8+amount*1.6;group.scale.setScalar(scale);renderer.render(scene,camera)}
 function tick(t){raf=0;if(!visible||!onscreen||document.hidden)return;const raw=last?t-last:16;const dt=Math.min(.05,(t-(last||t))/1000);last=t;if(raw>45){slow++;fast=0}else if(raw<23){fast++;slow=0}else{slow=fast=0}if(slow>30&&quality===1){quality=.7;renderer.setPixelRatio(Math.min(devicePixelRatio,.85));renderer.transmissionResolutionScale=.4;resize();slow=0}if(fast>180&&quality<1){quality=1;renderer.setPixelRatio(Math.min(devicePixelRatio,maxDpr));renderer.transmissionResolutionScale=mobile?.55:.8;resize();fast=0}const target=Number(exploded);if(amount!==target){amount+=(target-amount)*Math.min(1,dt*7);if(Math.abs(target-amount)<.001)amount=target;updateVoxels()}if(!drag&&!reduced.matches)ry+=dt*.28;scale+=(1-scale)*Math.min(1,dt*8);draw();if(!reduced.matches)raf=requestAnimationFrame(tick)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
 const ro=new ResizeObserver(resize);ro.observe(host);
 function show(v){visible=v;cancelAnimationFrame(raf);raf=0;last=0;if(v){resize();draw();if(onscreen&&!reduced.matches&&!document.hidden)raf=requestAnimationFrame(tick)}}
 document.addEventListener('visibilitychange',()=>show(visible));reduced.addEventListener('change',()=>show(visible));
 const io=new IntersectionObserver(es=>{onscreen=es[0].isIntersecting;show(visible)});io.observe(host);return {select,show,setExpanded(v){exploded=v;if(reduced.matches){amount=Number(v);updateVoxels();draw()}}};
}