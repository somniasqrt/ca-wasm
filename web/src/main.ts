import './style.css'
import init from '../../ca_engine/pkg/ca_engine'
import wasmUrl from '../../ca_engine/pkg/ca_engine_bg.wasm?url'
import { CaMode } from './ca';
import { NcaMode } from './cca';
import { GcaMode } from './gca';
export interface SimulationMode {
  step(): void;
  draw(ctx: CanvasRenderingContext2D, wasmMemory: any, cellSize: number): void;
  toggle(x: number, y: number): void;
  reset(): void;
  free(): void;
}
let isPlaying = false;
let animationFrameId: number | null = null;
let generationsPerSecond = 10;
let lastFrameTime = 0;
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let isDrawing = false;
let panStart = { x: 0, y: 0 };
let lastDrawnCell = { x: -1, y: -1 };
let currentModeName = "CA";
let gridW = 100;
let gridH = 100;
const cellSize = 10;
let wasm: any;
let currentSim: SimulationMode;
async function setupApp() {
  try {
    wasm = await init(wasmUrl);
    currentSim = new CaMode(gridW, gridH);
    console.log("wasm engine loaded");
  } catch (err) {
    console.error("failed to load wasm -> ", err);
    return;
  }
  const canvas = document.getElementById('simulation-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  function fitToScreen() {
    const worldW = gridW * cellSize;
    const worldH = gridH * cellSize;
    camera.zoom = Math.min(canvas.width / worldW, canvas.height / worldH) * 0.95;
    camera.x = (canvas.width - worldW * camera.zoom) / 2;
    camera.y = (canvas.height - worldH * camera.zoom) / 2;
  }
  function resizeCanvas() {
    const container = canvas.parentElement!;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    fitToScreen();
    if (!isPlaying) drawScene();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  function drawScene() {
    if (!currentSim) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    const worldW = gridW * cellSize;
    const worldH = gridH * cellSize;
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, worldW, worldH);
    currentSim.draw(ctx, wasm.memory, cellSize);
    if (currentModeName === "CA" || currentModeName === "NCA") {
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath();
      for (let x = 0; x <= worldW; x += cellSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, worldH);
      }
      for (let y = 0; y <= worldH; y += cellSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(worldW, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function stepEngine() {
    currentSim.step();
    drawScene();
  }
  function gameLoop(timestamp: number) {
    if (!isPlaying) return;
    const msPerGen = 1000 / generationsPerSecond;
    const elapsed = timestamp - lastFrameTime;
    if (elapsed > msPerGen) {
      stepEngine();
      lastFrameTime = timestamp - (elapsed % msPerGen);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldZoom = camera.zoom;
    camera.zoom *= (direction > 0 ? zoomFactor : 1 / zoomFactor);
    camera.zoom = Math.max(0.1, Math.min(camera.zoom, 100));
    camera.x = mouseX - (mouseX - camera.x) * (camera.zoom / oldZoom);
    camera.y = mouseY - (mouseY - camera.y) * (camera.zoom / oldZoom);
    if (!isPlaying) drawScene();
  });
  const brushSlider = document.getElementById('brush-slider') as HTMLInputElement;
  const brushDisplay = document.getElementById('brush-display')!;
  brushSlider.addEventListener('input', () => {
    brushDisplay.innerText = brushSlider.value;
  });
  function handleDraw(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const worldX = (clientX - rect.left - camera.x) / camera.zoom;
    const worldY = (clientY - rect.top - camera.y) / camera.zoom;
    const gridX = Math.floor(worldX / cellSize);
    const gridY = Math.floor(worldY / cellSize);
    if (gridX >= 0 && gridX < gridW && gridY >= 0 && gridY < gridH) {
      const radius = parseInt(brushSlider.value) || 0;
      if (radius === 0) {
        if (gridX !== lastDrawnCell.x || gridY !== lastDrawnCell.y) {
          currentSim.toggle(gridX, gridY);
        }
      } else {
        if ('paint' in currentSim) (currentSim as any).paint(gridX, gridY, radius, currentModeName === 'NCA');
      }
      lastDrawnCell = { x: gridX, y: gridY };
      if (!isPlaying) drawScene();
    }
  }
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.shiftKey) {
      isPanning = true;
      panStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
    }
    else if (e.button === 0) {
      isDrawing = true;
      lastDrawnCell = { x: -1, y: -1 };
      handleDraw(e.clientX, e.clientY);
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      camera.x = e.clientX - panStart.x;
      camera.y = e.clientY - panStart.y;
      if (!isPlaying) drawScene();
    } else if (isDrawing) {
      handleDraw(e.clientX, e.clientY);
    }
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    isDrawing = false;
  });
  const playBtn = document.getElementById('btn-play') as HTMLButtonElement;
  const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
  const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
  const paceSlider = document.getElementById('pace-slider') as HTMLInputElement;
  const paceDisplay = document.getElementById('pace-display')!;
  function updatePlaybackUI() {
    if (isPlaying) {
      playBtn.classList.add('active');
      pauseBtn.classList.remove('active');
      nextBtn.disabled = true;
    } else {
      pauseBtn.classList.add('active');
      playBtn.classList.remove('active');
      nextBtn.disabled = false;
    }
  }
  updatePlaybackUI();
  playBtn.addEventListener('click', () => {
    if (!isPlaying) {
      isPlaying = true;
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(gameLoop);
      updatePlaybackUI();
    }
  });
  pauseBtn.addEventListener('click', () => {
    if (isPlaying) {
      isPlaying = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      updatePlaybackUI();
    }
  });
  nextBtn.addEventListener('click', () => {
    if (!isPlaying) {
      stepEngine();
    }
  });
  paceSlider.addEventListener('input', (e) => {
    generationsPerSecond = parseInt((e.target as HTMLInputElement).value);
    paceDisplay.textContent = generationsPerSecond.toString();
  });
  document.getElementById('btn-reset')!.addEventListener('click', () => {
    isPlaying = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    updatePlaybackUI();
    currentSim.reset();
    drawScene();
  });
  function switchMode(newMode: string) {
    if (currentSim) currentSim.free();
    currentModeName = newMode;
    if (newMode === "CA") {
      currentSim = new CaMode(gridW, gridH);
    } else if (newMode === "NCA") {
      currentSim = new NcaMode(gridW, gridH);
    } else if (newMode === "GCA") {
      currentSim = new GcaMode(gridW, gridH);
    }
    isPlaying = false;
    updatePlaybackUI();
    fitToScreen();
    drawScene();
  }
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target')!;
      document.getElementById(targetId)!.classList.add('active');
      let newMode = "CA";
      if (targetId === 'tab-ca') newMode = "CA";
      if (targetId === 'tab-nca') newMode = "NCA";
      if (targetId === 'tab-gca') newMode = "GCA";
      if (newMode !== currentModeName) {
        switchMode(newMode);
      }
    });
  });
  const gridSizeInput = document.getElementById('grid-size') as HTMLInputElement;
  const gridSizeRegex = /^[0-9]+\s*x\s*[0-9]+$/i;
  let lastGridVal = gridSizeInput.value;
  gridSizeInput.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const xIndex = gridSizeInput.value.toLowerCase().indexOf('x');
      if (xIndex !== -1) gridSizeInput.setSelectionRange(xIndex + 1, xIndex + 1);
    }
  });
  gridSizeInput.addEventListener('input', () => {
    const val = gridSizeInput.value.toLowerCase();
    if (!val.includes('x')) {
      const currentCursor = gridSizeInput.selectionStart;
      gridSizeInput.value = lastGridVal;
      if (currentCursor !== null) gridSizeInput.setSelectionRange(currentCursor, currentCursor);
    } else {
      lastGridVal = gridSizeInput.value;
    }
    if (gridSizeRegex.test(gridSizeInput.value)) {
      gridSizeInput.classList.remove('invalid');
    } else {
      gridSizeInput.classList.add('invalid');
    }
  });
  const birthInput = document.getElementById('birth-rule') as HTMLInputElement;
  const survivalInput = document.getElementById('survival-rule') as HTMLInputElement;
  document.getElementById('btn-apply-rules')!.addEventListener('click', () => {
    if (!gridSizeRegex.test(gridSizeInput.value)) return;
    const [w, h] = gridSizeInput.value.toLowerCase().split('x').map(s => parseInt(s.trim()));
    if (w !== gridW || h !== gridH) {
      gridW = w; gridH = h;
      switchMode(currentModeName);
    }
    if (currentModeName === "CA") {
      const birthRules = new Uint8Array(birthInput.value.split('').map(Number));
      const survivalRules = new Uint8Array(survivalInput.value.split('').map(Number));
      (currentSim as CaMode).setRules(birthRules, survivalRules);
    }
    drawScene();
  });
  function drawDesmos() {
    const canvas = document.getElementById('desmos-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const funcStr = (document.getElementById('nca-func') as HTMLInputElement).value;
    const mu = parseFloat((document.getElementById('nca-mu') as HTMLInputElement).value);
    const sigma = parseFloat((document.getElementById('nca-sigma') as HTMLInputElement).value);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i = 0; i <= 10; i++) {
      const x = (i / 10) * canvas.width;
      ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();
    let parsed = funcStr
      .replace(/Math\./g, '')
      .replace(/\b(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|sign|exp|pow|sqrt|abs|floor|ceil|log|max|min)\b/g, 'Math.$1')
      .replace(/\b(pi|e)\b/gi, (match) => match.toLowerCase() === 'pi' ? 'Math.PI' : 'Math.E');
    ctx.strokeStyle = "#66fcf1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    try {
      const f = new Function('x', 'mu', 'sigma', `return ${parsed};`);
      for (let px = 0; px < canvas.width; px++) {
        const xRange = 1.5;
        const x = (px / canvas.width) * xRange;
        const y = f(x, mu, sigma);
        const py = canvas.height - (y * canvas.height);
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } catch(e) {
    }
  }
  drawDesmos();
  const ncaRadiusInput = document.getElementById('nca-radius') as HTMLInputElement;
  const dynamicKernelGrid = document.getElementById('dynamic-kernel-grid')!;
  let currentKernelRadius = 1;
  function renderKernelGrid() {
    if (!dynamicKernelGrid) return;
    let r = parseInt(ncaRadiusInput.value);
    if (isNaN(r) || r < 1) r = 1;
    if (r > 10) r = 10;
    currentKernelRadius = r;
    const size = 2 * r + 1;
    dynamicKernelGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    dynamicKernelGrid.innerHTML = '';
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'k-input';
        input.dataset.x = x.toString();
        input.dataset.y = y.toString();
        if (r === 1) {
          if (x === 0 && y === 0) input.value = "0.0";
          else input.value = "1.0";
        } else {
          input.value = "0.0";
        }
        dynamicKernelGrid.appendChild(input);
      }
    }
  }
  renderKernelGrid();
  ncaRadiusInput.addEventListener('change', renderKernelGrid);
  document.getElementById('btn-sym-x')?.addEventListener('click', () => {
    const inputs = dynamicKernelGrid.querySelectorAll('input');
    inputs.forEach(input => {
      const x = parseInt(input.dataset.x!);
      const y = parseInt(input.dataset.y!);
      if (y > 0) {
        const source = dynamicKernelGrid.querySelector(`input[data-x="${x}"][data-y="${-y}"]`) as HTMLInputElement;
        if (source) input.value = source.value;
      }
    });
  });
  document.getElementById('btn-sym-y')?.addEventListener('click', () => {
    const inputs = dynamicKernelGrid.querySelectorAll('input');
    inputs.forEach(input => {
      const x = parseInt(input.dataset.x!);
      const y = parseInt(input.dataset.y!);
      if (x > 0) {
        const source = dynamicKernelGrid.querySelector(`input[data-x="${-x}"][data-y="${y}"]`) as HTMLInputElement;
        if (source) input.value = source.value;
      }
    });
  });
  document.getElementById('btn-sym-center')?.addEventListener('click', () => {
    const inputs = dynamicKernelGrid.querySelectorAll('input');
    inputs.forEach(input => {
      const x = parseInt(input.dataset.x!);
      const y = parseInt(input.dataset.y!);
      if (y > 0 || (y === 0 && x > 0)) {
        const source = dynamicKernelGrid.querySelector(`input[data-x="${-x}"][data-y="${-y}"]`) as HTMLInputElement;
        if (source) input.value = source.value;
      }
    });
  });
  const ncaMuInput = document.getElementById('nca-mu') as HTMLInputElement;
  const ncaSigmaInput = document.getElementById('nca-sigma') as HTMLInputElement;
  const ncaFuncInput = document.getElementById('nca-func') as HTMLInputElement;
  function applyNcaParams() {
    if (currentModeName !== 'NCA') return;
    const mu = parseFloat(ncaMuInput.value);
    const sigma = parseFloat(ncaSigmaInput.value);
    const funcStr = ncaFuncInput.value;
    const inputs = dynamicKernelGrid.querySelectorAll('input');
    const kernel = new Float32Array(inputs.length);
    inputs.forEach((input, i) => {
      kernel[i] = parseFloat(input.value) || 0.0;
    });
    if (!isNaN(mu) && !isNaN(sigma)) {
      (currentSim as NcaMode).setParams(mu, sigma, funcStr, currentKernelRadius, kernel);
    }
  }
  ncaMuInput.addEventListener('input', () => { drawDesmos(); applyNcaParams(); });
  ncaSigmaInput.addEventListener('input', () => { drawDesmos(); applyNcaParams(); });
  ncaFuncInput.addEventListener('input', () => { drawDesmos(); applyNcaParams(); });
  ncaRadiusInput.addEventListener('change', () => { renderKernelGrid(); applyNcaParams(); });
  dynamicKernelGrid.addEventListener('input', applyNcaParams);

  document.getElementById('btn-nca-random')?.addEventListener('click', () => {
    // 1. Random Math Function
    const funcs = [
      "exp(-((x-mu)^2) / (2*(sigma^2)))",
      "sin(x * pi * mu)",
      "cos(x * pi / sigma)",
      "max(0, 1.0 - abs(x - mu) / sigma)",
      "1.0 / (1.0 + exp(-4.0 * (x - mu) / sigma))"
    ];
    ncaFuncInput.value = funcs[Math.floor(Math.random() * funcs.length)];

    // 2. Random Mu and Sigma
    ncaMuInput.value = (Math.random() * 4.0 - 2.0).toFixed(2);
    ncaSigmaInput.value = (Math.random() * 2.0 + 0.1).toFixed(2);

    // 3. Keep current Radius (Do NOT randomize radius!)
    const r = parseInt(ncaRadiusInput.value);
    
    // 4. Random Kernel Weights (Symmetrical)
    
    // Generate random weights for the top-left quadrant
    for (let y = 0; y <= r; y++) {
      for (let x = 0; x <= r; x++) {
        // weights from -1.5 to 1.5
        const w = (Math.random() * 3.0 - 1.5).toFixed(2);
        
        // Apply 4-way symmetry
        const applySymmetry = (dx: number, dy: number) => {
          const el = dynamicKernelGrid.querySelector(`input[data-x="${dx}"][data-y="${dy}"]`) as HTMLInputElement;
          if (el) el.value = w;
        };

        applySymmetry(x, y);
        applySymmetry(-x, y);
        applySymmetry(x, -y);
        applySymmetry(-x, -y);
      }
    }

    drawDesmos();
    applyNcaParams();
  });
  function seedCanvas(radius: number) {
    const cx = Math.floor(gridW / 2);
    const cy = Math.floor(gridH / 2);
    currentSim.reset();
    if ('paint' in currentSim) {
      (currentSim as any).paint(cx, cy, radius, currentModeName === 'NCA');
    }
    drawScene();
  }

  function setupCustomSelect(selectId: string, labelId: string, onSelect: (value: string) => void) {
    const container = document.getElementById(selectId);
    if (!container) return;
    const trigger = container.querySelector('.custom-select-trigger') as HTMLElement;
    const options = container.querySelector('.custom-select-options') as HTMLElement;
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-options').forEach(opt => {
        if (opt !== options) opt.classList.remove('open');
      });
      options.classList.toggle('open');
    });

    container.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = (opt as HTMLElement).dataset.value;
        const text = (opt as HTMLElement).innerText;
        if (value) {
          onSelect(value);
          const label = document.getElementById(labelId);
          if (label) label.innerText = text;
        }
        options.classList.remove('open');
      });
    });
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-options').forEach(opt => opt.classList.remove('open'));
  });

  setupCustomSelect('ca-preset-select', 'ca-preset-label', (preset) => {
    const birthInput = document.getElementById('birth-rule') as HTMLInputElement;
    const survivalInput = document.getElementById('survival-rule') as HTMLInputElement;
    if (preset === 'gol') {
      birthInput.value = "3";
      survivalInput.value = "23";
    } else if (preset === 'coral') {
      birthInput.value = "3";
      survivalInput.value = "45678";
    } else if (preset === 'maze') {
      birthInput.value = "3";
      survivalInput.value = "12345";
    }
    
    if (currentModeName !== 'CA') {
      switchMode('CA');
    }
    
    document.getElementById('btn-apply-rules')?.click();
    currentSim.reset();
    seedCanvas(30);
  });

  setupCustomSelect('nca-preset-select', 'nca-preset-label', (preset) => {
    
    const setKernel = (r: number, rawWeights: number[]) => {
      ncaRadiusInput.value = r.toString();
      renderKernelGrid();
      
      let i = 0;
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const w = rawWeights[i++];
            const el = dynamicKernelGrid.querySelector(`input[data-x="${x}"][data-y="${y}"]`) as HTMLInputElement;
            if (el) el.value = w.toString();
        }
      }
    };

    const buildLeniaKernel = (r: number) => {
      const weights = [];
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const d_norm = Math.sqrt(x*x + y*y) / r;
          let w = 0;
          if (d_norm <= 1.0) {
              w = Math.exp(-Math.pow(d_norm - 0.5, 2) / (2 * Math.pow(0.15, 2)));
          }
          weights.push(parseFloat(w.toFixed(4)));
        }
      }
      setKernel(r, weights);
    };

    if (preset === 'lenia_r2' || preset === 'lenia_r4' || preset === 'lenia_r8' || preset === 'lenia_r12') {
      const r = preset === 'lenia_r2' ? 2 : preset === 'lenia_r4' ? 4 : preset === 'lenia_r8' ? 8 : 12;
      buildLeniaKernel(r);
      ncaFuncInput.value = "exp(-((x-mu)^2) / (2*(sigma^2)))";
      ncaMuInput.value = "0.15";
      ncaSigmaInput.value = "0.015";
      seedCanvas(15);
    } else if (preset === 'bimodal_gaussian') {
      const ring5x5 = [
        0.0, 0.5, 1.0, 0.5, 0.0,
        0.5, 1.0, 0.0, 1.0, 0.5,
        1.0, 0.0, 0.0, 0.0, 1.0,
        0.5, 1.0, 0.0, 1.0, 0.5,
        0.0, 0.5, 1.0, 0.5, 0.0
      ];
      setKernel(2, ring5x5);
      ncaFuncInput.value = "exp(-((x-mu)^2) / (2*(sigma^2))) + 0.5*exp(-((x-0.3)^2) / (2*(0.02^2)))";
      ncaMuInput.value = "0.15";
      ncaSigmaInput.value = "0.015";
      seedCanvas(15);
    } else if (preset === 'smooth_step') {
      const moore3x3 = [
        1.0, 1.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 1.0, 1.0
      ];
      setKernel(1, moore3x3);
      ncaFuncInput.value = "1.0 / (1.0 + exp(-10.0 * (x - mu)))";
      ncaMuInput.value = "0.27";
      ncaSigmaInput.value = "0.1";
      seedCanvas(15);
    } else if (preset === 'polynomial_bell') {
      const blur3x3 = [
        0.0625, 0.125, 0.0625,
        0.125,  0.25,  0.125,
        0.0625, 0.125, 0.0625
      ];
      setKernel(1, blur3x3);
      ncaFuncInput.value = "max(0.0, 1.0 - ((x-mu)^2) / (sigma^2))";
      ncaMuInput.value = "0.2";
      ncaSigmaInput.value = "0.05";
      seedCanvas(15);
    } else if (preset === 'von_neumann') {
      const cross3x3 = [
        0.0, 1.0, 0.0,
        1.0, 0.0, 1.0,
        0.0, 1.0, 0.0
      ];
      setKernel(1, cross3x3);
      ncaFuncInput.value = "exp(-((x-mu)^2) / (2*(sigma^2)))";
      ncaMuInput.value = "0.2";
      ncaSigmaInput.value = "0.05";
      seedCanvas(15);
    }
    
    drawDesmos();
    applyNcaParams();
  });

  document.getElementById('btn-apply-nca')!.addEventListener('click', () => {
    if (!gridSizeRegex.test(gridSizeInput.value)) return;
    const [w, h] = gridSizeInput.value.toLowerCase().split('x').map(s => parseInt(s.trim()));
    if (w !== gridW || h !== gridH) {
      gridW = w; gridH = h;
      switchMode('NCA');
    }
    applyNcaParams();
    drawDesmos();
    drawScene();
  });
}
setupApp();
