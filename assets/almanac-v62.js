import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {RoundedBoxGeometry} from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';
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
 const group=new T.Group();scene.add(group);const mat=new T.MeshPhysicalMaterial({color:0xf4efff,metalness:0,roughness:.065,transmission:1,thickness:.24,ior:1.46,dispersion:mobile?.012:.035,clearcoat:1,clearcoatRoughness:.045,attenuationColor:0xbfaaff,attenuationDistance:1.8,envMapIntensity:1.3});
 const cube=new RoundedBoxGeometry(.96,.96,.96,mobile?1:2,.15);const red=mat.clone();red.color.set(0xffb3b3);red.attenuationColor.set(0xff4545);red.attenuationDistance=.55;
 let exploded=false,onscreen=true,quality=1,slow=0,fast=0,raf=0,chapter=0,visible=false,drag=false,rx=.2,ry=0,scale=1,last=0,amount=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const points=[];
 function select(i){chapter=i;exploded=false;amount=0;for(const child of [...group.children]){group.remove(child);child.dispose()}points.length=0;
 for(let x=-5;x<=5;x++)for(let y=-5;y<=5;y++)for(let z=-2;z<=2;z++){
 const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z);let yes=false;
 if(i===0)yes=az<=1&&(ax+ay<=2||ax<=1&&ay<=5-ax||ay<=1&&ax<=5-ay);
 if(i===1)yes=az<=1&&[[-3,2],[3,2],[0,-3]].some(([u,v])=>Math.abs(x-u)<=1&&Math.abs(y-v)<=1);
 if(i===2)yes=(y===-3&&ax+az<=5)||(az<=1&&ax<=3&&y>=-2&&y<=Math.floor((3-ax)*.8))||(x===0&&z===0&&y===3);
 if(i===3)yes=az===0&&((ax+ay*2>=4&&ax+ay*2<=5&&ay<=2)||(ax<=1&&ay<=1));
 if(i===4)yes=ax<=3&&ay<=3&&az<=2&&(ax===3||ay===3||az===2)&&(x%2===0||y%2===0||z%2===0);
 if(i===5)yes=(az===0&&Math.abs(Math.hypot(x,y)-4)<.65)||(y===0&&Math.abs(Math.hypot(x,z*2)-4)<.65)||(ax+ay+az<=1);
 if(yes)points.push(new T.Vector3(x*.26,y*.26,z*.26))}
 const voxels=new T.InstancedMesh(cube,i===3?red:mat,points.length);voxels.frustumCulled=false;voxels.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(voxels);scale=1;updateVoxels();draw()}
 const dummy=new T.Object3D();
 function updateVoxels(){const mesh=group.children[0];if(!mesh)return;points.forEach((p,i)=>{const wave=amount*Math.sin(i*2.399);dummy.position.copy(p).multiplyScalar(1+amount*.85);dummy.position.z+=wave*.35;dummy.position.y+=wave*.12;dummy.rotation.set(wave*.55,wave*.7,wave*.4);dummy.scale.setScalar(.26*(1-amount*.18));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true}
 function draw(){if(!visible||!onscreen||document.hidden)return;group.rotation.set(rx,ry,0);camera.position.z=8+amount*1.6;group.scale.setScalar(scale);renderer.render(scene,camera)}
 function tick(t){raf=0;if(!visible||!onscreen||document.hidden)return;const raw=last?t-last:16;const dt=Math.min(.05,(t-(last||t))/1000);last=t;if(raw>45){slow++;fast=0}else if(raw<23){fast++;slow=0}else{slow=fast=0}if(slow>30&&quality===1){quality=.7;renderer.setPixelRatio(Math.min(devicePixelRatio,.85));renderer.transmissionResolutionScale=.4;resize();slow=0}if(fast>180&&quality<1){quality=1;renderer.setPixelRatio(Math.min(devicePixelRatio,maxDpr));renderer.transmissionResolutionScale=mobile?.55:.8;resize();fast=0}const target=Number(exploded);if(amount!==target){amount+=(target-amount)*Math.min(1,dt*7);if(Math.abs(target-amount)<.001)amount=target;updateVoxels()}if(!drag&&!reduced.matches)ry+=dt*.28;scale+=(1-scale)*Math.min(1,dt*8);draw();if(!reduced.matches)raf=requestAnimationFrame(tick)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
 const ro=new ResizeObserver(resize);ro.observe(host);
 function show(v){visible=v;cancelAnimationFrame(raf);raf=0;last=0;if(v){resize();draw();if(onscreen&&!reduced.matches&&!document.hidden)raf=requestAnimationFrame(tick)}}
 document.addEventListener('visibilitychange',()=>show(visible));reduced.addEventListener('change',()=>show(visible));
 const io=new IntersectionObserver(es=>{onscreen=es[0].isIntersecting;show(visible)});io.observe(host);return {select,show,setExpanded(v){exploded=v;if(reduced.matches){amount=Number(v);updateVoxels();draw()}}};
}