export const CONFIG = {
  GRID_COLS: 28,
  GRID_ROWS: 16,
  MAX_ACTIVE_ENEMIES: 2000,
  MAX_PROJECTILES: 3000,
  MAX_PARTICLES: 8000,
  
  CORE_MAX: 100,
  START_CASH: 350,
  WAVE_INTERMISSION: 4.0, // seconds
  
  FPS: 60,
  MAX_DT: 1 / 20, // max 50ms per frame to prevent spiral of death
};

export const COLORS = {
  bg: '#050608',
  grid: '#11151a',
  path: '#0c0f13',
  pathEdge: '#1e2530',
  core: '#54e08a',
  kinetic: '#ffd659', //'#5fd0ff',
  energy: '#c08cff',
  splash: '#ff6230',
  burn: '#ff8a3d',
  corrode: '#a3ff54',
  enemyBase: '#ff6a4d',
};
