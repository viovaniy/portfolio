'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const projects = [
  {id:'frame',name:'Frame',category:'UI motion',description:'Интерфейсы со своим характером',color:'#e6eaf0',detail:'Демо интерфейсной анимации: карточки, переходы и немного воздуха. Этот пример показывает, как твои работы будут выглядеть в портфолио.'},
  {id:'elastic',name:'Elastic',category:'Kinetic typography',description:'Типографика, которая не стоит на месте',color:'#f1efc9',detail:'Демо кинетической типографики. Формы и буквы двигаются в одном ритме. Позже здесь появятся твой ролик, описание задачи и твоя роль.'},
  {id:'orbit',name:'Orbit',category:'Brand motion',description:'Одна форма. Бесконечное движение',color:'#e8def2',detail:'Демо абстрактной графики: вращающиеся орбиты и мягкая смена формы. Здесь можно показать отдельный проект, его визуальную систему и ключевые кадры.'},
  {id:'shift',name:'Shift',category:'Motion exploration',description:'Простые формы, неожиданные сочетания',color:'#edddd5',detail:'Демо графического эксперимента с цветом и формой. Этот пример нужен для примерки дизайна и не является опубликованной работой viovaniy.'}
];

function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function text(ctx,str,x,y,size,color,weight=500,align='left'){ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,x,y);ctx.textAlign='left';}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();ctx.lineWidth=1;}
function circle(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function petal(ctx,x,y,r,rotation,color){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.beginPath();for(let i=0;i<=360;i++){const a=i*Math.PI/180;const d=r*(.83+.17*Math.cos(a*8));const px=Math.cos(a)*d,py=Math.sin(a)*d;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();}
function grain(ctx,w,h,alpha=.023){ctx.fillStyle=`rgba(76,48,97,${alpha})`;for(let y=9;y<h;y+=13){for(let x=7;x<w;x+=13){ctx.fillRect(x+(y%7),y,.7,.7);}}}
function cursor(ctx,x,y,angle,size=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,45);ctx.lineTo(12,34);ctx.lineTo(23,53);ctx.lineTo(33,47);ctx.lineTo(22,29);ctx.lineTo(39,25);ctx.closePath();ctx.shadowColor='#3021492a';ctx.shadowBlur=12;ctx.shadowOffsetY=4;ctx.fillStyle='#fff';ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#705398';ctx.lineWidth=2;ctx.stroke();ctx.restore();}

function renderHero(ctx,t){
  const w=1440,h=650;ctx.clearRect(0,0,w,h);ctx.fillStyle='#181917';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#fff';ctx.globalAlpha=.035;for(let y=4;y<h;y+=5){for(let x=(y%3)*3;x<w;x+=9){ctx.fillRect(x,y,.6,.6);}}ctx.globalAlpha=1;
  line(ctx,48,106,1392,106,'#343632');line(ctx,48,548,1392,548,'#343632');
  text(ctx,'V—01',49,69,21,'#f1f0e8',500);text(ctx,'MOTION STUDY',1369,63,11,'#9b9d92',500,'right');
  text(ctx,'FORM  /  RHYTHM  /  CHARACTER',50,591,10,'#888b80',500);
  text(ctx,`FRAME ${Math.floor(t*24+1).toString().padStart(4,'0')}`,1369,591,10,'#919587',500,'right');
  const chars=[...'viovaniy'];const size=305;ctx.font=`600 ${size}px ${font}`;
  const widths=chars.map(c=>ctx.measureText(c).width-15);const total=widths.reduce((a,b)=>a+b,0);const fit=1270/total;
  const active=2+Math.floor(t/6)%3;let x=0;
  ctx.save();ctx.translate(82,381);ctx.scale(fit,1);
  chars.forEach((char,i)=>{
    const wave=Math.sin(t*.78+i*.77)*15;const rot=Math.sin(t*.42+i*.61)*.035;
    ctx.save();ctx.translate(x+widths[i]/2,wave);ctx.rotate(rot);
    if(i===active){ctx.rotate(-.08);ctx.fillStyle='#f0643b';ctx.fillRect(-widths[i]/2-10,-227,widths[i]+20,279);text(ctx,char,-widths[i]/2,-3,size,'#1a1b17',600);}
    else{text(ctx,char,-widths[i]/2,0,size,'#e9eae0',600);}
    ctx.restore();x+=widths[i];
  });ctx.restore();
  const marker=50+(t/24)*1320;line(ctx,marker,548,marker+20,548,'#f0643b',2);
  ctx.fillStyle='#f0643b';ctx.fillRect(49,86,5,5);
}

function renderFrame(ctx,t,w,h){ctx.fillStyle='#e4e9f0';ctx.fillRect(0,0,w,h);grain(ctx,w,h);ctx.save();ctx.translate(477,282+Math.sin(t)*5);ctx.rotate(-.065+Math.sin(t*.5)*.01);ctx.shadowColor='#66748825';ctx.shadowBlur=40;ctx.shadowOffsetY=20;rounded(ctx,-285,-191,570,377,16,'#fcfdff','#cfd7e0');ctx.shadowColor='transparent';rounded(ctx,-285,-191,128,377,[16,0,0,16],'#f2f4f8');text(ctx,'frame',-266,-157,19,'#667a90',650);line(ctx,-267,-140,-173,-140,'#e0e5ec');const rows=['Overview','Your space','Collections','Settings'];rows.forEach((s,i)=>{if(i===1)rounded(ctx,-274,-107+i*34,106,26,5,'#e1d9f0');rounded(ctx,-262,-100+i*34,8,8,2,i===1?'#aa8acd':'#bdc6d2');text(ctx,s,-245,-92+i*34,10,i===1?'#8d6baa':'#a0adbc');});text(ctx,'A little space',-126,-133,32,'#3e4e61',550);text(ctx,'for big ideas.',-126,-95,32,'#3e4e61',550);text(ctx,'Make room for your next good thing.',-123,-67,11,'#a4aebb');rounded(ctx,-122,-44,180,179,11,'#e9e0f5');rounded(ctx,73,-44,180,82,10,'#e5ebdc');rounded(ctx,73,51,180,84,10,'#e9edf5');petal(ctx,-32,39,56,t*.2,'#b69acd');text(ctx,'Find your flow',-104,113,11,'#9d80b5');text(ctx,'Ideas, together.',92,-16,11,'#9ba68f');circle(ctx,112,12,11,'#b9c9a7');circle(ctx,128,12,11,'#cad6bc');circle(ctx,144,12,11,'#dbe3d2');text(ctx,'IN PROGRESS',91,75,8,'#9aa7b8');rounded(ctx,91,96,143,5,3,'#d4dce7');rounded(ctx,91,96,86+Math.sin(t)*20,5,3,'#a2b3cb');ctx.restore();cursor(ctx,704+Math.sin(t*.8)*18,392+Math.cos(t)*11,-.22,.74);}
function renderElastic(ctx,t,w,h){ctx.fillStyle='#eeeecd';ctx.fillRect(0,0,w,h);grain(ctx,w,h);const dx=Math.sin(t*.9)*12;ctx.save();ctx.translate(125,227);ctx.rotate(-.06);text(ctx,'make',dx,0,154,'#687344',650);text(ctx,'room.',-3-dx,137,154,'#687344',650);ctx.restore();ctx.save();ctx.translate(723,269+Math.sin(t)*9);ctx.rotate(.24+t*.14);const g=ctx.createLinearGradient(-130,-130,130,130);g.addColorStop(0,'#f6f5a8');g.addColorStop(.55,'#d8d96c');g.addColorStop(1,'#b4be54');petal(ctx,0,0,155,0,g);circle(ctx,0,0,57,'#eeeecd');ctx.restore();text(ctx,'TYPE WITH PERSONALITY.',127,455,11,'#9b9e75');rounded(ctx,623,421,185,31,15,'#fffff680');text(ctx,'a little stretch goes a long way',715,441,10,'#919a6d',500,'center');}
function renderOrbit(ctx,t,w,h){ctx.fillStyle='#e8e0f0';ctx.fillRect(0,0,w,h);grain(ctx,w,h);ctx.save();ctx.translate(483,269);ctx.rotate(-.3+t*.06);for(let i=0;i<26;i++){ctx.beginPath();const a=i*Math.PI/26;ctx.ellipse(0,0,178,70+Math.sin(a+t*.3)*24,a,0,Math.PI*2);ctx.strokeStyle=`rgba(125,90,171,${.13+Math.sin(a)*.28})`;ctx.lineWidth=2;ctx.stroke();}ctx.restore();text(ctx,'orbit',477,497,45,'#7b5e9a',450,'center');circle(ctx,681+Math.sin(t)*10,155+Math.cos(t)*10,15,'#b6cd86');text(ctx,'ENDLESS WAYS TO MOVE.',481,65,9,'#a793b9',500,'center');}
function renderShift(ctx,t,w,h){ctx.fillStyle='#efdfd7';ctx.fillRect(0,0,w,h);grain(ctx,w,h);ctx.save();ctx.translate(370,272);ctx.rotate(-.12+Math.sin(t*.6)*.1);ctx.shadowColor='#975b4024';ctx.shadowBlur=25;ctx.shadowOffsetY=18;rounded(ctx,-173,-150,300,300,20,'#d78c70');ctx.shadowColor='transparent';text(ctx,'a',-67,75,225,'#f6e5d8',550);ctx.restore();ctx.save();ctx.translate(631,278);ctx.rotate(.13-Math.sin(t*.6)*.1);ctx.shadowColor='#975b4024';ctx.shadowBlur=25;ctx.shadowOffsetY=18;rounded(ctx,-95,-116,236,236,20,'#eee8df');ctx.shadowColor='transparent';text(ctx,'b',-29,66,166,'#b77a66',550);ctx.restore();text(ctx,'A CHANGE OF PACE.',482,476,11,'#b08575',500,'center');}
const renderers={frame:renderFrame,elastic:renderElastic,orbit:renderOrbit,shift:renderShift};
const cards=[];
function createCard(project,index){const btn=document.createElement('button');btn.type='button';btn.className='project-card';btn.setAttribute('aria-label',`Открыть ${project.name} — ${project.category}, демопроект`);btn.dataset.project=project.id;btn.innerHTML=`<div class="project-image" style="background:${project.color}"><span class="project-number">0${index+1}</span><span class="project-demo">ДЕМО</span><canvas width="960" height="560" aria-hidden="true"></canvas><span class="project-open">${icon('up-right')}</span></div><div class="project-info-wrap"><div class="project-info"><span class="project-name">${project.name}</span><span class="project-category">${project.category}</span></div><p class="project-description">${project.description}</p></div>`;const canvas=$('canvas',btn),ctx=canvas.getContext('2d');renderers[project.id](ctx,0,960,560);const state={canvas,ctx,project,hover:false,time:0};cards.push(state);btn.addEventListener('pointerenter',()=>state.hover=true);btn.addEventListener('pointerleave',()=>{state.hover=false;state.time=0;renderers[project.id](ctx,0,960,560);});btn.addEventListener('focus',()=>state.hover=true);btn.addEventListener('blur',()=>state.hover=false);btn.addEventListener('click',()=>openProject(project));return btn;}
projects.forEach((p,i)=>$('#projects-grid').append(createCard(p,i)));

const heroCanvas=$('#hero-canvas'),heroCtx=heroCanvas.getContext('2d');
const player={time:0,duration:24,playing:false,speed:1};
renderHero(heroCtx,0);
for(let i=0;i<8;i++){const frame=document.createElement('canvas');frame.width=240;frame.height=108;const c=frame.getContext('2d');c.scale(1/6,108/650);renderHero(c,i*3);$('#filmstrip').append(frame);}
function formatTime(value){return `00:${Math.floor(value).toString().padStart(2,'0')}`;}
function updatePlayer(){const pct=player.time/player.duration*100;$('#timeline').value=player.time;$('#timeline').style.setProperty('--progress',`${pct}%`);$('#timeline-playhead').style.left=`${pct}%`;$('#timeline').setAttribute('aria-valuetext',`${Math.floor(player.time)} секунд из 24`);$('#current-time').textContent=formatTime(player.time);}
function setPlaying(value){if(value&&player.time>=player.duration)player.time=0;player.playing=value;$('#reel-window').classList.toggle('playing',value);$('#play-button').innerHTML=icon(value?'pause':'play');$('#play-button').setAttribute('aria-label',value?'Приостановить демо-анимацию':'Воспроизвести демо-анимацию');$('#stage-play').tabIndex=value?-1:0;$('#stage-play').setAttribute('aria-hidden',String(value));$('#stage-play').disabled=value;}
$('#play-button').addEventListener('click',()=>setPlaying(!player.playing));
$('#stage-play').addEventListener('click',()=>setPlaying(true));
heroCanvas.addEventListener('click',()=>setPlaying(!player.playing));
$('#timeline').addEventListener('input',(event)=>{player.time=Number(event.target.value);renderHero(heroCtx,player.time);updatePlayer();});
$('#speed-button').addEventListener('click',()=>{const speeds=[1,1.5,2,.5];player.speed=speeds[(speeds.indexOf(player.speed)+1)%speeds.length];$('#speed-button span').textContent=`${player.speed}×`;$('#speed-button').setAttribute('aria-label',`Скорость воспроизведения: ${player.speed}`);});
$('#fullscreen-button').addEventListener('click',async()=>{const el=$('#reel-window');try{if(document.fullscreenElement){await document.exitFullscreen();}else if(el.requestFullscreen){await el.requestFullscreen();}else{el.classList.toggle('fullscreen-fallback');syncFullscreen();}}catch{el.classList.toggle('fullscreen-fallback');syncFullscreen();}});
function syncFullscreen(){const active=!!document.fullscreenElement||$('#reel-window').classList.contains('fullscreen-fallback');$('#fullscreen-button').setAttribute('aria-label',active?'Выйти из полноэкранного режима':'Открыть плеер на весь экран');}
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#reel-window').classList.remove('fullscreen-fallback');syncFullscreen();}});

$$('.view-button').forEach(button=>button.addEventListener('click',()=>{const list=button.dataset.view==='list';$('#projects-grid').classList.toggle('list-view',list);$$('.view-button').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});}));
let navScheduled=false;
function updateNav(){const target=$('#work').getBoundingClientRect().top<innerHeight*.35?'#work':'#showreel';$$('.nav-link').forEach(a=>a.classList.toggle('active',a.hash===target));navScheduled=false;}
window.addEventListener('scroll',()=>{if(!navScheduled){navScheduled=true;requestAnimationFrame(updateNav);}},{passive:true});
window.addEventListener('resize',updateNav);updateNav();

const dialog=$('#project-dialog');let modalAnimation=null;let lastFocus=null;
function clearDetachedCards(){for(let i=cards.length-1;i>=0;i--){if(!cards[i].canvas.isConnected)cards.splice(i,1);}}
function showDialog(){clearDetachedCards();if(!dialog.open){lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';}setPlaying(false);dialog.scrollTop=0;}
function openProject(project){$('#dialog-breadcrumb').textContent=`viovaniy / work / ${project.name.toLowerCase()}`;$('#dialog-content').innerHTML=`<div class="dialog-heading"><div class="eyebrow">${project.category.toUpperCase()} · ДЕМОПРОЕКТ</div><h2 id="dialog-title" style="margin-top:12px">${project.name}</h2><p>${project.detail}</p></div><div class="dialog-visual"><canvas class="dialog-canvas" width="960" height="560" aria-label="Анимированная демонстрационная композиция ${project.name}"></canvas><button class="dialog-toggle">${icon(reducedMotion.matches?'play':'pause')}<span>${reducedMotion.matches?'Воспроизвести':'Пауза'}</span></button></div><div class="dialog-footer"><span>Визуальный концепт · первая версия</span><button id="back-gallery">← Все работы</button></div>`;const ctx=$('.dialog-canvas').getContext('2d');modalAnimation={ctx,project,time:0,playing:!reducedMotion.matches};renderers[project.id](ctx,0,960,560);$('.dialog-toggle').addEventListener('click',()=>{modalAnimation.playing=!modalAnimation.playing;$('.dialog-toggle').innerHTML=`${icon(modalAnimation.playing?'pause':'play')}<span>${modalAnimation.playing?'Пауза':'Воспроизвести'}</span>`;});$('#back-gallery').addEventListener('click',openGallery);showDialog();$('#close-dialog').focus();}
function openGallery(){modalAnimation=null;$('#dialog-breadcrumb').textContent='viovaniy / all work';$('#dialog-content').innerHTML='<div class="dialog-heading"><div class="eyebrow">БИБЛИОТЕКА ДВИЖЕНИЯ</div><h2 id="dialog-title" style="margin-top:12px">Все работы<span class="sup-count">04</span></h2><p>Четыре демопроекта для примерки портфолио. Выбери карточку, чтобы посмотреть её в движении.</p></div><div class="dialog-projects"></div>';projects.forEach((p,i)=>$('.dialog-projects').append(createCard(p,i)));showDialog();$('#close-dialog').focus();}
$('#all-work').addEventListener('click',openGallery);
$('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{modalAnimation=null;document.body.style.overflow='';cards.forEach(c=>c.hover=false);if(lastFocus?.isConnected)lastFocus.focus();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
let previous=0;
function animate(now){const dt=Math.min((now-previous)/1000,.05);previous=now;if(!document.hidden){if(player.playing){player.time=Math.min(player.duration,player.time+dt*player.speed);renderHero(heroCtx,player.time);updatePlayer();if(player.time>=player.duration)setPlaying(false);}cards.forEach(card=>{if(card.hover&&card.canvas.isConnected&&!reducedMotion.matches){card.time+=dt;renderers[card.project.id](card.ctx,card.time,960,560);}});if(modalAnimation?.playing&&dialog.open){modalAnimation.time+=dt;renderers[modalAnimation.project.id](modalAnimation.ctx,modalAnimation.time,960,560);}}requestAnimationFrame(animate);}
requestAnimationFrame(animate);
