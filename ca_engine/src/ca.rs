use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct CaState {
    width: u32,
    height: u32,
    cells: Vec<u8>,
    birth_rules: Vec<u8>,
    survival_rules: Vec<u8>,
}
#[wasm_bindgen]
impl CaState {
    pub fn new(width: u32, height: u32) -> CaState {
        let total_cells = (width * height) as usize;
        let cells = vec![0; total_cells];
        CaState { width, height, cells, birth_rules: vec![3], survival_rules: vec![2, 3] }
    }
    pub fn cells_ptr(&self) -> *const u8 {
        self.cells.as_ptr()
    }
    pub fn set_rules(&mut self, birth: &[u8], survival: &[u8]) {
        self.birth_rules = birth.to_vec();
        self.survival_rules = survival.to_vec();
    }
    pub fn reset(&mut self) {
        for cell in self.cells.iter_mut() { *cell = 0; }
    }
    pub fn switch_state(&mut self, x: u32, y: u32) {
        if x < self.width && y < self.height {
            let idx = self.get_index(x, y);
            self.cells[idx] ^= 1;
        }
    }
    pub fn set_state(&mut self, x: u32, y: u32, val: u8) {
        if x < self.width && y < self.height {
            let idx = self.get_index(x, y);
            self.cells[idx] = val;
        }
    }
    pub fn step(&mut self) {
        let width = self.width;
        let next_gen: Vec<u8> = self.cells.iter().enumerate().map(|(i, &cell)| {
            let x = (i as u32) % width;
            let y = (i as u32) / width;
            let live_neighbors = self.count_neighbors(x, y);
            if cell == 1 {
                if self.survival_rules.contains(&live_neighbors) { 1 } else { 0 }
            } else {
                if self.birth_rules.contains(&live_neighbors) { 1 } else { 0 }
            }
        }).collect();
        self.cells = next_gen;
    }
}
impl CaState {
    fn get_index(&self, x: u32, y: u32) -> usize { (y * self.width + x) as usize }
    fn count_neighbors(&self, x: u32, y: u32) -> u8 {
        let mut count = 0;
        for delta_row in [self.height - 1, 0, 1].iter().cloned() {
            for delta_col in [self.width - 1, 0, 1].iter().cloned() {
                if delta_row == 0 && delta_col == 0 { continue; }
                let neighbor_x = (x + delta_col) % self.width;
                let neighbor_y = (y + delta_row) % self.height;
                let idx = self.get_index(neighbor_x, neighbor_y);
                count += self.cells[idx];
            }
        }
        count
    }
}
