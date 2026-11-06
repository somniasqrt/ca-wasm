import { NcaState } from '../../ca_engine/pkg/ca_engine';
export class NcaMode {
  private state: NcaState;
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.state = NcaState.new(width, height);
  }
  setParams(mu: number, sigma: number, funcStr: string, radius: number, kernel: Float32Array) {
    this.state.set_params(mu, sigma);
    this.state.set_activation_function(funcStr);
    this.state.set_kernel(radius, kernel);
  }
  step() {
    this.state.step();
  }
  draw(ctx: CanvasRenderingContext2D, wasmMemory: any, cellSize: number) {
    const cellsPtr = this.state.cells_ptr();
    const cells = new Float32Array(wasmMemory.buffer, cellsPtr, this.width * this.height);
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const val = cells[row * this.width + col];
        if (val > 0.05) {
          const intensity = Math.max(0, Math.min(255, Math.floor(val * 255)));
          ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
  }
  toggle(x: number, y: number) {
    this.state.set_state(x, y, 1.0);
  }
  paint(x: number, y: number, radius: number, isRandom: boolean = false) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.sqrt(dx*dx + dy*dy) <= radius) {
          const nx = (x + dx + this.width) % this.width;
          const ny = (y + dy + this.height) % this.height;
          const val = isRandom ? Math.random() : 1.0;
          this.state.set_state(nx, ny, val);
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
