'use strict';
const $=s=>document.querySelector(s);
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const font='-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const canvas=$('#main-canvas'),ctx=canvas.getContext('2d');
const player={time:0,duration:24,playing:false,frame:0,last:0};
let expanded=false,lastFocus=null;
function rr(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function txt(c,s,x,y,size,color,weight=500){c.font=`${weight} ${size}px ${font}`;c.fillStyle=color;c.fillText(s,x,y);}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
function shadow(c,color,blur,y){c.shadowColor=color;c.shadowBlur=blur;c.shadowOffsetY=y;c.shadowOffsetX=0;}
function grain(c,w,h){c.fillStyle='#294f5909';for(let y=2;y<h;y+=9)for(let x=(y%7);x<w;x+=11)c.fillRect(x,y,.6,.6);}
function littleStar(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(r*.1,-r*.15,r*.15,-r*.1,r,0);c.bezierCurveTo(r*.15,r*.1,r*.1,r*.15,0,r);c.bezierCurveTo(-r*.1,r*.15,-r*.15,r*.1,-r,0);c.bezierCurveTo(-r*.15,-r*.1,-r*.1,-r*.15,0,-r);c.fillStyle=color;c.fill();c.restore();}
function renderMain(t){
  const w=1440,h=810;ctx.clearRect(0,0,w,h);
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#d7ebed');bg.addColorStop(.48,'#c2e0e7');bg.addColorStop(1,'#dbecee');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);grain(ctx,w,h);
  const shift=Math.sin(t*.7)*12,tilt=Math.sin(t*.45)*.017;
  // The back page catches light along its white rim.
  ctx.save();ctx.translate(803+shift,400);ctx.rotate(.13+tilt);shadow(ctx,'#476f7626',55,30);rr(ctx,-335,-222,670,420,36,'#ecf4f3','#faffff');shadow(ctx,'transparent',0,0);rr(ctx,-300,-184,600,280,21,'#d7e9e5');ctx.restore();
  // An illustrated frame with soft, physical edges.
  ctx.save();ctx.translate(718-shift*.5,383+Math.cos(t*.7)*8);ctx.rotate(-.065+tilt);shadow(ctx,'#3a646b30',42,30);rr(ctx,-354,-231,708,458,37,'#fff','#fff');shadow(ctx,'transparent',0,0);
  rr(ctx,-342,-219,684,381,27,'#f4f5ed');
  const inset=ctx.createLinearGradient(-342,-219,342,162);inset.addColorStop(0,'#f7f7f0');inset.addColorStop(1,'#eaeee1');rr(ctx,-342,-219,684,381,27,inset);
  txt(ctx,'a little',-304,-80,74,'#637665',490);txt(ctx,'play.',-307,18,96,'#637665',540);txt(ctx,'GOOD THINGS START WITH CURIOSITY.',-301,105,10,'#a2b09a',500);
  // Rounded, porcelain-like loops, with broad highlights and a soft shadow.
  ctx.save();ctx.translate(182,0);ctx.rotate(-.2+t*.12);
  shadow(ctx,'#76865d2b',24,16);
  for(let i=9;i>=0;i--){ctx.beginPath();ctx.ellipse(-i*.5,-i,94,113,.2,0,Math.PI*2);ctx.lineWidth=36;const loop=ctx.createLinearGradient(-95,-120,95,120);loop.addColorStop(0,'#fffef8');loop.addColorStop(.5,'#eceddf');loop.addColorStop(1,'#ccd3bc');ctx.strokeStyle=loop;ctx.stroke();shadow(ctx,'transparent',0,0);}
  ctx.beginPath();ctx.ellipse(-5,-9,95,113,.2,0,Math.PI*2);ctx.strokeStyle='#ffffffb3';ctx.lineWidth=2;ctx.stroke();
  ctx.restore();
  rr(ctx,-304,183,18,18,6,'#edf1e8');littleStar(ctx,-295,192,6,'#a5b699');txt(ctx,'a motion study',-274,197,13,'#a1aaa1');txt(ctx,'01',297,197,12,'#b7bdb4');ctx.restore();
  // A small warm accent ties the artwork to the red hat in the avatar.
  ctx.save();ctx.translate(1087+Math.cos(t*.6)*10,204+Math.sin(t*.8)*9);ctx.rotate(.2+Math.sin(t*.5)*.08);shadow(ctx,'#5b777225',22,10);const tile=ctx.createLinearGradient(-36,-36,36,36);tile.addColorStop(0,'#efb0a2');tile.addColorStop(1,'#d88778');rr(ctx,-38,-38,76,76,21,tile,'#f4c4b4');shadow(ctx,'transparent',0,0);littleStar(ctx,0,0,17,'#f9dfd3',t*.18);ctx.restore();
}
function renderLeft(){const c=$('#left-canvas').getContext('2d');const g=c.createLinearGradient(0,0,560,690);g.addColorStop(0,'#d9e5d0');g.addColorStop(1,'#becdaf');c.fillStyle=g;c.fillRect(0,0,560,690);grain(c,560,690);txt(c,'small',54,113,66,'#6b8060',500);txt(c,'wonders.',54,181,66,'#6b8060',500);for(let i=3;i>=0;i--){c.save();c.translate(297,427);c.rotate(-.2+i*.17);shadow(c,'#4d673629',25,14);rr(c,-123,-135,246,270,31,i===0?'#f7f7ee':'#e3e9d8','#fcfff4');shadow(c,'transparent',0,0);if(i===0){littleStar(c,0,-11,75,'#b2c692');circle(c,0,-11,19,'#f7f7ee');}c.restore();}}
function renderRight(){const c=$('#right-canvas').getContext('2d');c.fillStyle='#ecd9d4';c.fillRect(0,0,560,690);grain(c,560,690);txt(c,'a softer',48,119,59,'#a7776b',500);txt(c,'side.',48,182,59,'#a7776b',500);c.save();c.translate(290,420);c.rotate(.18);shadow(c,'#8c655226',25,19);rr(c,-156,-153,312,302,60,'#f9f5ec','#fffaf5');shadow(c,'transparent',0,0);const g=c.createLinearGradient(-100,-100,100,100);g.addColorStop(0,'#e7aa97');g.addColorStop(1,'#bd7a65');c.beginPath();c.arc(0,0,92,0,Math.PI*2);c.strokeStyle=g;c.lineWidth=39;c.stroke();c.beginPath();c.arc(-3,-4,92,Math.PI,Math.PI*1.6);c.strokeStyle='#f4c5b6';c.lineWidth=3;c.stroke();c.restore();}
renderMain(0);renderLeft();renderRight();
function format(t){return `00:${Math.floor(t).toString().padStart(2,'0')}`;}
function update(){const value=`${format(player.time)} / 00:24`;$('#time-label').textContent=value;$('#expanded-time').textContent=value;for(const el of [$('#timeline'),$('#expanded-timeline')]){el.value=player.time;el.style.setProperty('--progress',`${player.time/24*100}%`);el.setAttribute('aria-valuetext',`${Math.floor(player.time)} секунд из 24`);}}
function play(value){if(value&&player.time>=24)player.time=0;player.playing=value;$('#scene').classList.toggle('playing',value);$('#play-button').innerHTML=`${icon(value?'pause':'play')}<span>${value?'На паузу':'Смотреть шоурил'}</span>`;$('#play-button').setAttribute('aria-label',value?'Приостановить демо-шоурил':'Воспроизвести демо-шоурил');$('#expanded-play').innerHTML=icon(value?'pause':'play');$('#expanded-play').setAttribute('aria-label',value?'Приостановить демо-шоурил':'Воспроизвести демо-шоурил');$('#poster-play').disabled=value;$('#poster-play').tabIndex=value?-1:0;$('#poster-play').setAttribute('aria-hidden',String(value));cancelAnimationFrame(player.frame);if(value){player.last=performance.now();player.frame=requestAnimationFrame(tick);}update();}
function tick(now){if(!player.playing)return;player.time=Math.min(24,player.time+Math.min((now-player.last)/1000,.06));player.last=now;renderMain(player.time);update();if(player.time>=24)play(false);else player.frame=requestAnimationFrame(tick);}
$('#poster-play').addEventListener('click',()=>play(true));$('#play-button').addEventListener('click',()=>play(!player.playing));$('#expanded-play').addEventListener('click',()=>play(!player.playing));
canvas.addEventListener('click',()=>play(!player.playing));
$('#restart').addEventListener('click',()=>{player.time=0;renderMain(0);play(true);});
for(const el of [$('#timeline'),$('#expanded-timeline')])el.addEventListener('input',e=>{player.time=Number(e.target.value);renderMain(player.time);update();if(player.time>=24)play(false);});
function setExpanded(value){expanded=value;document.body.classList.toggle('expanded',value);$('#expanded-controls').hidden=!value;const card=$('#player-card');if(value){lastFocus=document.activeElement;card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','Просмотр демо-шоурила');}else{card.removeAttribute('role');card.removeAttribute('aria-modal');card.removeAttribute('aria-label');}for(const s of ['.site-header','.intro','.player-dock','.playback-info','.demo-note'])$(s).inert=value;if(value)$('#close-expanded').focus();else if(lastFocus?.isConnected)lastFocus.focus();}
$('#fullscreen').addEventListener('click',()=>setExpanded(true));$('#close-expanded').addEventListener('click',()=>setExpanded(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){e.preventDefault();setExpanded(false);}if(e.key==='Tab'&&expanded){const buttons=[$('#poster-play'),$('#expanded-play'),$('#expanded-timeline'),$('#close-expanded')].filter(el=>!el.disabled);const i=buttons.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&(i<0||i===buttons.length-1)){e.preventDefault();buttons[0].focus();}}if(e.code==='Space'&&(e.target===document.body||e.target===canvas)){e.preventDefault();play(!player.playing);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)play(false);});
