import '../styles/site.css';
import { i18n } from './i18n.js';
import { initSite, showToast } from './site.js';

let readyResolve;
window.MTC = { i18n, play: {}, ready: new Promise((r) => { readyResolve = r; }) };

i18n.init();
initSite({ i18n });

// Zona de juego: se carga tras `load` y en tiempo ocioso para no competir con el LCP del busto.
const playTokens = (document.body.dataset.play || '').split(/\s+/).filter(Boolean);
// Momento (performance.now()) en que el visitante ve la pagina: 0 = la navegacion; si la pestana se abrio en segundo
// plano, cuando se hace visible (bootPlay espera a rAF, que no corre con la pestana oculta: sin esto el perro de los
// bordes saldria nada mas arrancar). El perro asomado sale por primera vez a los 10 s de este momento.
let enteredAt = document.hidden ? null : 0;
if (enteredAt == null) {
  const seen = () => {
    if (document.hidden) return;
    enteredAt = performance.now();
    document.removeEventListener('visibilitychange', seen);
  };
  document.addEventListener('visibilitychange', seen);
}
function bootPlay() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
  idle(() => {
    const measure = (name, fn) => {
      const t0 = performance.now();
      const out = fn();
      if (import.meta.env.DEV && performance.now() - t0 > 30) console.warn(`[play] ${name} tardó ${Math.round(performance.now() - t0)} ms`);
      return out;
    };
    const jobs = [];
    // los SVG decorativos (medias de tarjetas, farola, zona de juego) viven en src/partials/lazy.html y se estampan aqui
    const stamped = import('../partials/lazy.html?raw').then(({ default: html }) => {
      const box = document.createElement('template');
      box.innerHTML = html;
      for (const tpl of box.content.querySelectorAll('template[data-for]')) {
        const host = document.querySelector('[data-lazy="' + tpl.dataset.for + '"]');
        if (host) host.append(tpl.content.cloneNode(true));
      }
    });
    // el rig del cafe tampoco hace falta para el primer render: se carga aqui, antes que la zona de juego
    jobs.push(import('./rig.js').then((m) => { window.MTC.rig = measure('initRig', () => m.initRig(document.getElementById('rig'), { i18n })); }));
    if (playTokens.includes('marker') && document.getElementById('marker')) {
      jobs.push(Promise.all([stamped, import('./marker.js')]).then(([, m]) => { window.MTC.marker = measure('initMarker', () => m.initMarker(document.getElementById('play'), { i18n, showToast })); }));
    }
    if (playTokens.includes('dog') && document.getElementById('yard')) {
      jobs.push(Promise.all([stamped, import('./dog.js')]).then(([, m]) => { window.MTC.dog = measure('initDog', () => m.initDog(document.getElementById('yard'), { i18n, showToast, enteredAt })); }));
    }
    // lampara del hero: el escritorio se estampa desde lazy.html y la cadena enciende o apaga la escena
    if (document.getElementById('hero-desk')) jobs.push(Promise.all([stamped, import('./lamp.js')]).then(([, m]) => { window.MTC.lamp = measure('initLamp', () => m.initLamp(document.getElementById('hero-desk'), { i18n, showToast })); }));
    // [boot:lava]
    // [boot:glow] luz del raton: no depende de lazy.html; la capa se crea en el primer movimiento de raton
    if (playTokens.includes('glow')) jobs.push(import('./glow.js').then((m) => { window.MTC.glow = measure('initGlow', () => m.initGlow(document.body)); }));
    // [boot:exp] escenas de Experiencia: se estampan desde lazy.html y se encienden al pasar por cada entrada
    if (document.getElementById('exp-bg')) jobs.push(Promise.all([stamped, import('./experience.js')]).then(([, m]) => { window.MTC.experience = measure('initExperience', () => m.initExperience(document.getElementById('experiencia'))); }));
    // [boot:edu] escenas de Formacion: el mismo sistema que Experiencia (initScenes), una escena por bloque
    if (document.getElementById('edu-bg')) jobs.push(Promise.all([stamped, import('./experience.js')]).then(([, m]) => { window.MTC.education = measure('initEducation', () => m.initEducation(document.getElementById('formacion'))); }));
    // subpaginas de proyectos: el <dialog> ya esta en index.html; el modulo y cada ficha se cargan bajo demanda
    jobs.push(import('./projects.js').then((m) => { window.MTC.projects = measure('initProjects', () => m.initProjects({ i18n, showToast })); }));
    Promise.all(jobs).then(() => readyResolve(), () => readyResolve());
  });
}
// Tras `load` y tras el primer frame pintado (dos rAF + macrotarea), para que el estampado de los SVG y la
// carga de los modulos no entren en el coste de render del hero ni con una red instantanea.
const afterFirstPaint = (fn) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 0)));
if (document.readyState === 'complete') afterFirstPaint(bootPlay);
else window.addEventListener('load', () => afterFirstPaint(bootPlay), { once: true });

// Gancho solo en desarrollo: ?shot=<id-seccion>&rig=<estado>&dog=shown|alert|running|entering|playing|peek-left|peek-right|hidden&bone=near|dropped&marker=grabbed&ink=demo&glow=<x>,<y>&lamp=on&pose=typing|turn|reach|hold|face&exp=minsait|ntt|dynos&edu=uni|certs
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    document.documentElement.classList.add('shot');
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    const rigState = params.get('rig');
    if (rigState) document.getElementById('rig').dataset.state = rigState;
    if (params.get('nocss')) document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => { el.disabled = true; });
    if (params.get('style')) { const st = document.createElement('style'); st.textContent = params.get('style'); document.head.appendChild(st); }
    const target = document.getElementById(shot);
    const scroll = () => target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(scroll, 50);
    window.MTC.ready.then(() => {
      const dog = window.MTC.dog;
      const marker = window.MTC.marker;
      const dogState = params.get('dog');
      if (dog && dogState) dog.force(dogState);
      const boneState = params.get('bone');
      if (dog && boneState === 'near') dog.placeBoneNear();
      if (dog && boneState === 'dropped') { dog.placeBoneNear(); dog.feed(); }
      if (marker && params.get('ink') === 'demo') {
        const demo = [];
        for (let s = 0; s < Number(params.get('inkn') || 2); s++) {
          const pts = [];
          for (let i = 0; i <= 60; i++) pts.push(120 + s * 40 + i * 9, 140 + s * 30 + Math.sin(i / 4) * 28);
          demo.push({ sec: 'proyectos', w0: 1200, pts });
        }
        marker.loadInk(demo);
      }
      if (marker && params.get('marker') === 'grabbed') marker.demoHold(window.innerWidth * 0.6, window.innerHeight * 0.5);
      // ?lamp=on: la escena del escritorio arranca encendida
      if (params.get('lamp') === 'on') window.MTC.lamp?.toggle(true);
      // [hook:lava]
      // [hook:glow] ?glow=<x>,<y>: enciende la luz del raton en ese punto (px de cliente), sin cola
      const glowAt = (params.get('glow') || '').split(',').map(Number);
      if (glowAt.length === 2 && glowAt.every(Number.isFinite)) window.MTC.glow?.moveTo(glowAt[0], glowAt[1], { snap: true });
      // [hook:pose] &pose=typing|turn|reach|hold|face: el escritorio salta a esa pose sin transiciones (y con la luz que le toca)
      const deskPose = params.get('pose');
      if (deskPose) window.MTC.lamp?.snap(deskPose);
      // [hook:exp] ?exp=minsait|ntt|dynos: enciende esa escena de Experiencia
      const expId = params.get('exp');
      if (expId) window.MTC.experience?.show(expId);
      // [hook:edu] ?edu=uni|certs: enciende esa escena de Formacion
      const eduId = params.get('edu');
      if (eduId) window.MTC.education?.show(eduId);
      // ?project=<id>: abre esa ficha de proyecto (sin tocar el historial)
      const projectId = params.get('project');
      if (projectId && window.MTC.projects) window.MTC.projects.open(projectId, { push: false });
      setTimeout(scroll, 30);
    });
  }
}
