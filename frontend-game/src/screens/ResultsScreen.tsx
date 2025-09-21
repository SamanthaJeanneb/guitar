import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import selection from '../../../assets/selection.wav';
import changing from '../../../assets/change.wav';

const playSfx = (file: string, vol: number) => {
  const w = window as Window & { gameAudioContext?: AudioContext };

  if (!w.gameAudioContext) {
    try {
      w.gameAudioContext = new AudioContext();
    } catch (e) {
      console.warn('failed to create audio context', e);
      return;
    }
  }

  if (w.gameAudioContext.state === 'suspended') {
    w.gameAudioContext.resume();
  }

  fetch(file)
    .then(res => res.arrayBuffer())
    .then(buffer => w.gameAudioContext!.decodeAudioData(buffer))
    .then(decoded => {
      const source = w.gameAudioContext!.createBufferSource();

      const sfxGain = w.gameAudioContext!.createGain();
      sfxGain.gain.value = vol;

      source.buffer = decoded;
      source.connect(sfxGain).connect(w.gameAudioContext!.destination);
      source.start(0);
    })
  .catch(err => console.warn("failed to play sfx", err));
}

export const ResultsScreen: React.FC = () => {
  const { gameplay, players, setScreen, resetGame } = useGameStore();
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          playSfx(selection, 3.0);
          setScreen('MODE_SELECT');
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          playSfx(selection, 3.0);
          resetGame();
          setScreen('TITLE');
          break;
        case 'Escape':
          event.preventDefault();
          playSfx(selection, 3.0);
          setScreen('TITLE');
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setScreen, resetGame]);
  
  const totalScore = gameplay.scoreP1 + gameplay.scoreP2;
  const maxCombo = Math.max(gameplay.comboP1, gameplay.comboP2);
  const avgAccuracy = (gameplay.accuracyP1 + gameplay.accuracyP2) / 2;
  
  // Determine win message based on character and outcome
  const getWinMessage = () => {
    if (!gameplay.outcome) return 'RESULTS';
    
    // For single player, assume player 1 is the main player
    const playerCharacter = players.p1.characterId;
    
    if (gameplay.outcome === 'bear_escaped') {
      return playerCharacter === 'bear' ? 'BEAR ESCAPED - YOU WIN!' : 'BEAR ESCAPED - YOU LOSE!';
    } else if (gameplay.outcome === 'man_caught') {
      return playerCharacter === 'man' ? 'MAN CAUGHT THE BEAR - YOU WIN!' : 'MAN CAUGHT THE BEAR - YOU LOSE!';
    }
    
    return 'RESULTS';
  };
  
  const getStars = (accuracy: number) => {
    if (accuracy >= 95) return 5;
    if (accuracy >= 85) return 4;
    if (accuracy >= 75) return 3;
    if (accuracy >= 65) return 2;
    if (accuracy >= 50) return 1;
    return 0;
  };
  const stars = getStars(avgAccuracy);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      
      <div className="game-container">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="retro-title text-5xl mb-6 pixel-glow-pink">
            {getWinMessage()}
          </h1>
          <div className="flex justify-center items-center gap-4 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="inline-block mx-2">
                <i
                  className={`nes-icon star is-large ${i < stars ? '' : 'is-empty'}`}
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
          <div className="text-sm text-pixel-gray">ACCURACY {avgAccuracy.toFixed(1)}%</div>
        </div>
        
        {/* Stats */}
        <div className="pixel-panel p-8 mb-8 max-w-lg mx-auto">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-pixel-white text-lg">SCORE</span>
              <span className="pixel-glow-purple text-xl">
                {totalScore.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-pixel-white text-lg">MAX COMBO</span>
              <span className="pixel-glow-pink text-xl">
                {maxCombo}X
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-pixel-white text-lg">ACCURACY</span>
              <span className="pixel-glow-pink text-xl">
                {avgAccuracy.toFixed(1)}%
              </span>
            </div>
            
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <button className="nes-btn is-primary text-lg px-8 pixel-blink">
            ENTER CONTINUE
          </button>
          <div className="text-pixel-gray text-sm">
            R RESTART GAME
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center mt-12 text-pixel-gray text-sm">
          <div>
            <div>ENTER CONTINUE</div>
            <div>R RESTART</div>
          </div>
          <div>
            <div>ESC QUIT</div>
          </div>
        </div>
      </div>
    </div>
  );
};
