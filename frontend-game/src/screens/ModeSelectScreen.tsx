import React, { useState, useEffect, useMemo } from 'react';
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

export const ModeSelectScreen: React.FC = () => {
  const { setScreen, setMode } = useGameStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const modes = useMemo(() => [
    { 
      id: 'solo', 
      label: 'SINGLE PLAYER', 
      description: 'Practice your rhythm skills solo',
      action: () => {
        setMode('solo');
        playSfx(selection, 3.0);
        setScreen('SONG_SELECT');
      }
    },
    { 
      id: 'multiplayer', 
      label: 'MULTIPLAYER', 
      description: 'Battle against another player',
      action: () => {
        setMode('multiplayer');
        playSfx(selection, 3.0);
        setScreen('SONG_SELECT');
      }
    },
    { 
      id: 'howto', 
      label: 'HOW TO PLAY', 
      description: 'Learn the game controls',
      action: () => {playSfx(selection, 3.0); setScreen('HOW_TO_PLAY')}
    },
  ], [setMode, setScreen]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          playSfx(changing, 0.75);
          setSelectedIndex((prev) => {
            const next = (prev - 1 + modes.length) % modes.length;
            return next;
          });
          break;
        case 'ArrowDown':
          event.preventDefault();
          playSfx(changing, 0.75);
          setSelectedIndex((prev) => {
            const next = (prev + 1) % modes.length;
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          playSfx(selection, 3.0);
          modes[selectedIndex].action();
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
  }, [selectedIndex, modes, setScreen]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      
      <div className="game-container">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="retro-title text-5xl mb-4 pixel-glow-pink">
            SELECT MODE
          </h1>
          <p className="text-lg pixel-glow-purple">
            CHOOSE YOUR GAME TYPE
          </p>
        </div>
        
        {/* Mode Selection */}
        <div className="space-y-6 max-w-md mx-auto">
          {modes.map((mode, index) => (
            <div
              key={mode.id}
              className={`pixel-menu-item transition-all duration-200 ${
                selectedIndex === index ? 'selected scale-105' : ''
              }`}
              onClick={() => mode.action()}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="text-center">
                <h3 className={`text-xl arcade-text mb-2 ${
                  selectedIndex === index ? 'pixel-glow-pink' : 'text-pixel-white'
                }`}>
                  {mode.label}
                </h3>
                <p className="text-pixel-gray text-sm">
                  {mode.description}
                </p>
                
                {selectedIndex === index && (
                  <div className="flex justify-center items-center space-x-2 mt-4">
                    <div className="pixel-arrow left"></div>
                    <span className="pixel-glow-pink text-xs">SELECT</span>
                    <div className="pixel-arrow right"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center mt-12 text-pixel-gray text-sm">
          <div>
            <div>UP DOWN TO NAVIGATE</div>
            <div>ENTER TO SELECT</div>
          </div>
          <div>
            <div>ESC TO GO BACK</div>
          </div>
        </div>
      </div>
    </div>
  );
};
