use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, KeyboardEvent};

// 游戏配置
const GRID_SIZE: u32 = 20;
const GRID_WIDTH: u32 = 25;
const GRID_HEIGHT: u32 = 25;
const CELL_SIZE: u32 = 20;
const GAME_SPEED: u32 = 100; // 毫秒

// 方向枚举
#[derive(Clone, Copy, PartialEq)]
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

// 蛇的一节身体
#[derive(Clone, Copy)]
struct Position {
    x: u32,
    y: u32,
}

// 游戏状态
struct GameState {
    snake: Vec<Position>,
    direction: Direction,
    next_direction: Direction,
    food: Position,
    score: u32,
    game_over: bool,
    paused: bool,
}

impl GameState {
    fn new() -> Self {
        let mut snake = Vec::new();
        // 初始蛇身长度3
        for i in 0..3 {
            snake.push(Position {
                x: GRID_WIDTH / 2 - i,
                y: GRID_HEIGHT / 2,
            });
        }
        
        let mut state = GameState {
            snake,
            direction: Direction::Right,
            next_direction: Direction::Right,
            food: Position { x: 0, y: 0 },
            score: 0,
            game_over: false,
            paused: false,
        };
        state.generate_food();
        state
    }
    
    fn generate_food(&mut self) {
        use js_sys::Math;
        loop {
            let x = (Math::random() * GRID_WIDTH as f64) as u32;
            let y = (Math::random() * GRID_HEIGHT as f64) as u32;
            // 确保食物不在蛇身上
            if !self.snake.iter().any(|p| p.x == x && p.y == y) {
                self.food = Position { x, y };
                break;
            }
        }
    }
    
    fn update(&mut self) {
        if self.game_over || self.paused {
            return;
        }
        
        self.direction = self.next_direction;
        
        // 计算新的头部位置
        let head = &self.snake[0];
        let new_head = match self.direction {
            Direction::Up => Position {
                x: head.x,
                y: if head.y == 0 { GRID_HEIGHT - 1 } else { head.y - 1 },
            },
            Direction::Down => Position {
                x: head.x,
                y: if head.y >= GRID_HEIGHT - 1 { 0 } else { head.y + 1 },
            },
            Direction::Left => Position {
                x: if head.x == 0 { GRID_WIDTH - 1 } else { head.x - 1 },
                y: head.y,
            },
            Direction::Right => Position {
                x: if head.x >= GRID_WIDTH - 1 { 0 } else { head.x + 1 },
                y: head.y,
            },
        };
        
        // 检测碰撞（撞到自己）
        if self.snake.iter().any(|p| p.x == new_head.x && p.y == new_head.y) {
            self.game_over = true;
            return;
        }
        
        // 移动蛇
        self.snake.insert(0, new_head);
        
        // 检测是否吃到食物
        if new_head.x == self.food.x && new_head.y == self.food.y {
            self.score += 10;
            self.generate_food();
        } else {
            self.snake.pop();
        }
    }
    
    fn change_direction(&mut self, new_direction: Direction) {
        // 防止直接反向移动
        let can_change = match (self.direction, new_direction) {
            (Direction::Up, Direction::Down) => false,
            (Direction::Down, Direction::Up) => false,
            (Direction::Left, Direction::Right) => false,
            (Direction::Right, Direction::Left) => false,
            _ => true,
        };
        if can_change {
            self.next_direction = new_direction;
        }
    }
    
    fn toggle_pause(&mut self) {
        self.paused = !self.paused;
    }
    
    fn restart(&mut self) {
        *self = GameState::new();
    }
}

// WASM 暴露的游戏引擎
#[wasm_bindgen]
pub struct SnakeGame {
    state: GameState,
    context: CanvasRenderingContext2d,
    canvas_width: u32,
    canvas_height: u32,
}

#[wasm_bindgen]
impl SnakeGame {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<SnakeGame, JsValue> {
        let context = canvas
            .get_context("2d")?
            .ok_or("无法获取 2D 上下文")?
            .dyn_into::<CanvasRenderingContext2d>()?;
        
        let canvas_width = GRID_WIDTH * CELL_SIZE;
        let canvas_height = GRID_HEIGHT * CELL_SIZE;
        canvas.set_width(canvas_width);
        canvas.set_height(canvas_height);
        
        Ok(SnakeGame {
            state: GameState::new(),
            context,
            canvas_width,
            canvas_height,
        })
    }
    
    pub fn update(&mut self) {
        self.state.update();
    }
    
    pub fn render(&self) {
        // 清空画布
        self.context.set_fill_style_str("#1a1a2e");
        self.context.fill_rect(0.0, 0.0, self.canvas_width as f64, self.canvas_height as f64);
        
        // 绘制网格（可选，细微的线条）
        self.context.set_stroke_style_str("#2a2a3e");
        self.context.set_line_width(0.5);
        for i in 0..=GRID_WIDTH {
            let x = (i * CELL_SIZE) as f64;
            self.context.begin_path();
            self.context.move_to(x, 0.0);
            self.context.line_to(x, self.canvas_height as f64);
            self.context.stroke();
        }
        for i in 0..=GRID_HEIGHT {
            let y = (i * CELL_SIZE) as f64;
            self.context.begin_path();
            self.context.move_to(0.0, y);
            self.context.line_to(self.canvas_width as f64, y);
            self.context.stroke();
        }
        
        // 绘制食物（带发光效果）
        let food_x = (self.state.food.x * CELL_SIZE) as f64;
        let food_y = (self.state.food.y * CELL_SIZE) as f64;
        let cell_size = CELL_SIZE as f64;
        
        // 食物发光
        self.context.set_shadow_color("#ff6b6b");
        self.context.set_shadow_blur(15.0);
        self.context.set_fill_style_str("#ff6b6b");
        self.context.fill_rect(
            food_x + 2.0,
            food_y + 2.0,
            cell_size - 4.0,
            cell_size - 4.0,
        );
        self.context.set_shadow_blur(0.0);
        
        // 绘制蛇
        for (i, segment) in self.state.snake.iter().enumerate() {
            let x = (segment.x * CELL_SIZE) as f64;
            let y = (segment.y * CELL_SIZE) as f64;
            
            if i == 0 {
                // 蛇头 - 更亮的颜色
                self.context.set_fill_style_str("#4ecdc4");
                self.context.set_shadow_color("#4ecdc4");
                self.context.set_shadow_blur(10.0);
            } else {
                // 蛇身 - 渐变色
                let ratio = i as f64 / self.state.snake.len() as f64;
                let r = (78.0 * (1.0 - ratio * 0.5)) as u8;
                let g = (205.0 * (1.0 - ratio * 0.5)) as u8;
                let b = (196.0 * (1.0 - ratio * 0.5)) as u8;
                self.context.set_fill_style_str(&format!("#{:02x}{:02x}{:02x}", r, g, b));
                self.context.set_shadow_blur(0.0);
            }
            
            let padding = if i == 0 { 1.0 } else { 2.0 };
            self.context.fill_rect(
                x + padding,
                y + padding,
                cell_size - padding * 2.0,
                cell_size - padding * 2.0,
            );
        }
        self.context.set_shadow_blur(0.0);
        
        // 游戏结束和暂停状态的绘制由 HTML 控制
        // Canvas 只负责游戏画面
    }
    
    pub fn handle_key(&mut self, key: &str) {
        match key {
            "ArrowUp" | "w" | "W" => self.state.change_direction(Direction::Up),
            "ArrowDown" | "s" | "S" => self.state.change_direction(Direction::Down),
            "ArrowLeft" | "a" | "A" => self.state.change_direction(Direction::Left),
            "ArrowRight" | "d" | "D" => self.state.change_direction(Direction::Right),
            " " => self.state.toggle_pause(),
            _ => {}
        }
    }
    
    pub fn get_score(&self) -> u32 {
        self.state.score
    }
    
    pub fn is_game_over(&self) -> bool {
        self.state.game_over
    }
    
    pub fn is_paused(&self) -> bool {
        self.state.paused
    }
    
    pub fn restart(&mut self) {
        self.state.restart();
    }
}
