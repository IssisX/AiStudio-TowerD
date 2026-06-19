import { GameState, DamageType, EnemyType } from './types';
import { COLORS } from './constants';
import { TOWER_DEFS } from './logic';

let offscreenCanvas: HTMLCanvasElement;
let offscreenCtx: CanvasRenderingContext2D;

export const initRenderer = (width: number, height: number) => {
  offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  offscreenCtx = offscreenCanvas.getContext('2d')!;
};

export const renderGame = (ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number, selectedTowerId?: number | null) => {
  if (!offscreenCtx) initRenderer(width, height);
  
  ctx.save();
  // Camera shake
  if (state.cameraShake > 0) {
    const shake = state.cameraShake * 10;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // Draw background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const cs = state.cellSize;
  
  // Center grid
  const offsetX = (width - state.gridW * cs) / 2;
  const offsetY = (height - state.gridH * cs) / 2;

  ctx.translate(offsetX, offsetY);

  ctx.beginPath();
  for(let x=0; x<=state.gridW; x++) {
    ctx.moveTo(x * cs, 0);
    ctx.lineTo(x * cs, state.gridH * cs);
  }
  for(let y=0; y<=state.gridH; y++) {
    ctx.moveTo(0, y * cs);
    ctx.lineTo(state.gridW * cs, y * cs);
  }
  ctx.stroke();

  // Draw persistent background layer
  ctx.drawImage(offscreenCanvas, -offsetX, -offsetY);

  // Draw routes
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for(const route of state.routePts) {
    if(route.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(route[0].x, route[0].y);
    for(let i=1; i<route.length; i++) ctx.lineTo(route[i].x, route[i].y);
    
    ctx.lineWidth = cs * 0.6;
    ctx.strokeStyle = COLORS.path;
    ctx.stroke();
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.pathEdge;
    ctx.stroke();
  }

  // Draw Core
  const corePos = state.routePts[0]?.[state.routePts[0].length - 1];
  if(corePos) {
    ctx.fillStyle = state.coreHp > state.maxCoreHp * 0.3 ? COLORS.core : COLORS.enemyBase;
    const pulse = 1 + Math.sin(state.time * 4) * 0.1;
    ctx.beginPath();
    ctx.arc(corePos.x, corePos.y, cs * 0.6 * pulse, 0, Math.PI*2);
    ctx.fill();
    // core hp text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${state.coreHp}`, corePos.x, corePos.y);
  }

  // Draw Towers
  for(const t of state.towers) {
    if (t.pos.x < 0) continue; // Sold tower

    ctx.save();
    ctx.translate(t.pos.x, t.pos.y);
    
    // Selection ring
    if (selectedTowerId === t.id) {
      ctx.beginPath();
      ctx.arc(0, 0, cs * 0.8 + Math.sin(state.time * 5) * 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Range indicator
      ctx.beginPath();
      const range = TOWER_DEFS[t.type].range * cs * (1 + t.tier * 0.1);
      ctx.arc(0, 0, range, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255, 0.05)';
      ctx.fill();
    }

    // Tower base
    ctx.fillStyle = '#1a1f26';
    ctx.beginPath();
    ctx.roundRect(-cs/2.2, -cs/2.2, cs/1.1, cs/1.1, 4);
    ctx.fill();
    ctx.strokeStyle = TOWER_DEFS[t.type].color;
    ctx.lineWidth = 2 + t.tier * 0.5; // Thicker base for higher tier
    ctx.stroke();

    // Turret
    ctx.rotate(t.angle);
    ctx.fillStyle = '#2d3748';
    
    // Recoil
    const recoilOffset = -t.recoil * 5;
    
    if(t.type === 'kinetic') {
      if (t.upgrades.branchA >= 1) {
         // Dual barrels
         ctx.fillRect(recoilOffset, -8, 16, 4);
         ctx.fillRect(recoilOffset, 4, 16, 4);
      } else {
         ctx.fillRect(recoilOffset, -4, 16, 8);
      }
      ctx.beginPath(); ctx.arc(0, 0, 8 + t.upgrades.branchB * 2, 0, Math.PI*2); ctx.fill();
    } else if (t.type === 'energy') {
      if (t.upgrades.branchB >= 1) {
         ctx.fillRect(recoilOffset, -8, 24, 16);
      } else {
         ctx.fillRect(recoilOffset, -6, 20, 12);
      }
      ctx.fillStyle = COLORS.energy;
      // crystal grows
      ctx.fillRect(recoilOffset + 10, -4, 8 + t.upgrades.branchA * 4, 8); 
    } else {
      ctx.fillRect(recoilOffset - 4, -10 - t.upgrades.branchA * 2, 14, 20 + t.upgrades.branchA * 4);
      ctx.beginPath(); ctx.arc(recoilOffset + 2, 0, 10 + t.upgrades.branchB * 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Draw Enemies
  for(const e of state.enemies) {
    if(!e.active) continue;
    
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    
    if(e.flashT > 0) ctx.filter = 'brightness(200%)';
    
    // Status visualizers
    if(e.status.burnT > 0) {
      ctx.shadowColor = COLORS.burn;
      ctx.shadowBlur = 10;
    }
    if(e.status.ionizeT > 0) {
      ctx.strokeStyle = COLORS.energy;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 4, 0, Math.PI*2); ctx.stroke();
    }
    
    ctx.fillStyle = e.color;
    ctx.beginPath();
    if(e.type === EnemyType.FAST) {
      ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-8, -8);
    } else if (e.type === EnemyType.ARMOR) {
      ctx.rect(-e.radius, -e.radius, e.radius*2, e.radius*2);
    } else {
      ctx.arc(0, 0, e.radius, 0, Math.PI*2);
    }
    ctx.fill();

    // HP Bar
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-10, -e.radius - 8, 20, 4);
    ctx.fillStyle = hpPct > 0.5 ? COLORS.core : COLORS.enemyBase;
    ctx.fillRect(-10, -e.radius - 8, 20 * hpPct, 4);
    
    // Armor indicator
    if(e.armor > 0) {
      ctx.fillStyle = '#aaa';
      ctx.fillRect(-10, -e.radius - 4, 20 * e.armor, 2);
    }
    // Shield indicator
    if(e.shield > 0) {
     ctx.fillStyle = '#5c9aff';
     ctx.fillRect(-10, -e.radius - 2, 20 * e.shield, 2);
    }

    ctx.restore();
  }

  // Draw Projectiles
  for (const p of state.projectiles) {
    if (!p.active) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if(p.type === DamageType.KINETIC) {
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(Math.atan2(p.vel.y, p.vel.x));
      ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    } else {
      ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Draw Particles
  for(const p of state.particles) {
    if(!p.active) continue;
    if(p.type === 'text' && p.text) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.pos.x, p.pos.y);
      ctx.globalAlpha = 1.0;
    } else if (p.type === 'beam' && p.p2) {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.p2.x, p.p2.y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size * (p.life/p.maxLife), 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  ctx.restore(); // remove grid translation offset offset
};
