// noctua-app/src/pages/LandingPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const STYLE_ID = 'noctua-lp-v6'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

/* --- 5. SCROLL SUAVE GLOBAL --- */
html {
  scroll-behavior: smooth;
}

.LP4{
  --a:#D9A441;--ag:rgba(217,164,65,.12);--agl:rgba(217,164,65,.35);
  --bg:#0a091a;--mo:'Space Mono',monospace;
  --mu:rgba(255,255,255,.55);
  font-family:'Poppins',sans-serif;
  background:var(--bg);color:#f0eeff;
  overflow-x:clip;
  -webkit-font-smoothing:antialiased;
}
.LP4,.LP4 *,.LP4 *::before,.LP4 *::after{box-sizing:border-box;margin:0;padding:0}
.LP4 a{text-decoration:none;color:inherit;cursor:pointer}

/* NOISE */
.LP4 .noise{position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:.035;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* AURORA BLOBS (Bolas en movimiento) */
.LP4 .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.LP4 .ab-wrap{position:absolute;border-radius:50%;will-change:transform;transition:transform 1.2s cubic-bezier(.22,1,.36,1)}
.LP4 .ab-inner{width:100%;height:100%;border-radius:50%}
.LP4 .ab1{width:700px;height:700px;top:-15%;left:-10%}
.LP4 .ab1 .ab-inner{background:radial-gradient(circle,rgba(91,76,196,.55) 0%,rgba(91,76,196,0) 70%);filter:blur(60px);animation:lpaf1 10s ease-in-out infinite}
.LP4 .ab2{width:550px;height:550px;top:20%;right:-10%;transition-duration:1.4s}
.LP4 .ab2 .ab-inner{background:radial-gradient(circle,rgba(239,159,39,.35) 0%,rgba(239,159,39,0) 70%);filter:blur(70px);animation:lpaf2 12s ease-in-out infinite}
.LP4 .ab3{width:650px;height:650px;bottom:-15%;right:5%;transition-duration:1.3s}
.LP4 .ab3 .ab-inner{background:radial-gradient(circle,rgba(167,139,250,.45) 0%,rgba(167,139,250,0) 70%);filter:blur(65px);animation:lpaf3 11s ease-in-out infinite}
@keyframes lpaf1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(80px,100px) scale(1.1)}50%{transform:translate(-60px,140px) scale(.95)}75%{transform:translate(-100px,40px) scale(1.05)}}
@keyframes lpaf2{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-120px,80px) scale(.9)}50%{transform:translate(-80px,-100px) scale(1.15)}75%{transform:translate(60px,-60px) scale(1)}}
@keyframes lpaf3{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(90px,-100px) scale(1.1)}50%{transform:translate(-70px,-140px) scale(.92)}75%{transform:translate(-110px,-50px) scale(1.08)}}

/* FIXED VIDEO BG */
.LP4 .vbg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:var(--bg)}
.LP4 .vbg video{width:100%;height:100%;object-fit:cover;opacity:.28}
.LP4 .vbg-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,9,26,.6) 0%,transparent 30%,transparent 70%,rgba(10,9,26,.92) 100%)}

/* VERTICAL GUIDES */
.LP4 .vg::before,.LP4 .vg::after{content:'';position:fixed;top:0;bottom:0;width:1px;background:rgba(255,255,255,.025);pointer-events:none;z-index:1}
.LP4 .vg::before{left:25%}.LP4 .vg::after{right:25%}

/* LIQUID GLASS */
.LP4 .lg{position:relative;background:rgba(255,255,255,.04);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6)}
.LP4 .lg::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.04) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,.08) 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}

/* NAV */
.LP4 .nav{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:500;display:flex;align-items:center;justify-content:space-between;padding:.55rem .55rem .55rem 1.5rem;border-radius:9999px;width:min(680px,90vw)}
.LP4 .nlogo{font-size:1.1rem;font-weight:800;letter-spacing:.06em;color:#fff;margin-right:1rem}
.LP4 .nlogo span{color:var(--a)}
.LP4 .nlinks{display:flex;gap:1.5rem;list-style:none}
.LP4 .nlinks a{font-size:.8rem;font-weight:600;color:var(--mu);transition:color .15s}
.LP4 .nlinks a:hover{color:#fff}
.LP4 .nbtn{display:inline-flex;align-items:center;background:var(--a);color:#0a091a;font-weight:700;font-size:.82rem;padding:.5rem 1.1rem;border-radius:9999px;border:none;transition:transform .12s,box-shadow .15s;flex-shrink:0;cursor:pointer}
.LP4 .nbtn:hover{transform:translateY(-1px);box-shadow:0 6px 24px var(--agl)}
.LP4 .nbtn-outline{display:inline-flex;align-items:center;background:#ffffff;color:var(--bg);font-weight:700;font-size:.82rem;padding:.5rem 1.1rem;border-radius:9999px;border:none;transition:transform .12s,background .15s;flex-shrink:0;cursor:pointer}
.LP4 .nbtn-outline:hover{background:rgba(255,255,255,.85);transform:translateY(-1px)}

/* BUTTONS */
.LP4 .ba{display:inline-flex;align-items:center;gap:.45rem;background:var(--a);color:#0a091a;font-weight:700;font-size:.9rem;padding:.7rem 1.6rem;border-radius:9999px;border:none;transition:transform .12s,box-shadow .15s;cursor:pointer}
.LP4 .ba:hover{transform:translateY(-1px);box-shadow:0 8px 28px var(--agl)}
.LP4 .ba-lg{font-size:1rem;padding:.85rem 2rem}
.LP4 .bgb{display:inline-flex;align-items:center;gap:.45rem;background:#ffffff;color:var(--bg);font-weight:600;font-size:.9rem;padding:.7rem 1.6rem;border-radius:9999px;border:none;transition:background .15s;cursor:pointer}
.LP4 .bgb:hover{background:rgba(255,255,255,.85)}

/* HERO */
.LP4 .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:140px 5vw 80px;position:relative;z-index:2}
.LP4 .pill{display:inline-flex;align-items:center;gap:.55rem;background:var(--ag);border:1px solid rgba(217,164,65,.25);border-radius:9999px;padding:.3rem 1rem;font-size:.7rem;font-weight:600;color:var(--a);letter-spacing:.08em;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:lpfu .6s .1s forwards}
.LP4 .pdot{width:6px;height:6px;background:var(--a);border-radius:50%;box-shadow:0 0 8px var(--a);animation:lpbl 2s infinite}
@keyframes lpbl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
.LP4 .h1{font-size:clamp(3rem,9vw,8.5rem);font-weight:900;line-height:.96;letter-spacing:-.04em;margin-bottom:1.4rem;opacity:0;animation:lpfu .85s .2s cubic-bezier(.22,1,.36,1) forwards}
@media(max-width:600px){.LP4 .h1{font-size:2.4rem}}
.LP4 .shine{background:linear-gradient(90deg,rgba(217,164,65,0) 0%,rgba(217,164,65,1) 20%,rgba(248,220,140,1) 50%,rgba(217,164,65,1) 80%,rgba(217,164,65,0) 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:lpshine 3.5s linear infinite}
@keyframes lpshine{from{background-position:-200% center}to{background-position:200% center}}
.LP4 .sub{font-size:clamp(.9rem,1.6vw,1.15rem);color:var(--mu);max-width:520px;line-height:1.7;margin-bottom:2.5rem;font-weight:300;opacity:0;animation:lpfu .7s .4s forwards}
.LP4 .hbtns{display:flex;gap:.75rem;align-items:center;justify-content:center;flex-wrap:wrap;opacity:0;animation:lpfu .6s .56s forwards}

/* SCROLL INDICATOR */
.LP4 .scrollh{position:relative;margin-top:3.5rem;display:flex;flex-direction:column;align-items:center;gap:.4rem;color:rgba(255,255,255,.3);font-family:var(--mo);font-size:.58rem;letter-spacing:.12em;z-index:2;opacity:0;animation:lpfu .5s 1.1s forwards}
.LP4 .scrolll{width:1px;height:32px;background:linear-gradient(to bottom,var(--a),transparent);animation:lpsd 2s 1.4s infinite}
@keyframes lpsd{0%{transform:scaleY(0);transform-origin:top}49%{transform:scaleY(1);transform-origin:top}50%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
@keyframes lpfu{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}

/* STATS */
.LP4 .stats{display:flex;justify-content:center;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);background:rgba(10,9,26,.5);backdrop-filter:blur(12px);position:relative;z-index:2}
.LP4 .stat{flex:1;max-width:240px;text-align:center;padding:2.25rem 1rem;border-right:1px solid rgba(255,255,255,.06);opacity:0;transform:translateY(14px);transition:opacity .5s,transform .5s}
.LP4 .stat:last-child{border-right:none}
.LP4 .stat.vis{opacity:1;transform:none}
.LP4 .stn{font-size:clamp(1.8rem,3vw,2.6rem);font-weight:800;color:var(--a);line-height:1;letter-spacing:-.04em}
.LP4 .stl{font-size:.7rem;color:var(--mu);margin-top:.35rem;font-weight:500;letter-spacing:.04em}

/* MARQUEE */
.LP4 .mqs{padding:1.6rem 0;border-bottom:1px solid rgba(255,255,255,.06);overflow:hidden;position:relative;background:rgba(10,9,26,.4);backdrop-filter:blur(8px);z-index:2}
.LP4 .mqs::before,.LP4 .mqs::after{content:'';position:absolute;top:0;bottom:0;width:140px;z-index:2;pointer-events:none}
.LP4 .mqs::before{left:0;background:linear-gradient(to right,rgba(10,9,26,.9),transparent)}
.LP4 .mqs::after{right:0;background:linear-gradient(to left,rgba(10,9,26,.9),transparent)}
.LP4 .mqlbl{text-align:center;font-family:var(--mo);font-size:.6rem;color:rgba(255,255,255,.3);letter-spacing:.14em;text-transform:uppercase;margin-bottom:1.1rem}
.LP4 .mqw{overflow:hidden}
.LP4 .mqt{display:flex;gap:2rem;width:max-content;animation:lpmq 28s linear infinite}
@keyframes lpmq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.LP4 .mqi{display:flex;align-items:center;gap:.6rem;font-size:.78rem;font-weight:600;color:rgba(255,255,255,.32);white-space:nowrap;flex-shrink:0}
.LP4 .mqic{width:26px;height:26px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--mo);font-size:.6rem;font-weight:700;color:var(--a);background:var(--ag);border:1px solid rgba(217,164,65,.18)}

/* SHARED */
.LP4 .stag{font-family:var(--mo);font-size:.64rem;color:var(--a);letter-spacing:.12em;text-transform:uppercase;margin-bottom:.75rem;display:block}
.LP4 .stitle{font-size:clamp(1.6rem,2.8vw,2.5rem);font-weight:800;letter-spacing:-.04em;line-height:1.06;margin-bottom:.9rem}
.LP4 .sdesc{font-size:.9rem;color:var(--mu);line-height:1.7;font-weight:300;margin-bottom:1.75rem}

/* PRODUCT */
.LP4 .prod{padding:7rem 5vw;position:relative;z-index:2}
.LP4 .prod-in{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:5vw;flex-wrap:wrap}
.LP4 .ptxt{flex:0 0 36%;min-width:260px}
.LP4 .mk{flex:1;min-width:300px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.1);box-shadow:0 40px 100px rgba(0,0,0,.5);transition:transform .4s ease}
.LP4 .mk:hover{transform:translateY(-5px)}
.LP4 .mkbar{background:rgba(0,0,0,.5);border-bottom:1px solid rgba(255,255,255,.07);padding:.6rem .9rem;display:flex;align-items:center;gap:.55rem}
.LP4 .mkdots{display:flex;gap:.32rem}
.LP4 .mkdot{width:9px;height:9px;border-radius:50%}
.LP4 .mktitle{font-family:var(--mo);font-size:.58rem;color:rgba(255,255,255,.3);flex:1;text-align:center}
.LP4 .mkbody{padding:.9rem}
.LP4 .mkmet{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.6rem}
.LP4 .mkm{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.5rem .65rem}
.LP4 .mkml{font-size:.54rem;color:rgba(255,255,255,.4);margin-bottom:.18rem;font-weight:500}
.LP4 .mkmv{font-family:var(--mo);font-size:.9rem;font-weight:700}
.LP4 .mkchart{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.65rem;margin-bottom:.6rem;height:64px;position:relative;overflow:hidden}
.LP4 .mkrow{display:flex;align-items:center;gap:.5rem;padding:.38rem .55rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;margin-bottom:.32rem}
.LP4 .mkrow:last-child{margin-bottom:0}
.LP4 .mkrd{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.LP4 .mkrn{font-size:.65rem;font-weight:600;flex:1}
.LP4 .mkrb{font-family:var(--mo);font-size:.56rem;padding:.08rem .36rem;border-radius:4px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.4)}

/* 4. PHRASE (EFECTO AURA SWEEP CON LETRAS BLANCAS A ÁMBAR) */
.LP4 .phr{padding:9rem 5vw;text-align:center;position:relative;overflow:hidden;z-index:2}
.LP4 .phglow{position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:700px;height:320px;border-radius:50%;background:radial-gradient(ellipse,rgba(217,164,65,.07) 0%,transparent 70%);pointer-events:none}
.LP4 .phtxt{
  font-size:clamp(2.2rem,5.5vw,5.2rem);
  font-weight:800;
  letter-spacing:-.045em;
  line-height:1.08;
  color: #f0eeff; /* Inicia blanca/gris clara */
}
.LP4 .phtxt.sweep{
  animation: auraSweep 2.5s ease-in-out forwards;
}
@keyframes auraSweep {
  0% { 
    color: #f0eeff; 
    text-shadow: 0 0 0px rgba(255,255,255,0); 
  }
  40% { 
    color: #ffffff; 
    text-shadow: 0 0 30px rgba(255,255,255,1), 0 0 50px rgba(255,255,255,0.8); 
  }
  100% { 
    color: var(--a); /* Queda amarillo ámbar */
    text-shadow: 0 0 0px rgba(255,255,255,0); 
  }
}
.LP4 .phsub{font-size:.95rem;color:var(--mu);font-weight:300;margin-top:1.2rem;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.65}

/* STICKY */
.LP4 .sw{position:relative;height:400vh;z-index:2}
.LP4 .si{position:sticky;top:68px;height:calc(100vh - 68px);display:flex;align-items:center;padding:0 5vw;gap:5vw;overflow:hidden}
.LP4 .sl{flex:0 0 44%;min-width:240px}
.LP4 .slt{font-size:clamp(1.8rem,2.8vw,2.7rem);font-weight:800;letter-spacing:-.04em;line-height:1.06;margin-bottom:.85rem}
.LP4 .sld{font-size:.88rem;color:var(--mu);line-height:1.7;max-width:340px;font-weight:300;margin-bottom:1.6rem}
.LP4 .dots{display:flex;gap:.44rem;margin-top:1.75rem}
.LP4 .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);transition:background .28s,width .28s}
.LP4 .dot.on{background:var(--a);width:22px;border-radius:3px}
.LP4 .sr{flex:1;position:relative;height:380px}
.LP4 .fc{position:absolute;inset:0;border-radius:20px;padding:2.25rem;display:flex;flex-direction:column;transition:opacity .44s cubic-bezier(.4,0,.2,1),transform .44s cubic-bezier(.4,0,.2,1);opacity:0;transform:translateY(28px) scale(.98);pointer-events:none}
.LP4 .fc.on{opacity:1;transform:none;pointer-events:auto}
.LP4 .fc.done{opacity:0;transform:translateY(-22px) scale(.98)}
.LP4 .fcn{font-family:var(--mo);font-size:.63rem;color:rgba(255,255,255,.35);margin-bottom:.7rem}
.LP4 .fcn b{color:var(--a)}
.LP4 .fce{display:inline-block;font-family:var(--mo);font-size:.6rem;background:var(--ag);border:1px solid rgba(217,164,65,.18);color:var(--a);padding:.2rem .65rem;border-radius:5px;width:fit-content;margin-bottom:.95rem}
.LP4 .fct{font-size:1.55rem;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:.85rem}
.LP4 .fcd{font-size:.86rem;color:var(--mu);line-height:1.7;flex:1;font-weight:300}
.LP4 .fctg{margin-top:1.1rem;font-family:var(--mo);font-size:.58rem;color:rgba(255,255,255,.28);border-top:1px solid rgba(255,255,255,.07);padding-top:.9rem}

/* HOW */
.LP4 .how{padding:7rem 5vw;position:relative;z-index:2}
.LP4 .how-in{max-width:1200px;margin:0 auto;display:flex;gap:5vw;flex-wrap:wrap;align-items:flex-start}
.LP4 .howtxt{flex:0 0 38%;min-width:240px;position:sticky;top:80px}
.LP4 .howsteps{flex:1}
.LP4 .hs{display:flex;gap:1.2rem;padding:1.45rem 0;border-bottom:1px solid rgba(255,255,255,.06);opacity:0;transform:translateX(20px);transition:opacity .48s,transform .48s}
.LP4 .hs.vis{opacity:1;transform:none}
.LP4 .hsn{font-family:var(--mo);font-size:.63rem;color:var(--a);opacity:.5;width:20px;flex-shrink:0;padding-top:4px}
.LP4 .hst{font-size:.97rem;font-weight:700;margin-bottom:.32rem;letter-spacing:-.02em;transition:color .15s}
.LP4 .hs:hover .hst{color:var(--a)}
.LP4 .hsd{font-size:.84rem;color:var(--mu);line-height:1.65;font-weight:300}

/* CTA */
.LP4 .cta{padding:10rem 5vw;text-align:center;position:relative;overflow:hidden;z-index:2}
.LP4 .ctaw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.LP4 .cwave{position:absolute;border-radius:50%;border:1px solid rgba(217,164,65,.1);transform:scale(0);transition:transform 1.5s cubic-bezier(.19,1,.22,1),opacity 1.3s;opacity:0}
.LP4 .cwave.on{opacity:1}
.LP4 .cwave:nth-child(1).on{transform:scale(1);transition-delay:0s}
.LP4 .cwave:nth-child(2).on{transform:scale(1);transition-delay:.22s}
.LP4 .cwave:nth-child(3).on{transform:scale(1);transition-delay:.44s}
.LP4 .cwave:nth-child(4).on{transform:scale(1);transition-delay:.66s}
.LP4 .ctabody{position:relative;z-index:1}
.LP4 .ctatitle{font-size:clamp(2.2rem,5.5vw,5rem);font-weight:800;letter-spacing:-.045em;line-height:1;margin-bottom:1.1rem}
.LP4 .ctasub{font-size:.95rem;color:var(--mu);font-weight:300;max-width:440px;margin:0 auto 2.25rem;line-height:1.65}
.LP4 .ctabtns{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}

/* FOOTER MARQUEE */
.LP4 .fmq{padding:3rem 0 2rem;overflow:hidden;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.5);backdrop-filter:blur(16px);position:relative;z-index:2}
.LP4 .fmqt{display:flex;white-space:nowrap;animation:lpfmq 32s linear infinite;width:max-content}
@keyframes lpfmq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.LP4 .fmqi{font-size:clamp(3rem,8vw,7rem);font-weight:900;letter-spacing:-.04em;color:rgba(255,255,255,.07);padding:0 2rem;flex-shrink:0}
.LP4 .fmqi span{color:rgba(217,164,65,.18)}

/* FOOTER */
.LP4 .footer{padding:2.5rem 5vw 2rem;background:rgba(0,0,0,.6);backdrop-filter:blur(16px);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;position:relative;z-index:2}
.LP4 .flogo{font-family:'Poppins',sans-serif;font-size:1rem;font-weight:800;letter-spacing:.06em;color:#fff}
.LP4 .flogo span{color:var(--a)}
.LP4 .flinks{display:flex;gap:1.5rem;list-style:none;flex-wrap:wrap}
.LP4 .flinks a{font-size:.76rem;color:rgba(255,255,255,.35);font-weight:500;transition:color .15s}
.LP4 .flinks a:hover{color:#fff}
.LP4 .fcopy{font-family:var(--mo);font-size:.6rem;color:rgba(255,255,255,.2)}

@media(max-width:768px){
  .LP4 .nlinks{display:none}
  .LP4 .si{flex-direction:column;padding:2.5rem 5vw;align-items:flex-start}
  .LP4 .sr{width:100%;height:280px}
  .LP4 .prod-in,.LP4 .how-in{flex-direction:column}
  .LP4 .howtxt{position:static}
}
@media(prefers-reduced-motion:reduce){.LP4 *{animation:none!important;transition:none!important}}
`

const TECH = ['Laravel','n8n','WordPress','Redis','PostgreSQL','Docker','Python','FastAPI','MySQL','Horizon']
const CARDS = [
  { n:'01', e:'Detección en segundos', t:'Vigilancia que nunca descansa', d:'Métricas de CPU, memoria y latencia reportadas cada 30 segundos. noctua detecta anomalías antes de que tus usuarios las sientan.', tg:'metrics-agent · heartbeat · sidecar Docker' },
  { n:'02', e:'Alertas sin ruido', t:'Solo te avisamos cuando importa', d:'Define umbrales por severidad y fallos consecutivos. El motor filtra picos transitorios y dispara alertas reales con contexto completo.', tg:'alert-engine · consecutive_failures · severity' },
  { n:'03', e:'Historial colaborativo', t:'Del incidente al postmortem sin fricción', d:'Documenta causa raíz, notas de resolución y tags. El Operador actúa, el Admin supervisa, el equipo aprende.', tg:'historial · resolution_notes · tags' },
  { n:'04', e:'Plantillas Docker', t:'Provisiona servicios en un clic', d:'Laravel, n8n, WordPress, Redis listos para levantar. Load generator incluido para demos realistas desde el primer minuto.', tg:'container-manager · load-generator · k6' },
]
const HOW = [
  { n:'01', t:'Registrate como Admin', d:'Crea tu equipo en segundos. Recibís un email de bienvenida y quedás listo para invitar colaboradores.' },
  { n:'02', t:'Registra un servicio', d:'Servicio externo o con plantilla Docker. Obtenés una API key única que el sidecar usa para reportar métricas.' },
  { n:'03', t:'Define reglas de alerta', d:'Umbrales por métrica, severidad y fallos consecutivos. noctua aprende el baseline de tu servicio.' },
  { n:'04', t:'Recibí alertas cuando importa', d:'Email con diseño dark-mode. El Operador documenta, el Admin supervisa. Historial siempre disponible.' },
]
const FMQ_ITEMS = Array(10).fill(null)

const Arr = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

export default function LandingPage() {
  const barRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const howRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const phraseRef = useRef<HTMLDivElement>(null)
  const ctaWRef = useRef<HTMLDivElement>(null)
  const ab1Ref = useRef<HTMLDivElement>(null)
  const ab2Ref = useRef<HTMLDivElement>(null)
  const ab3Ref = useRef<HTMLDivElement>(null)
  const lastCard = useRef(-1)

  const [card, setCard] = useState(0)
  const [statsV, setSV] = useState(false)
  const [phV, setPV] = useState(false)
  const [waveV, setWV] = useState(false)

  // 5. Scroll Suave
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // inject CSS once
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.getElementById(STYLE_ID)?.remove() }
  }, [])

  // progress bar
  useEffect(() => {
    const fn = () => {
      if (!barRef.current) return
      barRef.current.style.width = (window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100) + '%'
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // IO
  useEffect(() => {
    const io = new IntersectionObserver(e => {
      e.forEach(x => {
        if (!x.isIntersecting) return
        if (x.target === statsRef.current) setSV(true)
        if (x.target === phraseRef.current) setPV(true) // 4. Activa la clase sweep
        if (x.target === ctaWRef.current) setWV(true)
        if (x.target.classList.contains('hs')) x.target.classList.add('vis')
      })
    }, { threshold: 0.28 })
    const watch = [statsRef.current, phraseRef.current, ctaWRef.current]
    watch.forEach(t => t && io.observe(t))
    howRef.current?.querySelectorAll('.hs').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  // sticky cards
  useEffect(() => {
    const fn = () => {
      if (!stickyRef.current) return
      const r = stickyRef.current.getBoundingClientRect()
      const h = stickyRef.current.offsetHeight
      const p = Math.max(0, Math.min(.9999, -r.top / (h - window.innerHeight)))
      const idx = Math.min(CARDS.length - 1, Math.floor(p * CARDS.length))
      if (idx !== lastCard.current) { lastCard.current = idx; setCard(idx) }
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // aurora mouse parallax
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    let raf: number | null = null
    const fn = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2
        const ny = (e.clientY / window.innerHeight - 0.5) * 2
        if (ab1Ref.current) ab1Ref.current.style.transform = `translate(${nx * -80}px,${ny * -80}px)`
        if (ab2Ref.current) ab2Ref.current.style.transform = `translate(${nx * 100}px,${ny * 70}px)`
        if (ab3Ref.current) ab3Ref.current.style.transform = `translate(${nx * 50}px,${ny * -90}px)`
        raf = null
      })
    }
    window.addEventListener('mousemove', fn)
    return () => { window.removeEventListener('mousemove', fn); if (raf) cancelAnimationFrame(raf) }
  }, [])

  const techX2 = [...TECH, ...TECH]

  return (
    <div className="LP4 vg">
      {/* grain */}
      <div className="noise"/>

      {/* ── AURORA BLOBS ── */}
      <div className="aurora" aria-hidden="true">
        <div ref={ab1Ref} className="ab-wrap ab1"><div className="ab-inner"/></div>
        <div ref={ab2Ref} className="ab-wrap ab2"><div className="ab-inner"/></div>
        <div ref={ab3Ref} className="ab-wrap ab3"><div className="ab-inner"/></div>
      </div>

      {/* ── VIDEO BG ── */}
      <div className="vbg">
        <video autoPlay loop muted playsInline src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4" />
        <div className="vbg-grad"/>
      </div>

      {/* ── PROGRESS ── */}
      <div ref={barRef} style={{ position:'fixed', top:0, left:0, height:2, width:'0%', background:'#D9A441', zIndex:9999, boxShadow:'0 0 12px rgba(217,164,65,.35)', pointerEvents:'none' }}/>

      {/* ── NAV ── */}
      <nav className="nav lg">
        {/* 1. noctua en minúsculas */}
        <div className="nlogo">n<span>o</span>ctua</div>
        <ul className="nlinks">
          {/* 5. Scroll suave */}
          <li><a onClick={(e) => handleSmoothScroll(e, 'prod')}>Producto</a></li>
          <li><a onClick={(e) => handleSmoothScroll(e, 'features')}>Características</a></li>
          <li><a onClick={(e) => handleSmoothScroll(e, 'empresa')}>Empresa</a></li>
        </ul>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {/* 2. "Inicia sesión" a la izq y color principal, "Empezar gratis" secundario MODIFICADO A FONDO BLANCO */}
          <Link to="/login" className="nbtn">Inicia sesión</Link>
          <Link to="/register" className="nbtn-outline">Empezar gratis</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="pill"><span className="pdot"/>MONITOREO EN TIEMPO REAL</div>
        <h1 className="h1">Vigila mientras<br/><span className="shine">dormís</span></h1>
        <p className="sub">noctua detecta, alerta y documenta cada incidente antes de que tus usuarios lo noten. Vigilancia continua para equipos que no pueden fallar.</p>
        <div className="hbtns">
          {/* 2. "Inicia sesión" a la izq y color principal MODIFICADO A FONDO BLANCO PARA EMPEZAR GRATIS */}
          <Link to="/login" className="ba ba-lg">Inicia sesión</Link>
          <Link to="/register" className="bgb">Empezar gratis<Arr /></Link>
        </div>
        <div className="scrollh">
          <span>SCROLL</span>
          <div className="scrolll"/>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats" ref={statsRef}>
        {[{n:'99.97%',l:'Uptime promedio'},{n:'<3s',l:'Tiempo de detección'},{n:'24/7',l:'Vigilancia continua'},{n:'6+',l:'Plantillas Docker'}].map((s,i) => (
          <div key={s.l} className={`stat${statsV?' vis':''}`} style={{ transitionDelay:`${i*.08}s` }}>
            <div className="stn">{s.n}</div><div className="stl">{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── MARQUEE ── */}
      <div className="mqs">
        <p className="mqlbl">Compatible con tu stack</p>
        <div className="mqw">
          <div className="mqt">
            {techX2.map((t,i) => <div key={i} className="mqi"><div className="mqic">{t[0]}</div>{t}</div>)}
          </div>
        </div>
      </div>

      {/* ── PRODUCT ── */}
      <section className="prod" id="prod">
        <div className="prod-in">
          <div className="ptxt">
            <span className="stag">// DASHBOARD</span>
            <h2 className="stitle">Todo tu stack<br/>Un solo panel</h2>
            <p className="sdesc">Métricas, servicios, incidentes y equipo en tiempo real. Sin configuración manual.</p>
            <Link to="/register" className="ba">Probar ahora<Arr s={13}/></Link>
          </div>
          <div className="mk lg">
            <div className="mkbar">
              <div className="mkdots">
                {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} className="mkdot" style={{ background:c }}/>)}
              </div>
              <div className="mktitle">noctua — dashboard</div>
            </div>
            <div className="mkbody">
              <div className="mkmet">
                {[{l:'Uptime',v:'99.97%',c:'#34d399'},{l:'P95',v:'142ms',c:'#D9A441'},{l:'Alertas',v:'2',c:'#f87171'}].map(m => (
                  <div key={m.l} className="mkm"><div className="mkml">{m.l}</div><div className="mkmv" style={{ color:m.c }}>{m.v}</div></div>
                ))}
              </div>
              <div className="mkchart">
                <svg viewBox="0 0 480 52" preserveAspectRatio="none" style={{ width:'100%',height:'100%',position:'absolute',inset:0 }}>
                  <defs><linearGradient id="cg5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D9A441" stopOpacity=".22"/><stop offset="100%" stopColor="#D9A441" stopOpacity="0"/></linearGradient></defs>
                  <path d="M0,36 C40,30 90,16 140,26 S240,6 290,20 S390,2 480,16" stroke="#D9A441" strokeWidth="1.5" fill="none"/>
                  <path d="M0,36 C40,30 90,16 140,26 S240,6 290,20 S390,2 480,16 L480,52 L0,52 Z" fill="url(#cg5)"/>
                </svg>
              </div>
              {[{n:'API Pagos',s:'activo',c:'#34d399'},{n:'API Inventario',s:'warning',c:'#D9A441'},{n:'API Notificaciones',s:'crítico',c:'#f87171'}].map(r => (
                <div key={r.n} className="mkrow"><div className="mkrd" style={{ background:r.c }}/><div className="mkrn">{r.n}</div><div className="mkrb">{r.s}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PHRASE ── */}
      <section className="phr" ref={phraseRef}>
        <div className="phglow"/>
        {/* 4. Efecto de barrido luminoso (AURA BLANCA A ÁMBAR) */}
        <h2 className={`phtxt ${phV ? 'sweep' : ''}`}>
          Vigilancia que nunca descansa
        </h2>
        <p className="phsub">Métricas cada 30 segundos. Alertas sin ruido. Historial documentado.</p>
      </section>

      {/* ── STICKY CARDS ── */}
      <section className="sw" ref={stickyRef} id="features">
        <div className="si">
          <div className="sl">
            <span className="stag">// CARACTERÍSTICAS</span>
            <h2 className="slt">Construido para equipos que no pueden fallar</h2>
            <p className="sld">Cada función de noctua está diseñada para reducir el tiempo entre el problema y la solución.</p>
            <div className="dots">{CARDS.map((_,i) => <div key={i} className={`dot${card===i?' on':''}`}/>)}</div>
          </div>
          <div className="sr">
            {CARDS.map((c,i) => (
              <div key={c.n} className={`fc lg${card===i?' on':card>i?' done':''}`}>
                <div className="fcn"><b>{c.n}</b> / 04</div>
                <div className="fce">{c.e}</div>
                <h3 className="fct">{c.t}</h3>
                <p className="fcd">{c.d}</p>
                <div className="fctg">{c.tg}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW ── */}
      <section className="how" ref={howRef} id="empresa">
        <div className="how-in">
          <div className="howtxt">
            <span className="stag">// CÓMO FUNCIONA</span>
            <h2 className="stitle" style={{ marginBottom:'1rem' }}>De cero a monitoreado<br/>en minutos</h2>
            <p className="sdesc">Sin agentes complejos. Sin YAML interminable.</p>
            <Link to="/register" className="bgb" style={{ fontSize:'.88rem', padding:'.65rem 1.4rem', marginTop:'.5rem', display:'inline-flex', alignItems:'center', gap:'.45rem' }}>
              Empezar gratis<Arr s={13}/>
            </Link>
          </div>
          <div className="howsteps">
            {HOW.map((h,i) => (
              <div key={h.n} className="hs" style={{ transitionDelay:`${i*.07}s` }}>
                <div className="hsn">{h.n}</div>
                <div><div className="hst">{h.t}</div><div className="hsd">{h.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA WAVE ── */}
      <section className="cta">
        <div className="ctaw" ref={ctaWRef}>
          {[180,360,540,740].map((sz,i) => <div key={i} className={`cwave${waveV?' on':''}`} style={{ width:sz,height:sz }}/>)}
        </div>
        <div className="ctabody">
          <span className="stag" style={{ display:'block', marginBottom:'.75rem' }}>// EMPEZÁ HOY</span>
          <h2 className="ctatitle">Tu infraestructura nunca duerme<br/><span style={{ color:'#D9A441' }}>noctua tampoco</span></h2>
          <p className="ctasub">Monitoreo continuo, alertas inteligentes y trazabilidad completa.</p>
          <div className="ctabtns">
            {/* 2. "Inicia sesión" a la izq y color principal */}
            <Link to="/login" className="ba ba-lg">Inicia sesión</Link>
            <Link to="/register" className="bgb">Crear cuenta gratis<Arr /></Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER MARQUEE ── */}
      <div className="fmq">
        <div className="fmqt">
          {Array(20).fill(null).map((_,i) => (
            <div key={i} className="fmqi">n<span>o</span>ctua • VIGILANCIA 24/7 •&nbsp;</div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="flogo">n<span>o</span>ctua</div>
        <ul className="flinks">
          {[['prod','Producto'],['features','Características'],['empresa','Empresa']].map(([h,l]) => (
            <li key={l}><a onClick={(e) => handleSmoothScroll(e, h)}>{l}</a></li>
          ))}
          <li><Link to="/login"    style={{ fontSize:'.76rem', color:'rgba(255,255,255,.35)', fontWeight:500 }}>Iniciar sesión</Link></li>
          <li><Link to="/register" style={{ fontSize:'.76rem', color:'rgba(255,255,255,.35)', fontWeight:500 }}>Registro</Link></li>
        </ul>
        <div className="fcopy">© 2026 noctua — Bucaramanga, Colombia</div>
      </footer>
    </div>
  )
}