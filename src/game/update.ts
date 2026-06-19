import { GameState, EnemyType, DamageType, Vector2 } from './types';
import { CONFIG, COLORS } from './constants';
import { TOWER_DEFS, emitParticle } from './logic';
import { MathUtils } from './engine';

import { updateWaveManager } from './waveManager';

const applyDamageToEnemy = (state: GameState, e: any, dmg: number, type: DamageType) => {
  let effectiveDmg = dmg;
  if(type === DamageType.KINETIC && e.status.shockT > 0) effectiveDmg *= 1.5;
  let armor = Math.max(0, e.armor - (e.status.corrodeT > 0 ? 0.5 : 0));
  if(type === DamageType.KINETIC) effectiveDmg *= (1 - armor);
  if(type === DamageType.ENERGY) effectiveDmg *= (1 - e.shield);
  if(type !== DamageType.ENERGY && e.status.ionizeT > 0) effectiveDmg *= 1.25;
  
  e.hp -= effectiveDmg;
  e.flashT = 0.1;
  
  emitParticle(state, 'text', {x: e.pos.x, y: e.pos.y - e.radius - 8}, 
    {x: MathUtils.randRange(-10, 10), y: MathUtils.randRange(-20, -40)}, 0.6, 11, type === DamageType.ENERGY ? '#ff0' : '#fff', 2, Math.floor(effectiveDmg).toString());

  if(e.hp <= 0 && e.active) {
    e.active = false;
    state.cash += e.bounty;
    state.score += e.bounty * 10;
    for(let i=0; i<6; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 60 + 20;
      emitParticle(state, 'debris', e.pos, {x: Math.cos(a)*v, y: Math.sin(a)*v}, Math.random() * 0.4 + 0.2, 3, e.color, 4);
    }
  }
};

const splashDamage = (state: GameState, center: Vector2, radius: number, dmg: number) => {
  const rSq = radius * radius;
  for(let i=0; i<CONFIG.MAX_ACTIVE_ENEMIES; i++) {
    const e = state.enemies[i];
    if(!e.active) continue;
    if(MathUtils.distSq(center, e.pos) <= rSq) {
      applyDamageToEnemy(state, e, dmg, DamageType.SPLASH);
      e.status.burnT = 2.0; // Splash also burns
    }
  }

  // Explosion fx
  for(let i=0; i<15; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * radius * 3;
    emitParticle(state, 'smoke', center, {x: Math.cos(a)*v, y: Math.sin(a)*v}, 0.5, 4, COLORS.splash, 3);
  }
  state.cameraShake = Math.min(1.0, state.cameraShake + 0.2);
};

export const updateGame = (state: GameState, dt: number) => {
  if (state.phase !== 'combat' && state.phase !== 'build') return;
  
  state.time += dt;
  state.deltaTime = dt;
  if(state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - dt * 2.0);

  // Auto Wave Logic
  if (state.phase === 'build' && state.autoWave) {
    if (state.autoWaveTimer > 0) {
      state.autoWaveTimer -= dt;
      if (state.autoWaveTimer <= 0) {
        state.phase = 'combat';
        state.wave++;
      }
    }
  }

  updateWaveManager(state, dt);

  // Update Particles
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vel.x *= drag;
    p.vel.y *= drag;
  }

  // Update Enemies
  for(let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if(!e.active) continue;
    
    // Status effects
    if(e.status.burnT > 0) { e.status.burnT -= dt; applyDamageToEnemy(state, e, 5 * dt, DamageType.BURN); }
    if(e.status.ionizeT > 0) e.status.ionizeT -= dt;
    if(e.status.shockT > 0) e.status.shockT -= dt;
    if(e.status.corrodeT > 0) e.status.corrodeT -= dt;
    if(e.flashT > 0) e.flashT -= dt;
    
    if(!e.active) continue; // Died from burn

    // Movement
    let speedMult = 1.0;
    if(e.status.slowT > 0) { speedMult *= 0.5; e.status.slowT -= dt; }
    if(e.status.shockT > 0) speedMult = 0;

    const moveAmt = e.baseSpeed * speedMult * dt;
    if(moveAmt > 0) {
      const route = state.routePts[e.route];
      const routeLens = state.routeSegLens[e.route];
      let remain = moveAmt;

      while(remain > 0 && e.wpIdx < route.length - 1) {
        const segLen = routeLens[e.wpIdx];
        const segRemain = segLen * (1 - e.routeSegP);
        if(remain < segRemain) {
          e.routeSegP += remain / segLen;
          remain = 0;
        } else {
          remain -= segRemain;
          e.wpIdx++;
          e.routeSegP = 0;
        }
      }
      
      if(e.wpIdx >= route.length - 1) {
        e.active = false;
        state.coreHp -= e.coreDmg;
        state.cameraShake = Math.min(1.0, state.cameraShake + 0.3);
        if(state.coreHp <= 0) {
          state.coreHp = 0;
          state.phase = 'gameover';
        }
      } else {
        const a = route[e.wpIdx];
        const b = route[e.wpIdx + 1];
        e.pos.x = a.x + (b.x - a.x) * e.routeSegP;
        e.pos.y = a.y + (b.y - a.y) * e.routeSegP;
      }
    }
  }

  // Find targets & Fire Towers
  for(let i=0; i<state.towers.length; i++) {
    const t = state.towers[i];
    const def = TOWER_DEFS[t.type];
    const range = def.range * state.cellSize * (1 + t.tier * 0.1);
    const rSq = range * range;
    
    // Simple closest targeting
    let bestDist = Infinity;
    let target: any = null;
    
    // Optimization: avoid search if reloading (except charge weapons maybe)
    const isReloading = t.lastFired > 0;
    if(isReloading) t.lastFired -= dt;
    
    for(let j=0; j<CONFIG.MAX_ACTIVE_ENEMIES; j++) {
      const e = state.enemies[j];
      if(!e.active) continue;
      const dSq = MathUtils.distSq(t.pos, e.pos);
      if(dSq <= rSq && dSq < bestDist) {
        bestDist = dSq;
        target = e;
      }
    }

    if(target) {
      t.targetId = target.id;
      const angle = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
      // Smooth rotate
      const ad = angle - t.angle;
      t.angle += Math.atan2(Math.sin(ad), Math.cos(ad)) * dt * 10;
      
      if(!isReloading) {
        const rof = def.rof * (1 + t.upgrades.branchA * 0.4);
        t.lastFired = 1 / rof;
        t.recoil = 1.0;
        
        let dmg = def.dmg + (t.tier * def.dmg * 0.5);
        dmg *= (1 + t.upgrades.branchB * 0.5);

        if(t.type === 'kinetic') {
          // Fire kinetic bullet
          const p = state.projectiles.find(p => !p.active);
          if(p) {
            p.active = true;
            p.type = DamageType.KINETIC;
            p.pos = {...t.pos};
            p.start = {...t.pos};
            p.life = 1.0;
            p.maxLife = 1.0;
            p.dmg = dmg;
            p.color = COLORS.kinetic;
            
            // lead target slightly
            const d = Math.sqrt(bestDist);
            const tta = d / 500;
            const predX = target.pos.x; // + target velocity * tta
            const predY = target.pos.y;
            const th = Math.atan2(predY - t.pos.y, predX - t.pos.x);
            p.vel = {x: Math.cos(th)*600, y: Math.sin(th)*600};
          }
        } else if (t.type === 'energy') {
          // Instant beam
          applyDamageToEnemy(state, target, dmg, DamageType.ENERGY);
          // Visual beam trace
          emitParticle(state, 'beam', t.pos, {x:0, y:0}, 0.15, 2, COLORS.energy, 0, undefined, target.pos);
          target.status.shockT = 1.0; 
        } else if (t.type === 'splash') {
          // Fire arc projectile
          const p = state.projectiles.find(p => !p.active);
          if(p) {
            p.active = true;
            p.type = DamageType.SPLASH;
            p.pos = {...t.pos};
            p.start = {...t.pos};
            p.target = {...target.pos};
            const dist = Math.sqrt(bestDist);
            p.life = dist / 250;
            p.maxLife = p.life;
            p.dmg = dmg;
            p.splashR = (def.splashR || 2) * state.cellSize;
            p.color = COLORS.splash;
          }
        }
      }
    } else {
      t.targetId = null;
    }
    
    if(t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 5.0);
  }

  // Update Projectiles
  for(let i=0; i<state.projectiles.length; i++) {
    const p = state.projectiles[i];
    if(!p.active) continue;
    p.life -= dt;
    
    if(p.type === DamageType.KINETIC) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      
      // Basic collision
      for(let j=0; j<CONFIG.MAX_ACTIVE_ENEMIES; j++) {
        const e = state.enemies[j];
        if(!e.active) continue;
        if(MathUtils.distSq(p.pos, e.pos) < e.radius * e.radius + 100) {
          p.active = false;
          applyDamageToEnemy(state, e, p.dmg, DamageType.KINETIC);
          emitParticle(state, 'spark', p.pos, {x: -p.vel.x*0.1, y: -p.vel.y*0.1}, 0.2, 3, p.color, 4);
          e.status.corrodeT = 3.0; // Basic corrosion from kinetic
          break;
        }
      }
      if(p.life <= 0) p.active = false;
    } else if (p.type === DamageType.SPLASH) {
      if(p.target) {
        const t = 1 - (p.life / p.maxLife);
        p.pos.x = MathUtils.lerp(p.start.x, p.target.x, t);
        // arc
        const arc = Math.sin(t * Math.PI) * 50;
        p.pos.y = MathUtils.lerp(p.start.y, p.target.y, t) - arc;
      }
      if(p.life <= 0) {
        p.active = false;
        if(p.target) splashDamage(state, p.target, p.splashR, p.dmg);
      }
    }
  }

}
