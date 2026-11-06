use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct NcaState {
    width: u32,
    height: u32,
    cells: Vec<f32>,
    next_cells: Vec<f32>,
    kernel: Vec<f32>,
    radius: i32,
    mu: f32,
    sigma: f32,
    activation_func: String,
    #[wasm_bindgen(skip)]
    pub expr: Option<meval::Expr>,
}

#[wasm_bindgen]
impl NcaState {
    pub fn new(width: u32, height: u32) -> NcaState {
        let total_cells = (width * height) as usize;
        let cells = vec![0.0; total_cells];
        let next_cells = vec![0.0; total_cells];
        let radius = 1;
        let mut kernel = vec![0.5, 1.0, 0.5, 1.0, 0.0, 1.0, 0.5, 1.0, 0.5];
        let sum: f32 = kernel.iter().sum();
        if sum != 0.0 {
            kernel.iter_mut().for_each(|w| *w /= sum);
        }
        let activation_func = "exp(-((x-mu)^2) / (2*(sigma^2)))".to_string();

        let parsed_func = activation_func.replace("**", "^");
        let expr = parsed_func.parse::<meval::Expr>().ok();

        NcaState {
            width,
            height,
            cells,
            next_cells,
            kernel,
            radius,
            mu: 0.15,
            sigma: 0.015,
            activation_func,
            expr,
        }
    }

    pub fn cells_ptr(&self) -> *const f32 {
        self.cells.as_ptr()
    }

    pub fn step(&mut self) {
        let width = self.width as i32;
        let height = self.height as i32;
        let dt = 0.1;
        let r = self.radius;

        let mut func_expr = self
            .expr
            .as_ref()
            .cloned()
            .unwrap_or_else(|| "0.0".parse().unwrap());
        if func_expr.clone().bind3("x", "mu", "sigma").is_err() {
            func_expr = "0.0".parse().unwrap();
        }
        let func = func_expr.bind3("x", "mu", "sigma").unwrap();

        for y in 0..height {
            for x in 0..width {
                let mut sum = 0.0;
                let mut kernel_idx = 0;

                for dy in -r..=r {
                    for dx in -r..=r {
                        let mut nx = x + dx;
                        if nx < 0 {
                            nx += width;
                        } else if nx >= width {
                            nx -= width;
                        }

                        let mut ny = y + dy;
                        if ny < 0 {
                            ny += height;
                        } else if ny >= height {
                            ny -= height;
                        }

                        let cell_idx = (ny * width + nx) as usize;
                        let neighbor_val = self.cells[cell_idx];

                        if kernel_idx < self.kernel.len() {
                            let weight = self.kernel[kernel_idx];
                            sum += neighbor_val * weight;
                        }
                        kernel_idx += 1;
                    }
                }

                let gaussian = func(sum as f64, self.mu as f64, self.sigma as f64) as f32;
                let growth = gaussian * 2.0 - 1.0;

                let current_idx = (y * width + x) as usize;
                let mut new_val = self.cells[current_idx] + (growth * dt);

                if new_val > 1.0 {
                    new_val = 1.0;
                }
                if new_val < 0.0 {
                    new_val = 0.0;
                }

                self.next_cells[current_idx] = new_val;
            }
        }

        std::mem::swap(&mut self.cells, &mut self.next_cells);
    }

    pub fn reset(&mut self) {
        for cell in self.cells.iter_mut() {
            *cell = 0.0;
        }
        for cell in self.next_cells.iter_mut() {
            *cell = 0.0;
        }
    }

    pub fn set_params(&mut self, mu: f32, sigma: f32) {
        self.mu = mu;
        self.sigma = sigma;
    }

    pub fn set_kernel(&mut self, radius: i32, kernel_data: &[f32]) {
        self.radius = radius;
        let sum: f32 = kernel_data.iter().sum();
        let sum_k = if sum == 0.0 { 1.0 } else { sum };
        let normalized_kernel: Vec<f32> = kernel_data.iter().map(|&w| w / sum_k).collect();
        self.kernel = normalized_kernel;
    }

    pub fn set_activation_function(&mut self, func: String) {
        self.activation_func = func.clone();
        let parsed_func = func.replace("**", "^");
        self.expr = parsed_func.parse::<meval::Expr>().ok();
    }

    pub fn set_state(&mut self, x: u32, y: u32, value: f32) {
        if x < self.width && y < self.height {
            let idx = self.get_index(x, y);
            self.cells[idx] = value;
        }
    }
}

impl NcaState {
    fn get_index(&self, x: u32, y: u32) -> usize {
        (y * self.width + x) as usize
    }
}
