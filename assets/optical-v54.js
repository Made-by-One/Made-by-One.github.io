/* 5.4.4: rounded optical surface displacement, not random noise. */
(()=> {
const NS="http://www.w3.org/2000/svg";
if(!window.CSS?.supports("backdrop-filter","url(#mbo-optical-test)")||!window.ResizeObserver)return;
const svg=document.createElementNS(NS,"svg");svg.setAttribute("width","0");svg.setAttribute("height","0");svg.setAttribute("aria-hidden","true");svg.style.cssText="position:absolute;pointer-events:none";const defs=document.createElementNS(NS,"defs");svg.append(defs);document.body.append(svg);
const targets="#mobileNavSlot,#desktopNavSlot #menuList,.activity-options,.lang-menu";
const entries=new Map();let serial=0;
const motion=matchMedia('(prefers-reduced-motion: reduce)'), transparency=matchMedia('(prefers-reduced-transparency: reduce)');
const maps=new Map();let degraded=false;
function node(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n}
function update(el){const e=entries.get(el);if(!e)return;const w=Math.round(el.offsetWidth),h=Math.round(el.offsetHeight);if(w<2||h<2||e.w===w&&e.h===h)return;
const radius=Math.min(w/2,h/2,parseFloat(getComputedStyle(el).borderTopLeftRadius)||18),rim=Math.min(15,radius*.85),scale=24;
const cw=Math.min(w,512),ch=Math.min(h,256),key=[w,h,radius,cw,ch].join(':');
if(maps.has(key)){applyMap(maps.get(key));return}
const canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext("2d");if(!ctx)return;const pixels=ctx.createImageData(cw,ch);
for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const px=(x+.5)*w/cw-w/2,py=(y+.5)*h/ch-h/2;const qx=Math.abs(px)-w/2+radius,qy=Math.abs(py)-h/2+radius;const ax=Math.max(qx,0),ay=Math.max(qy,0),len=Math.hypot(ax,ay);const d=-(len+Math.min(Math.max(qx,qy),0)-radius);let nx=0,ny=0;if(len>0){nx=ax/len*Math.sign(px);ny=ay/len*Math.sign(py)}else if(qx>qy)nx=Math.sign(px);else ny=Math.sign(py);const t=Math.max(0,Math.min(1,d/rim));const bend=d>=0?Math.sin(Math.PI*t)*10:0;const i=(y*cw+x)*4;pixels.data[i]=Math.round(128-nx*bend/scale*255);pixels.data[i+1]=Math.round(128-ny*bend/scale*255);pixels.data[i+2]=128;pixels.data[i+3]=255}
ctx.putImageData(pixels,0,0);const url=canvas.toDataURL("image/png");if(maps.size>=16)maps.delete(maps.keys().next().value);maps.set(key,url);applyMap(url);
function applyMap(url){e.image.setAttribute("href",url);e.image.setAttribute("width",w);e.image.setAttribute("height",h);e.filter.setAttribute("width",w);e.filter.setAttribute("height",h);e.w=w;e.h=h;el.style.setProperty("--optical-filter","url(#"+e.id+")");el.classList.add("optical-ready")}}
const dirty=new Set();let resizeFrame=0;
const observer=new ResizeObserver(es=>{for(const e of es)dirty.add(e.target);if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;for(const el of dirty)update(el);dirty.clear()})});
let pointerFrame=0,active=null,point=null;
document.addEventListener("pointermove",ev=>{if(motion.matches||transparency.matches||degraded||ev.pointerType==="touch")return;const el=ev.target.closest?.(targets);if(active&&active!==el){active.style.removeProperty("--glass-x");active.style.removeProperty("--glass-y");active.classList.remove("optical-lit")}active=el;if(!el)return;point=[ev.clientX,ev.clientY];if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(!active||!point)return;const b=active.getBoundingClientRect();if(!b.width||!b.height)return;active.style.setProperty("--glass-x",Math.max(0,Math.min(100,(point[0]-b.left)/b.width*100))+"%");active.style.setProperty("--glass-y",Math.max(0,Math.min(100,(point[1]-b.top)/b.height*100))+"%");active.classList.add("optical-lit")})},{passive:true});
function clearLight(){if(active)active.classList.remove("optical-lit");active=null}
document.addEventListener("pointerout",e=>{if(active&&!active.contains(e.relatedTarget))clearLight()});
document.addEventListener("visibilitychange",clearLight);
// Sample frame pacing only during scrolling; downgrade once per page on sustained slow frames.
let sample=0,last=0,frames=0,slow=0,until=0;
function pace(t){if(document.hidden||t>until||degraded){sample=0;last=frames=slow=0;return}if(last){frames++;if(t-last>34)slow++}last=t;if(frames>=45){if(slow/frames>.45){degraded=true;document.documentElement.classList.add("optical-lite");clearLight();sample=0;return}frames=slow=0}sample=requestAnimationFrame(pace)}
window.addEventListener("scroll",()=>{if(degraded||document.hidden||motion.matches)return;until=performance.now()+1500;if(!sample)sample=requestAnimationFrame(pace)},{passive:true,capture:true});
function scan(){for(const [el,e] of entries)if(!el.isConnected||!el.matches(targets)){observer.unobserve(el);e.filter.remove();el.classList.remove("optical-ready");entries.delete(el)}for(const el of document.querySelectorAll(targets)){if(entries.has(el))continue;const id="mbo-optical-"+(++serial);const filter=node("filter",{id,filterUnits:"userSpaceOnUse",primitiveUnits:"userSpaceOnUse",x:0,y:0,"color-interpolation-filters":"sRGB"});const image=node("feImage",{x:0,y:0,preserveAspectRatio:"none",result:"map"});filter.append(image);
const mobile=matchMedia("(max-width:900px)").matches;
if(mobile||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4){
filter.append(node("feDisplacementMap",{in:"SourceGraphic",in2:"map",scale:24,xChannelSelector:"R",yChannelSelector:"G"}));
}else{
for(const [channel,scale,matrix] of [
["red",26,"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
["green",24,"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
["blue",22,"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]]){
filter.append(node("feDisplacementMap",{in:"SourceGraphic",in2:"map",scale,xChannelSelector:"R",yChannelSelector:"G",result:channel+"Warp"}),node("feColorMatrix",{in:channel+"Warp",type:"matrix",values:matrix,result:channel}));
}
filter.append(node("feComposite",{in:"red",in2:"green",operator:"arithmetic",k2:1,k3:1,result:"rg"}),node("feComposite",{in:"rg",in2:"blue",operator:"arithmetic",k2:1,k3:1}));
}defs.append(filter);entries.set(el,{id,filter,image});observer.observe(el);update(el)}}
let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;scan()})}}).observe(document.body,{childList:true,subtree:true});scan();
})();