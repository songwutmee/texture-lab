import '../styles/base.css';
import '../styles/layout.css';
import '../styles/controls.css';
import { initTextureGen, getGenState, applyGenState } from './tabs/TextureGen';
import { initNormalMap } from './tabs/NormalMap';

const gen = initTextureGen();
initNormalMap(switchTab);
restoreFromHash();

function switchTab(id: string) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id)!.classList.add('active');
  document.querySelector(`.tab[data-page="${id}"]`)!.classList.add('active');
  scheduleHashUpdate();
}

document.querySelector('header')!.addEventListener('click', e => {
  const tab = (e.target as HTMLElement).closest('.tab') as HTMLElement | null;
  if (tab) switchTab(tab.dataset.page!);
});

// ---- shareable links: settings live in the URL hash ----
let hashTimer: number | undefined;

function scheduleHashUpdate() {
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    const tab = (document.querySelector('.tab.active') as HTMLElement).dataset.page;
    const state = { tab, gen: getGenState() };
    window.history.replaceState(null, '', '#' + btoa(JSON.stringify(state)));
  }, 500);
}

function restoreFromHash() {
  if (location.hash.length < 2) return;
  try {
    const state = JSON.parse(atob(location.hash.slice(1)));
    if (state.gen) applyGenState(state.gen);
    if (state.tab && state.tab !== 'gen') switchTab(state.tab);
  } catch {
    // stale or hand-edited hash, start fresh
  }
}

['input', 'change'].forEach(ev =>
  document.addEventListener(ev, e => {
    if ((e.target as HTMLElement).closest('#page-gen')) scheduleHashUpdate();
  }),
);

// ---- keyboard shortcut: Ctrl+Z undo (generator tab) ----
// e.code is the physical key position, so this works no matter what
// keyboard layout or input language is active (Thai, etc).
document.addEventListener('keydown', e => {
  const el = e.target as HTMLElement;
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') return;

  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    e.preventDefault();
    gen.undo();
  }
});
