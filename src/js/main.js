import '../styles/site.css';
import { i18n } from './i18n.js';
import { initSite } from './site.js';
import { initRig } from './rig.js';

window.MTC = { i18n };

i18n.init();
initSite({ i18n });
window.MTC.rig = initRig(document.getElementById('rig'), { i18n });

// Gancho solo en desarrollo: ?shot=<id-seccion>&rig=<estado> para capturas headless.
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
    setTimeout(() => target?.scrollIntoView({ behavior: 'instant', block: 'start' }), 50);
  }
}
