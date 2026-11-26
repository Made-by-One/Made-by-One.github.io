
(()=>{const nav=document.getElementById('menuList'),desktop=document.getElementById('desktopNavSlot'),mobile=document.getElementById('mobileNavSlot');if(!nav||!desktop||!mobile)return;
const mq=matchMedia('(max-width:900px)'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),selector='.btn,.nav-item,.growth-tab,.studio-feature a,.lang-btn,.theme-btn';const lens=document.createElement('i');lens.className='studio-nav-lens';lens.setAttribute('aria-hidden','true');nav.prepend(lens);
const states=new Map(),ls=[0,0,0,0].map(()=>({v:0,t:0,d:0}));let initialized=false,raf=0,last=0,active=null,pressed=null;
const channel=(v)=>({v,t:v,d:0});function state(el){if(!states.has(el)){el.classList.add('glass-control');states.set(el,[channel(50),channel(20),channel(0),channel(1),channel(1)])}return states.get(el)}
function spring(c,dt){if(reduce.matches){c.v=c.t;c.d=0;return false}c.d+=(230*(c.t-c.v)-29*c.d)*dt;c.v+=c.d*dt;if(Math.abs(c.t-c.v)<.001&&Math.abs(c.d)<.001){c.v=c.t;c.d=0;return false}return true}
function wake(){if(!raf){last=0;raf=requestAnimationFrame(tick)}}
function tick(now){raf=0;const dt=Math.min(.025,(now-(last||now-16))/1000);last=now;let busy=false;for(const [el,s] of states){if(!el.isConnected){states.delete(el);continue}for(const c of s)busy=spring(c,dt)||busy;el.style.setProperty('--gx',s[0].v+'%');el.style.setProperty('--gy',s[1].v+'%');el.style.setProperty('--ge',Math.max(0,Math.min(1,s[2].v)));el.style.setProperty('--gsx',s[3].v);el.style.setProperty('--gsy',s[4].v);if(el!==active&&el!==pressed&&s.every(c=>c.v===c.t&&c.d===0))states.delete(el)}
for(const c of ls)busy=spring(c,dt)||busy;lens.style.transform='translate3d('+ls[0].v+'px,'+ls[1].v+'px,0)';lens.style.width=Math.max(0,ls[2].v)+'px';lens.style.height=Math.max(0,ls[3].v)+'px';if(busy)raf=requestAnimationFrame(tick)}
function reset(el){if(!el)return;const s=state(el);s[2].t=0;s[3].t=s[4].t=1;wake()}
function move(e){const el=e.target.closest(selector);if(active!==el){reset(active);active=el}if(!el)return;const b=el.getBoundingClientRect(),s=state(el);s[0].t=Math.max(0,Math.min(100,(e.clientX-b.left)/Math.max(1,b.width)*100));s[1].t=Math.max(0,Math.min(100,(e.clientY-b.top)/Math.max(1,b.height)*100));s[2].t=1;wake()}
addEventListener('pointermove',move,{passive:true});addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;move(e);pressed=active;if(pressed){const s=state(pressed);s[3].t=1.025;s[4].t=.95;wake()}},{passive:true});function release(e){reset(pressed);pressed=null;if(e.type!=='pointerup'||e.pointerType==='touch'){reset(active);active=null}}for(const n of ['pointerup','pointercancel','blur'])addEventListener(n,release,{passive:true});addEventListener('pointerout',e=>{if(!e.relatedTarget){reset(active);active=null}});
function sync(){const slot=mq.matches?mobile:desktop;if(nav.parentElement!==slot){slot.append(nav);initialized=false}const a=nav.querySelector('.active');nav.querySelectorAll('.nav-item').forEach(b=>{if(b===a)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});lens.style.opacity=a?'1':'0';if(a){[a.offsetLeft,a.offsetTop,a.offsetWidth,a.offsetHeight].forEach((v,i)=>{ls[i].t=v;if(!initialized){ls[i].v=v;ls[i].d=0}});initialized=true;wake()}}
sync();
mq.addEventListener('change',sync);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(sync).observe(nav);
new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
document.fonts?.ready.then(sync);
})();
