import { CONFIG } from './constants';
import { GameState, Enemy, Tower, Projectile, Particle, DamageType, EnemyType, PathNode, Vector2 } from './types';

// Pre-allocate pools
const createEnemies = () => Array.from({ length: CONFIG.MAX_ACTIVE_ENEMIES }, (_, i): Enemy => ({
  id: i, type: EnemyType.GRUNT, pos: { x: 0, y: 0 }, hp: 0, maxHp: 0, speed: 0, baseSpeed: 0,
  armor: 0, shield: 0, radius: 10, route: 0, wpIdx: 0, routeSegP: 0,
  status: { burnT: 0, slowT: 0, shockT: 0, corrodeT: 0, ionizeT: 0 },
  bounty: 0, coreDmg: 0, color: '#fff', active: false, flashT: 0, spawnT: 0
}));

const createProjectiles = () => Array.from({ length: CONFIG.MAX_PROJECTILES }, (_, i): Projectile => ({
  id: i, type: DamageType.KINETIC, pos: { x: 0, y: 0 }, start: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
  dmg: 0, life: 0, maxLife: 0, splashR: 0, active: false, color: '#fff', trail: []
}));

const createParticles = () => Array.from({ length: CONFIG.MAX_PARTICLES }, (_, i): Particle => ({
  id: i, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, life: 0, maxLife: 0, size: 0,
  color: '#fff', active: false, drag: 0, type: 'spark'
}));

export const createGameState = (): GameState => {
  const routes: PathNode[][] = [
    [[-1, 8], [6, 8], [6, 3], [14, 3], [14, 8], [22, 8], [22, 13], [28, 13]],
    [[-1, 8], [6, 8], [6, 13], [14, 13], [14, 8], [22, 8], [22, 3], [28, 3]],
  ];
  
  return {
    phase: 'build',
    coreHp: CONFIG.CORE_MAX,
    maxCoreHp: CONFIG.CORE_MAX,
    cash: CONFIG.START_CASH,
    wave: 0,
    score: 0,
    autoWave: false,
    autoWaveTimer: 0,
    speedMode: 1,
    gridW: CONFIG.GRID_COLS,
    gridH: CONFIG.GRID_ROWS,
    cellSize: 40, // Base calculation unit
    grid: new Array(CONFIG.GRID_COLS * CONFIG.GRID_ROWS).fill(-1),
    routes,
    routePts: [[], []],
    routeSegLens: [[], []],
    enemies: createEnemies(),
    towers: [],
    projectiles: createProjectiles(),
    particles: createParticles(),
    time: 0,
    deltaTime: 0,
    cameraShake: 0,
  };
};

export const MathUtils = {
  distSq: (a: Vector2, b: Vector2) => (a.x - b.x)**2 + (a.y - b.y)**2,
  dist: (a: Vector2, b: Vector2) => Math.hypot(a.x - b.x, a.y - b.y),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  randRange: (min: number, max: number) => min + Math.random() * (max - min),
  randInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)
};
