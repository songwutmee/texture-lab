let timer: number | undefined;

export function toast(msg: string) {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => t.classList.remove('show'), 1800);
}
