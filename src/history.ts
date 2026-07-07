// Undo/redo stack over serialized settings snapshots.
export class History<S> {
  private stack: string[] = [];
  private pos = -1;
  private lock = false;

  constructor(
    private read: () => S,
    private write: (s: S) => void,
    private refresh: () => void,
  ) {}

  push() {
    if (this.lock) return;
    const snap = JSON.stringify(this.read());
    if (this.pos >= 0 && this.stack[this.pos] === snap) return;
    this.stack = this.stack.slice(0, this.pos + 1);
    this.stack.push(snap);
    if (this.stack.length > 60) this.stack.shift();
    this.pos = this.stack.length - 1;
    this.refresh();
  }

  undo() { if (this.pos > 0) { this.pos--; this.apply(); } }
  redo() { if (this.pos < this.stack.length - 1) { this.pos++; this.apply(); } }

  get canUndo() { return this.pos > 0; }
  get canRedo() { return this.pos < this.stack.length - 1; }

  private apply() {
    this.lock = true;
    this.write(JSON.parse(this.stack[this.pos]) as S);
    this.lock = false;
    this.refresh();
  }
}
