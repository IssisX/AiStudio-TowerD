import { GameState, Enemy, Tower, Projectile, Particle, DamageType, EnemyType, Vector2 } from './types';
import { CONFIG, COLORS } from './constants';
import { MathUtils } from './engine';

// Tower definitions
export const TOWER_DEFS = {
  kinetic: {
    baseCost: 50,
    range: 4.0, // in cells
    rof: 5.0, // shots per sec
    dmg: 10,
    color: COLORS.kinetic,
  },
  energy: {
    baseCost: 80,
    range: 5.0,
    rof: 2.0,
    dmg: 25,
    color: COLORS.energy,
  },
  splash: {
    baseCost: 120,
    range: 3.5,
    rof: 0.8,
    dmg: 45,
    splashR: 1.5,
    color: COLORS.splash,
  }
};

export const spawnEnemy = (state: GameState, type: EnemyType, routeIdx: number, hpMult: number) => {
  const e = state.enemies.find(e => !e.active);
  if (!e) return;
  const route = state.routePts[routeIdx];
  const startPos = route[0];
  
  e.active = true;
  e.type = type;
  e.pos = { ...startPos };
  e.route = routeIdx;
  e.wpIdx = 0;
  e.routeSegP = 0;
  e.status = { burnT: 0, slowT: 0, shockT: 0, corrodeT: 0, ionizeT: 0 };
  e.flashT = 0;
  e.spawnT = state.time;

  // Base stats calculation
  let hp = 40 * hpMult;
  let spd = 45;
  let rad = 12;
  let col = COLORS.enemyBase;
  let armor = 0;
  let shield = 0;
  let bounty = 5;
  let coreDmg = 2;

  switch(type) {
    case EnemyType.FAST: spd *= 2; hp *= 0.5; rad *= 0.8; col = '#fffa5c'; bounty = 4; break;
    case EnemyType.SHIELD: hp *= 1.5; shield = 0.6; rad *= 1.2; col = '#5c9aff'; bounty = 8; break;
    case EnemyType.ARMOR: hp *= 2.5; armor = 0.7; spd *= 0.7; col = '#ff5c5c'; bounty = 12; coreDmg = 5; break;
    case EnemyType.SWARM: hp *= 0.3; spd *= 1.3; rad *= 0.6; col = '#e45cff'; bounty = 2; coreDmg = 1; break;
    case EnemyType.BOSS: hp *= 12; spd *= 0.6; rad *= 2.0; col = '#ff2b2b'; bounty = 100; coreDmg = 20; break;
  }

  e.maxHp = hp;
  e.hp = hp;
  e.baseSpeed = spd;
  e.speed = spd;
  e.radius = rad;
  e.color = col;
  e.armor = armor;
  e.shield = shield;
  e.bounty = bounty;
  e.coreDmg = coreDmg;
};

export const emitParticle = (state: GameState, pType: Particle['type'], pos: Vector2, vel: Vector2, life: number, size: number, color: string, drag = 2.0, text?: string, p2?: Vector2) => {
  const p = state.particles.find(p => !p.active);
  if (!p) return;
  p.active = true;
  p.type = pType;
  p.pos = { ...pos };
  p.vel = { ...vel };
  p.life = life;
  p.maxLife = life;
  p.size = size;
  p.color = color;
  p.drag = drag;
  p.text = text;
  if(p2) p.p2 = {...p2};
};

const applyDamage = (state: GameState, enemyId: number, rawDmg: number, type: DamageType) => {
  const e = state.enemies[enemyId];
  if (!e || !e.active) return;
  
  let dmg = rawDmg;
  
  // Synergy: Shocked enemies take extra kinetic
  if (type === DamageType.KINETIC && e.status.shockT > 0) dmg *= 1.5;
  // Corroded enemies have less armor
  let effectiveArmor = e.armor;
  if (e.status.corrodeT > 0) effectiveArmor = Math.max(0, effectiveArmor - 0.5);

  // Mitigation
  if (type === DamageType.KINETIC) dmg *= (1 - effectiveArmor);
  if (type === DamageType.ENERGY) dmg *= (1 - e.shield);

  // Synergy: Energy ionizing
  if (type === DamageType.ENERGY) e.status.ionizeT = 3.0;
  if (type !== DamageType.ENERGY && e.status.ionizeT > 0) dmg *= 1.25;

  e.hp -= dmg;
  e.flashT = 0.1;

  emitParticle(state, 'text', {x: e.pos.x, y: e.pos.y - e.radius - 5}, {x: MathUtils.randRange(-10, 10), y: MathUtils.randRange(-20, -40)}, 0.6, 12, '#fff', 1.0, Math.floor(dmg).toString());

  if (e.hp <= 0) {
    killEnemy(state, enemyId);
  }
};

export const killEnemy = (state: GameState, eId: number) => {
  const e = state.enemies[eId];
  if (!e.active) return;
  e.active = false;
  state.cash += e.bounty;
  state.score += e.bounty * 10;
  // Death explosion
  for(let i=0; i<8; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * 80 + 20;
    emitParticle(state, 'debris', {x: e.pos.x, y: e.pos.y}, {x: Math.cos(a)*v, y: Math.sin(a)*v}, Math.random()*0.4 + 0.2, Math.random()*3+2, e.color, 3.0);
  }
};

const leakEnemy = (state: GameState, eId: number) => {
  const e = state.enemies[eId];
  if (!e.active) return;
  e.active = false;
  state.coreHp -= e.coreDmg;
  state.cameraShake = Math.min(1.0, state.cameraShake + 0.4);
  
  // Screen flash could be added via a UI prop
  if (state.coreHp <= 0) {
    state.coreHp = 0;
    state.phase = 'gameover';
  }
};
