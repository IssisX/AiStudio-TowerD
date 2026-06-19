export type Vector2 = { x: number; y: number };

export enum DamageType {
  KINETIC = 'kinetic',
  ENERGY = 'energy',
  SPLASH = 'splash',
  BURN = 'burn',
}

export enum EnemyType {
  GRUNT = 'grunt',
  SWARM = 'swarm',
  FAST = 'fast',
  SHIELD = 'shield',
  ARMOR = 'armor',
  ELITE = 'elite',
  BOSS = 'boss',
}

export type EnemyStatus = {
  burnT: number;
  slowT: number;
  shockT: number; // Stun via energy
  corrodeT: number; // Armor shred via splash/kinetic mix
  ionizeT: number; // Mark
};

export type Enemy = {
  id: number;
  type: EnemyType;
  pos: Vector2;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  armor: number; // damage reduction against kinetic
  shield: number; // damage reduction against energy
  radius: number;
  route: number; // 0 or 1 usually
  wpIdx: number;
  routeSegP: number;
  status: EnemyStatus;
  bounty: number;
  coreDmg: number;
  color: string;
  active: boolean;

  flashT: number;
  spawnT: number;
};

export type TowerType = 'kinetic' | 'energy' | 'splash';

export type TowerCustomization = {
  // Tree branches
  branchA: number; // Level 0-3
  branchB: number; // Level 0-3
};

export type Tower = {
  id: number;
  type: TowerType;
  pos: Vector2;
  cellX: number;
  cellY: number;
  angle: number;
  lastFired: number;
  targetId: number | null;
  upgrades: TowerCustomization;
  invested: number;
  tier: number; // Total tier

  recoil: number;
  chargeT: number;
};

export type Projectile = {
  id: number;
  type: DamageType;
  pos: Vector2;
  start: Vector2;
  target?: Vector2;
  vel: Vector2;
  dmg: number;
  life: number;
  maxLife: number;
  splashR: number;
  active: boolean;
  color: string;
  trail: Vector2[];
};

export type Particle = {
  id: number;
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
  drag: number;
  type: 'spark' | 'smoke' | 'debris' | 'text' | 'beam' | 'residue';
  text?: string;
  p2?: Vector2;
};

export type PathNode = [number, number]; // grid X, Y

export type GameState = {
  phase: 'build' | 'combat' | 'gameover';
  coreHp: number;
  maxCoreHp: number;
  cash: number;
  wave: number;
  score: number;
  
  autoWave: boolean;
  autoWaveTimer: number;
  waveData?: {
    spawned: number;
    totalToSpawn: number;
    timer: number;
    interval: number;
    cleared: boolean;
  };
  speedMode: number; // 1, 2, or 4
  
  gridW: number;
  gridH: number;
  cellSize: number;
  grid: number[]; // -1 empty, else tower id
  
  routes: PathNode[][];
  routePts: Vector2[][];
  routeSegLens: number[][];
  
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  particles: Particle[];

  time: number;
  deltaTime: number;

  cameraShake: number;
};
