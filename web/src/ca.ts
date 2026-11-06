import { CaState } from '../../ca_engine/pkg/ca_engine';
export class CaMode {
  private state: CaState;
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.state = CaState.new(width, height);
  }
  setRules(birth: Uint8Array, survival: Uint8Array) {
    this.state.set_rules(birth, survival);
  }
  step() {
    this.state.step();
  }
  draw(ctx: CanvasRenderingContext2D, wasmMemory: any, cellSize: number) {
    const cellsPtr = this.state.cells_ptr();
    const cells = new Uint8Array(wasmMemory.buffer, cellsPtr, this.width * this.height);
    ctx.fillStyle = "#e0e0e0";
    ctx.beginPath();
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const idx = row * this.width + col;
        if (cells[idx] === 1) {
          ctx.rect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.fill();
  }
  toggle(x: number, y: number) {
    this.state.switch_state(x, y);
  }
  paint(x: number, y: number, radius: number, isRandom: boolean = false) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.sqrt(dx*dx + dy*dy) <= radius) {
          const nx = (x + dx + this.width) % this.width;
          const ny = (y + dy + this.height) % this.height;
          if (isRandom) {
             this.state.set_state(nx, ny, Math.random() > 0.5 ? 1 : 0);
          } else {
             this.state.set_state(nx, ny, 1);
          }
        }
      }
    }
  }
  reset() {
    this.state.reset();
  }
  free() {
    this.state.free();
  }
}
