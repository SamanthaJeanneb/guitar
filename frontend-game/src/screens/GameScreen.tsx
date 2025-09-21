import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameEngine, Note, Judgment } from '../game/gameEngine';
import { GameEngine as MultiplayerGameEngine } from '../game/gameEngineMultiplayer';
import { InputHandler, InputEvent } from '../game/inputHandler';
import { getConn, LobbyApi } from '../lib/spacetime';

declare global {
  interface Window {
    gameAudioContext?: AudioContext;
    gameGainNode?: GainNode;
  }
}

export const GameScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameEngineRef = useRef<GameEngine | MultiplayerGameEngine | null>(null);
  const inputHandlerRef = useRef<InputHandler | null>(null);
  
  const { 
    song,
    players, 
    lobby, 
    gameplay, 
    updateGameplay, 
    settings,
    setScreen
  } = useGameStore();
  
  const [isPaused, setIsPaused] = useState(false);
  // Keep latest scoring values
  const scoreP1Ref = useRef(gameplay.scoreP1);
  const scoreP2Ref = useRef(gameplay.scoreP2);
  const comboP1Ref = useRef(gameplay.comboP1);
  const comboP2Ref = useRef(gameplay.comboP2);
  // Track chase stats (bear vs man) pulled from engine
  const [bearProgress, setBearProgress] = useState(0);
  const [manProgress, setManProgress] = useState(0);
  const [bearBoost, setBearBoost] = useState(false);
  const [gameResult, setGameResult] = useState<'bear_escaped' | 'man_caught' | null>(null);
  const [playerWon, setPlayerWon] = useState<boolean | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const endHandledRef = useRef(false);

  useEffect(() => { scoreP1Ref.current = gameplay.scoreP1; }, [gameplay.scoreP1]);
  useEffect(() => { scoreP2Ref.current = gameplay.scoreP2; }, [gameplay.scoreP2]);
  useEffect(() => { comboP1Ref.current = gameplay.comboP1; }, [gameplay.comboP1]);
  useEffect(() => { comboP2Ref.current = gameplay.comboP2; }, [gameplay.comboP2]);

  // Stable callbacks
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        console.log('MatchPaused');
        gameEngineRef.current?.pause();
      } else {
        console.log('MatchResumed');
        gameEngineRef.current?.resume();
      }
      return next;
    });
  }, []);

  const handleNoteResult = useCallback((result: { judgment: Judgment; note: Note; player: number; accuracy: number }) => {
    const player = result.player;
    const currentScore = player === 1 ? scoreP1Ref.current : scoreP2Ref.current;
    const currentCombo = player === 1 ? comboP1Ref.current : comboP2Ref.current;

    const newScore = currentScore + result.judgment.score;
    const newCombo = result.judgment.type !== 'Miss' ? currentCombo + 1 : 0;

    updateGameplay({
      [`scoreP${player}`]: newScore,
      [`comboP${player}`]: newCombo,
      [`accuracyP${player}`]: result.accuracy,
    });

    const isMultiplayer = lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2;
    if (isMultiplayer && lobby.code) {
      const conn = getConn();
      const localPlayer = lobby.side === 'blue' ? 2 : 1; 
      if (result.player === localPlayer && conn) {
        try {
          LobbyApi.setScore(conn, lobby.code, newScore);
        } catch (e) {
          console.warn('setScore failed', e);
        }
      }
    }
  }, [updateGameplay, lobby.mode, lobby.code, lobby.side, lobby.connectedP2]);

  const handleInput = useCallback((inputEvent: InputEvent) => {
    if (isPaused || !gameEngineRef.current) return;

    if (inputEvent.type === 'hit') {
      const result = gameEngineRef.current.handleInput(inputEvent.lane, inputEvent.type, inputEvent.player);
      if (result.judgment) {
        console.log('NoteHit', {
          player: inputEvent.player,
          lane: inputEvent.lane,
          type: inputEvent.type,
          noteType: result.note?.type || 'none',
          judgment: result.judgment.type,
          score: result.judgment.score,
          hold: result.note?.holdDuration || 0
        });
      }
    } else if (inputEvent.type === 'release') {
      gameEngineRef.current.handleRelease(inputEvent.lane);
    }
  }, [isPaused]);

  // Function to sync game state to server
  const syncGameState = useCallback((bearProgress: number, manProgress: number, gameOver: boolean, gameResult?: string) => {
    const isMultiplayer = lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2;
    if (isMultiplayer && lobby.code) {
      const conn = getConn();
      if (conn) {
        try {
          LobbyApi.updateGameState(conn, lobby.code, bearProgress, manProgress, gameOver, gameResult);
        } catch (e) {
          console.warn('Failed to sync game state:', e);
        }
      }
    }
  }, [lobby.mode, lobby.code, lobby.connectedP2]);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Get or create audio context and gain node
    const audioContext = window.gameAudioContext || new AudioContext();
    const gainNode = window.gameGainNode || audioContext.createGain();
    
    if (!window.gameAudioContext) {
      window.gameAudioContext = audioContext;
      window.gameGainNode = gainNode;
      gainNode.connect(audioContext.destination);
    }
  // Apply initial volume from settings
  const initialVolume = Math.max(0, Math.min(1, settings.volume ?? 1));
  gainNode.gain.value = initialVolume;
    
    // Initialize game systems - use multiplayer engine if multiplayer mode is selected
    const isMultiplayer = lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2;
    gameEngineRef.current = isMultiplayer 
      ? new MultiplayerGameEngine(canvasRef.current, audioContext, gainNode)
      : new GameEngine(canvasRef.current, audioContext, gainNode);
    inputHandlerRef.current = new InputHandler();
    
    // Set up note result callback
    gameEngineRef.current.setNoteResultCallback(handleNoteResult);
    
  // Setup input handling
  const cleanup = inputHandlerRef.current.onInput(handleInput);
    
    // Setup stats tracking (bear vs man chase)
    statsIntervalRef.current = setInterval(() => {
      const engine = gameEngineRef.current;
      if (!engine) return;
      const stats = engine.getStats();
      
      // Use synchronized values in multiplayer, local values in single player
      const isMultiplayer = lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2;
      const currentBearProgress = isMultiplayer ? gameplay.bearProgress : stats.bearProgress;
      const currentManProgress = isMultiplayer ? gameplay.manProgress : stats.manProgress;
      const currentGameOver = isMultiplayer ? gameplay.synchronizedGameOver : stats.gameOver;
      const currentGameResult = isMultiplayer ? gameplay.synchronizedGameResult : stats.gameResult;
      
      setBearProgress(currentBearProgress);
      setManProgress(currentManProgress);
      setBearBoost(stats.spacebarPressed);
      
      // Sync local game state to server in multiplayer
      if (isMultiplayer && lobby.code) {
        syncGameState(stats.bearProgress, stats.manProgress, stats.gameOver, stats.gameResult || undefined);
      }
      
      if (currentGameOver && (currentGameResult === 'bear_escaped' || currentGameResult === 'man_caught')) {
        setGameResult(currentGameResult);
        if (!endHandledRef.current) {
          endHandledRef.current = true;
          
          let currentPlayerWon = false;
          
          if (isMultiplayer) {
            // In multiplayer, determine win condition based on character assignment
            const localPlayer = lobby.side === 'blue' ? 2 : 1;
            const localPlayerCharacter = localPlayer === 1 ? players.p1.characterId : players.p2.characterId;
            
            if (currentGameResult === 'bear_escaped') {
              // Bear escaped - bear player wins
              currentPlayerWon = localPlayerCharacter === 'bear';
            } else if (currentGameResult === 'man_caught') {
              // Man caught the bear - man player wins
              currentPlayerWon = localPlayerCharacter === 'man';
            }
            
            setPlayerWon(currentPlayerWon);
            console.log('Multiplayer game result:', {
              gameResult: currentGameResult,
              localPlayer,
              localPlayerCharacter,
              playerWon: currentPlayerWon
            });
          } else {
            // Single player mode - always show results
            setPlayerWon(null);
          }
          
          if (isMultiplayer) {
            // Auto-restart the song in multiplayer mode
            console.log('Multiplayer song complete - auto-restarting...');
            setTimeout(() => {
              endHandledRef.current = false; // Reset the flag
              setPlayerWon(null); // Reset win state
              engine.start(song?.id); // Restart the same song
            }, 1000); // Brief pause before restart
          } else {
            // Single player mode - go to results as normal
            engine.stop();
            updateGameplay({ gameOver: true, outcome: currentGameResult });
            setScreen('RESULTS');
          }
        }
      }
    }, 100);
    
    // Setup pause handling
    const handlePause = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        togglePause();
      }
    };
    
  document.addEventListener('keydown', handlePause);
    
    // Start game
  gameEngineRef.current.start(song?.id);
    
    return () => {
  // Stop engine/audio on unmount
  gameEngineRef.current?.stop?.();
  if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
  endHandledRef.current = false;
      cleanup();
      document.removeEventListener('keydown', handlePause);
      inputHandlerRef.current?.destroy();
    };
  }, [
    players.p1.characterId,
    players.p2.characterId,
    lobby.connectedP2,
    lobby.mode,
    lobby.code,
    song?.id,
    settings.volume,
    handleInput,
    handleNoteResult,
    togglePause,
    updateGameplay,
    setScreen,
    syncGameState,
    gameplay.bearProgress,
    gameplay.manProgress,
    gameplay.synchronizedGameOver,
    gameplay.synchronizedGameResult,
  lobby.side,
  ]);

  // React to volume changes in settings
  useEffect(() => {
    const vol = Math.max(0, Math.min(1, settings.volume ?? 1));
    // Update engine gain
    gameEngineRef.current?.setVolume(vol);
    // Also set the shared gain node in case engine is not yet created or for menu sounds
    if (window.gameGainNode) {
      window.gameGainNode.gain.value = vol;
    }
  }, [settings.volume]);
  
  const restartSong = () => {
  // Ensure previous run is fully stopped
  gameEngineRef.current?.stop?.();
    // Reset gameplay state
    updateGameplay({
      started: true,
      paused: false,
      scoreP1: 0,
      scoreP2: 0,
      comboP1: 0,
      comboP2: 0,
      accuracyP1: 100,
      accuracyP2: 100,
      gameOver: false,
    });
    
    // Restart the game engine
    if (gameEngineRef.current && song) {
      gameEngineRef.current = new GameEngine(canvasRef.current!, window.gameAudioContext!, window.gameGainNode!);
      gameEngineRef.current.setNoteResultCallback(handleNoteResult);
      gameEngineRef.current.start(song.id);
    }
  };

  const getRank = (accuracy: number) => {
    if (accuracy >= 95) return 'S';
    if (accuracy >= 85) return 'A';
    if (accuracy >= 75) return 'B';
    if (accuracy >= 65) return 'C';
    return 'D';
  };

  
  
  const CharacterPanel: React.FC<{ player: 1 | 2 }> = ({ player }) => {
    const score = player === 1 ? gameplay.scoreP1 : gameplay.scoreP2;
    const combo = player === 1 ? gameplay.comboP1 : gameplay.comboP2;
    const accuracy = player === 1 ? gameplay.accuracyP1 : gameplay.accuracyP2;
    const characterId = player === 1 ? players.p1.characterId : players.p2.characterId;
    
    const colorClass = player === 1 ? 'lane-green' : 'lane-blue';
    
    // Get character icon based on assigned character
    const getCharacterIcon = () => {
      if (characterId === 'bear') {
        return '🐻';
      } else if (characterId === 'man') {
        return '🧍';
      } else {
        return '🎮'; // Default controller icon if no character assigned
      }
    };
    
    return (
      <div className="pixel-panel p-6 max-w-xs">
        <div className="text-center mb-4">
          <h3 className="pixel-glow-pink text-lg">P{player}</h3>
        </div>
        
        {/* Player Indicator */}
        <div className={`w-24 h-32 mx-auto mb-4 ${colorClass} flex items-center justify-center`}>
          <div className="text-6xl">{getCharacterIcon()}</div>
        </div>
        
        {/* Stats */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-pixel-gray">SCORE</span>
            <span className="pixel-glow-purple">{score.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-gray">COMBO</span>
            <span className="pixel-glow-pink">{combo}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-gray">ACC</span>
            <span className="pixel-glow-pink">{accuracy.toFixed(1)}%</span>
          </div>
        </div>
        
        {/* Control hints */}
        <div className="mt-4 text-xs text-pixel-gray text-center">
          V C X Z
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen retro-bg scanlines relative">
      {/* Retro grid overlay */}
      <div className="absolute inset-0 pixel-bg opacity-10"></div>
      
      {/* Bear vs Man Chase Bar - replaces old progress bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-full px-4 max-w-2xl">
        <div className="pixel-panel bg-pixel-darker p-3">
          <div className="relative h-6 bg-[#222] overflow-hidden border border-pixel-purple">
            <div className="absolute inset-0 flex">
              <div
                className="h-full bg-green-600 transition-all duration-150"
                style={{ width: `${Math.min(100, bearProgress)}%` }}
              ></div>
              <div
                className="h-full bg-red-600 transition-all duration-150 -ml-px"
                style={{ width: `${Math.min(100, manProgress)}%` }}
              ></div>
            </div>
            {/* Bear icon */}
            <div
              className="absolute top-1/2 -translate-y-1/2 text-xs"
              style={{ left: `calc(${Math.min(100, bearProgress)}% - 12px)` }}
            >🐻</div>
            {/* Man icon */}
            <div
              className="absolute top-1/2 -translate-y-1/2 text-xs"
              style={{ left: `calc(${Math.min(100, manProgress)}% - 8px)` }}
            >🧍</div>
          </div>
          <div className="flex justify-between text-[10px] mt-1 font-mono">
            <span className="pixel-glow-green">BEAR {bearProgress.toFixed(1)}%</span>
            {bearBoost && <span className="pixel-glow-yellow animate-pulse">BOOST!</span>}
            <span className="pixel-glow-red">MAN {manProgress.toFixed(1)}%</span>
          </div>
          {gameResult && (
            <div className="text-center mt-2 text-xs pixel-glow-pink">
              {gameResult === 'bear_escaped' ? 'BEAR ESCAPED!' : 'MAN CAUGHT THE BEAR!'}
            </div>
          )}
        </div>
      </div>
      
      {/* HUD */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 game-container">
        <div className="flex items-center space-x-6 pixel-score">
          <div className="text-center">
            <div className="pixel-glow-purple text-xs">SCORE</div>
            <div className="pixel-glow-pink text-sm">
              {(gameplay.scoreP1 + gameplay.scoreP2).toLocaleString()}
            </div>
          </div>
          <div className="w-1 h-6 bg-pixel-gray"></div>
          <div className="text-center">
            <div className="pixel-glow-purple text-xs">COMBO</div>
            <div className="pixel-glow-pink text-sm">
              {Math.max(gameplay.comboP1, gameplay.comboP2)}x
            </div>
          </div>
          <div className="w-1 h-6 bg-pixel-gray"></div>
          <div className="text-center">
            <div className="pixel-glow-purple text-xs">ACCURACY</div>
            <div className="pixel-glow-pink text-sm">
              {((gameplay.accuracyP1 + gameplay.accuracyP2) / 2).toFixed(1)}%
            </div>
          </div>
          <div className="w-1 h-6 bg-pixel-gray"></div>
          <div className="text-center">
            <div className="pixel-glow-purple text-xs">GRADE</div>
            <div className="pixel-glow-pink text-sm">
              {getRank((gameplay.accuracyP1 + gameplay.accuracyP2) / 2)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Game Layout */}
      <div className="flex items-center justify-center min-h-screen px-8 game-container">
        {/* Player 1 Character Area */}
        <div className="flex-1 flex justify-center">
          <CharacterPanel player={1} />
        </div>
        
        {/* Game Canvas - Retro styled */}
        <div className="flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={950}
            height={670}
            className=""
            style={{ imageRendering: 'pixelated', backgroundColor: 'transparent' }}
          />
          
          {/* Lane labels below canvas */}
          <div className="flex justify-center mt-2 space-x-8">
            <div className="text-xs lane-green px-2 py-1">G</div>
            <div className="text-xs lane-red px-2 py-1">R</div>
            <div className="text-xs lane-yellow px-2 py-1">Y</div>
            <div className="text-xs lane-blue px-2 py-1">B</div>
          </div>
        </div>
        
        {/* Player 2 Character Area */}
        <div className="flex-1 flex justify-center">
          {lobby.connectedP2 && <CharacterPanel player={2} />}
        </div>
      </div>
      
      {/* Pause Menu */}
      {isPaused && (
        <div className="absolute inset-0 bg-pixel-darker bg-opacity-90 flex items-center justify-center z-50">
          <div className="pixel-panel p-8 text-center">
            <h2 className="retro-title text-3xl mb-6 pixel-glow-pink">PAUSED</h2>
            <div className="space-y-4">
              <button className="nes-btn is-primary w-full" onClick={togglePause}>
                RESUME
              </button>
              <button className="nes-btn w-full" onClick={() => setScreen('TITLE')}>
                QUIT TO HOME
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Multiplayer Win/Lose Overlay */}
      {gameResult && playerWon !== null && (lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2) && (
        <div className="absolute inset-0 bg-pixel-darker bg-opacity-95 flex items-center justify-center z-50">
          <div className={`pixel-panel p-8 text-center border-4 ${playerWon ? 'border-green-500' : 'border-red-500'}`}>
            <h2 className={`retro-title text-5xl mb-4 ${playerWon ? 'pixel-glow-green' : 'pixel-glow-red'}`}>
              {playerWon ? 'VICTORY!' : 'DEFEAT!'}
            </h2>
            <p className={`text-2xl mb-6 ${playerWon ? 'pixel-glow-green' : 'pixel-glow-red'}`}>
              {gameResult === 'bear_escaped' 
                ? (playerWon ? 'BEAR ESCAPED! YOU WIN!' : 'BEAR ESCAPED! YOU LOSE!')
                : (playerWon ? 'MAN CAUGHT THE BEAR! YOU WIN!' : 'MAN CAUGHT THE BEAR! YOU LOSE!')
              }
            </p>
            <div className="text-sm pixel-glow-purple mb-4">
              RESTARTING IN 1 SECOND...
            </div>
          </div>
        </div>
      )}

      {/* Game Over Menu */}
      {gameplay.gameOver && !(lobby.mode === 'host' || lobby.mode === 'join' || lobby.connectedP2) && (
        <div className="absolute inset-0 bg-pixel-darker bg-opacity-90 flex items-center justify-center z-50">
          <div className="pixel-panel p-8 text-center border-4 border-red-500">
            <h2 className="retro-title text-4xl mb-4 pixel-glow-pink">SONG COMPLETE</h2>
            <p className="pixel-glow-purple text-lg mb-6">GREAT JOB!</p>
            <div className="space-y-4">
              <button className="nes-btn is-success w-full text-lg" onClick={() => setScreen('RESULTS')}>
                VIEW RESULTS
              </button>
              <button className="nes-btn is-primary w-full" onClick={restartSong}>
                PLAY AGAIN
              </button>
              <button className="nes-btn w-full" onClick={() => setScreen('TITLE')}>
                QUIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute top-4 right-4 text-right pixel-glow-purple text-xs">
        <div>ESC = PAUSE</div>
        <div>KEYS: V C X Z</div>
      </div>
    </div>
  );
};
