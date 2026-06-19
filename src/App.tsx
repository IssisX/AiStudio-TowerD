import React, { useEffect, useRef, useState } from 'react';
import { createGameState } from './game/engine';
import { updateGame } from './game/update';
import { renderGame } from './game/renderer';
import { spawnEnemy, TOWER_DEFS } from './game/logic';
import { EnemyType, TowerType, GameState } from './game/types';
import { CONFIG } from './game/constants';
import { Play, Pause, FastForward, Info, Plus, ChevronUp, RefreshCw } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(createGameState());
  
  const [uiState, setUiState] = useState({
    cash: 0,
    coreHp: 0,
    wave: 0,
    score: 0,
    phase: 'build',
    autoWave: false,
    speedMode: 1,
  });

  const [selectedTool, setSelectedTool] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null);
  const selectedTowerIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Engine compilation & start
    const state = gameStateRef.current;
    
    // Convert logic routes to pixel coords
    const cs = state.cellSize;
    for(let r=0; r<state.routes.length; r++) {
      const nodes = state.routes[r];
      const pts = nodes.map(n => ({ x: n[0] * cs + cs/2, y: n[1] * cs + cs/2 }));
      state.routePts[r] = pts;
      const lens = [];
      for(let i=0; i<pts.length - 1; i++) {
        lens.push(Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y));
      }
      state.routeSegLens[r] = lens;
    }

    let lastTime = performance.now();
    let animFrame: number;

    const loop = (time: number) => {
      animFrame = requestAnimationFrame(loop);
      
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      
      // Clamp DT to prevent death spirals
      if (dt > CONFIG.MAX_DT) dt = CONFIG.MAX_DT;

      const state = gameStateRef.current;

      // 1 Update inside loop
      for(let i=0; i<state.speedMode; i++) {
        updateGame(state, dt);
      }

      // Render
      if (canvasRef.current) {
         renderGame(canvasRef.current.getContext('2d')!, state, window.innerWidth, window.innerHeight, selectedTowerIdRef.current);
      }

      // Sync UI periodically
      if (Math.random() < 0.1) {
        setUiState({
          cash: state.cash,
          coreHp: state.coreHp,
          wave: state.wave,
          score: Math.floor(state.score),
          phase: state.phase,
          autoWave: state.autoWave,
          speedMode: state.speedMode,
        });
      }
    };

    animFrame = requestAnimationFrame(loop);
    
    // Handle resizes
    const handleResize = () => {
      if(canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const state = gameStateRef.current;
    
    const cs = state.cellSize;
    const offsetX = (window.innerWidth - state.gridW * cs) / 2;
    const offsetY = (window.innerHeight - state.gridH * cs) / 2;
    
    const cx = Math.floor((e.clientX - offsetX) / cs);
    const cy = Math.floor((e.clientY - offsetY) / cs);
    
    if (cx >= 0 && cx < state.gridW && cy >= 0 && cy < state.gridH) {
      const idx = cy * state.gridW + cx;
      
      // Check if clicking on an existing tower
      if (state.grid[idx] !== -1) {
        setSelectedTowerId(state.grid[idx]);
        selectedTowerIdRef.current = state.grid[idx];
        setSelectedTool(null);
        return;
      }

      // Deselect if empty and no tool
      if (!selectedTool) {
        setSelectedTowerId(null);
        selectedTowerIdRef.current = null;
        return;
      }
      
      if (state.grid[idx] === -1) {
        const def = TOWER_DEFS[selectedTool];
        if (state.cash >= def.baseCost) {
           state.cash -= def.baseCost;
           state.grid[idx] = state.towers.length;
           state.towers.push({
             id: state.towers.length,
             type: selectedTool,
             pos: { x: cx * cs + cs/2, y: cy * cs + cs/2 },
             cellX: cx,
             cellY: cy,
             angle: -Math.PI / 2,
             lastFired: 0,
             targetId: null,
             upgrades: { branchA: 0, branchB: 0 },
             invested: def.baseCost,
             tier: 0,
             recoil: 0,
             chargeT: 0,
           });
           setUiState(prev => ({...prev, cash: state.cash}));
        }
      }
    }
  };

  const startWave = () => {
    const state = gameStateRef.current;
    state.phase = 'combat';
    state.wave += 1;
    setUiState(prev => ({...prev, phase: 'combat', wave: state.wave}));
  };

  const toggleSpeed = () => {
    const state = gameStateRef.current;
    state.speedMode = state.speedMode === 1 ? 2 : (state.speedMode === 2 ? 4 : 1);
    setUiState(prev => ({...prev, speedMode: state.speedMode}));
  };

  const toggleAutoWave = () => {
    const state = gameStateRef.current;
    state.autoWave = !state.autoWave;
    setUiState(prev => ({...prev, autoWave: state.autoWave}));
  };

  const activeTower = selectedTowerId !== null ? gameStateRef.current.towers.find(t => t.id === selectedTowerId) : null;
  const upgradeCost = activeTower ? 100 + activeTower.tier * 50 : 0;

  const handleUpgrade = (branch: 'A' | 'B') => {
    if (!activeTower) return;
    const state = gameStateRef.current;
    if (state.cash >= upgradeCost) {
      state.cash -= upgradeCost;
      activeTower.invested += upgradeCost;
      activeTower.tier += 1;
      if (branch === 'A') activeTower.upgrades.branchA += 1;
      else activeTower.upgrades.branchB += 1;
      setUiState(prev => ({...prev, cash: state.cash}));
    }
  };

  const handleSell = () => {
    if (!activeTower || selectedTowerId === null) return;
    const state = gameStateRef.current;
    state.cash += Math.floor(activeTower.invested * 0.7);
    state.grid[activeTower.cellY * state.gridW + activeTower.cellX] = -1;
    // We don't remove from array to preserve IDs, just move it offscreen and disable it
    activeTower.pos = {x: -1000, y: -1000};
    setSelectedTowerId(null);
    selectedTowerIdRef.current = null;
    setUiState(prev => ({...prev, cash: state.cash}));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050608] text-white select-none">
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        className="absolute inset-0 z-0" 
      />
      
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
        
        <div className="flex space-x-6">
          <div className="flex flex-col bg-black/60 px-4 py-2 rounded-lg border border-white/10 backdrop-blur-md">
            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Core Integrity</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{uiState.coreHp} / {CONFIG.CORE_MAX}</div>
          </div>
          
          <div className="flex flex-col bg-black/60 px-4 py-2 rounded-lg border border-white/10 backdrop-blur-md">
            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Salvage</span>
            <div className="text-xl font-bold text-[#ffd659] mt-1">{uiState.cash} <span className="text-sm font-normal">CR</span></div>
          </div>
        </div>

        <div className="flex flex-col items-end bg-black/60 px-4 py-2 rounded-lg border border-white/10 backdrop-blur-md">
           <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
             {uiState.phase === 'build' ? 'Intermission' : `Wave ${uiState.wave}`}
           </span>
           <div className="text-xl font-bold mt-1 text-white">{uiState.score.toLocaleString()} PTS</div>
        </div>

      </div>

      {uiState.phase === 'build' && uiState.autoWave && gameStateRef.current.autoWaveTimer > 0 && (
         <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 rounded-full border border-emerald-500/30 text-emerald-400 font-bold tracking-widest text-sm backdrop-blur-md z-10 pointer-events-none">
            NEXT WAVE IN {Math.ceil(gameStateRef.current.autoWaveTimer)}s
         </div>
      )}

      {/* Bottom Command Bar */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-auto">
        <div className="flex items-center space-x-4 bg-black/80 px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-xl">
          
          {/* Towers */}
          <div className="flex space-x-2">
            {(Object.keys(TOWER_DEFS) as TowerType[]).map((type) => {
              const def = TOWER_DEFS[type];
              const isSelected = selectedTool === type;
              const canAfford = uiState.cash >= def.baseCost;
              return (
                <button 
                  key={type}
                  onClick={() => setSelectedTool(isSelected ? null : type)}
                  disabled={!canAfford}
                  className={`relative flex flex-col justify-center items-center w-16 h-16 rounded-xl border transition-all ${
                    isSelected ? 'border-[var(--tw-col)] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${!canAfford && 'opacity-50 grayscale cursor-not-allowed'}`}
                  style={{ '--tw-col': def.color } as any}
                >
                  <div className="w-6 h-6 rounded-sm mb-1" style={{backgroundColor: def.color}}></div>
                  <div className="text-[10px] font-bold tracking-wider uppercase" style={{color: def.color}}>{type}</div>
                  <div className="text-[10px] text-gray-400 absolute top-1 right-1 font-mono">{def.baseCost}</div>
                </button>
              );
            })}
          </div>

          <div className="w-px h-12 bg-white/10 mx-2"></div>

          {/* System Controls */}
          <div className="flex space-x-2 items-center">
            <button 
               onClick={startWave}
               disabled={uiState.phase === 'combat'}
               className="flex items-center justify-center space-x-2 bg-[#ff6230]/20 text-[#ff6230] border border-[#ff6230] hover:bg-[#ff6230]/30 disabled:opacity-50 disabled:grayscale px-6 h-16 rounded-xl font-bold tracking-widest transition-colors"
            >
              <Play className="w-5 h-5" />
              <span>{uiState.phase === 'combat' ? 'COMBAT' : 'DEPLOY'}</span>
            </button>
            <button onClick={toggleSpeed} className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors">
              <FastForward className="w-5 h-5 mb-1 text-gray-300" />
              <span className="text-[10px] font-bold text-gray-400">{uiState.speedMode}X</span>
            </button>
            <button onClick={toggleAutoWave} className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center transition-colors ${uiState.autoWave ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
              <RefreshCw className={`w-5 h-5 mb-1 ${uiState.autoWave && 'animate-spin-slow'}`} />
              <span className="text-[10px] font-bold">AUTO</span>
            </button>
          </div>

        </div>
      </div>

      {activeTower && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-64 bg-black/80 rounded-2xl border border-white/10 p-5 backdrop-blur-xl z-20 pointer-events-auto">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-bold uppercase tracking-widest text-white">{activeTower.type} Tower</h2>
             <span className="text-xs font-mono text-gray-400">Tier {activeTower.tier}</span>
          </div>
          
          <div className="space-y-3 mb-6">
            <button 
              disabled={uiState.cash < upgradeCost}
              onClick={() => handleUpgrade('A')}
              className="w-full relative overflow-hidden group bg-white/5 border border-white/10 hover:border-emerald-500/50 disabled:opacity-50 disabled:hover:border-white/10 rounded-xl p-3 text-left transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm tracking-wider">ROF / CHAIN</span>
                <span className="text-emerald-400 font-mono text-xs">{upgradeCost}</span>
              </div>
              <p className="text-[10px] text-gray-400">Enhance fire rate and combo potential.</p>
            </button>

            <button 
              disabled={uiState.cash < upgradeCost}
              onClick={() => handleUpgrade('B')}
              className="w-full relative overflow-hidden group bg-white/5 border border-white/10 hover:border-[#ff6230]/50 disabled:opacity-50 disabled:hover:border-white/10 rounded-xl p-3 text-left transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm tracking-wider">RAW POWER</span>
                <span className="text-[#ff6230] font-mono text-xs">{upgradeCost}</span>
              </div>
              <p className="text-[10px] text-gray-400">Increase base damage and armor penetration.</p>
            </button>
          </div>

          <button onClick={handleSell} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold tracking-widest transition-colors">
             SELL ({Math.floor(activeTower.invested * 0.7)})
          </button>
        </div>
      )}
      
      {uiState.phase === 'gameover' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
           <h1 className="text-8xl font-black text-red-500 mb-6 tracking-widest">OVERRUN</h1>
           <div className="text-2xl text-gray-300 mb-12">Waves Survived: <span className="text-white font-bold">{uiState.wave}</span></div>
           <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/10 border border-white/20 hover:bg-white/20 rounded-xl text-xl font-bold tracking-widest">HOLD AGAIN</button>
        </div>
      )}

    </div>
  );
}
