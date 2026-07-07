export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export const gf = (id: string): number => parseFloat(($(id) as HTMLInputElement).value);
export const gc = (id: string): boolean => ($(id) as HTMLInputElement).checked;

// Sync the "-v" readout next to a slider, using the step to pick decimal places.
export function setVal(el: HTMLInputElement) {
  const v = parseFloat(el.value);
  const dec = (el.step || '').includes('.') ? el.step.split('.')[1].length : 0;
  const out = document.getElementById(el.id + '-v');
  if (out) out.textContent = v.toFixed(dec);
}
