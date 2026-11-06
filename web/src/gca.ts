import { GcaState } from '../../ca_engine/pkg/ca_engine';
export class GcaMode {
  private state: GcaState;
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.state = GcaState.new();
  }
  step() {
  }
  draw(_ctx: CanvasRenderingContext2D, _wasmMemory: any, _cellSize: number) {
  }
  toggle(_x: number, _y: number) {
  }
  reset() {
  }
  free() {
    this.state.free();
  }
}
