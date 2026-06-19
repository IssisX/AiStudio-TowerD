import { GameState, EnemyType } from './types';
import { spawnEnemy } from './logic';

export const updateWaveManager = (state: GameState, dt: number) => {
  if (state.phase !== 'combat') return;

  // Track active enemies
  let activeCount = 0;
  for(let i=0; i<state.enemies.length; i++) {
    if(state.enemies[i].active) activeCount++;
  }

  // Wave definitions (dynamic progression)
  // For this prototype, we'll build waves algorithmically based on state.wave
  
  if (!state.waveData) {
    // initialize wave
    state.waveData = {
      spawned: 0,
      totalToSpawn: 10 + state.wave * 5,
      timer: 0,
      interval: Math.max(0.2, 1.5 - state.wave * 0.1),
      cleared: false,
    };
  }

  if (state.waveData.spawned < state.waveData.totalToSpawn) {
    state.waveData.timer -= dt;
    if (state.waveData.timer <= 0) {
      state.waveData.timer = state.waveData.interval;
      
      // Determine enemy type
      const types = [EnemyType.GRUNT];
      if (state.wave >= 2) types.push(EnemyType.FAST);
      if (state.wave >= 3) types.push(EnemyType.SWARM, EnemyType.SWARM);
      if (state.wave >= 4) types.push(EnemyType.SHIELD);
      if (state.wave >= 6) types.push(EnemyType.ARMOR);
      if (state.wave > 0 && state.wave % 5 === 0 && state.waveData.spawned === Math.floor(state.waveData.totalToSpawn/2)) {
         types.push(EnemyType.BOSS);
      }

      const type = types[Math.floor(Math.random() * types.length)];
      const route = Math.random() > 0.5 ? 0 : 1;
      
      spawnEnemy(state, type, route, 1.0 + state.wave * 0.2);
      state.waveData.spawned++;
    }
  } else if (activeCount === 0) {
    // Wave completed
    state.phase = 'build';
    state.cash += 50 + state.wave * 10;
    state.waveData = undefined;
    
    if (state.autoWave) {
      state.autoWaveTimer = 4.0; // 4 seconds intermission
    }
  }
};
