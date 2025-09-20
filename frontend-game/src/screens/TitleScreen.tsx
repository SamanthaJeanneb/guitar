import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export const TitleScreen: React.FC = () => {
  const { setScreen } = useGameStore();
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setScreen('MODE_SELECT');
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setScreen]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      
      <div className="game-container text-center">
        {/* Main Title */}
        <div className="mb-16">
          <h1 className="retro-title text-6xl mb-8 pixel-glow-pink">
            SAVE THE BEAR
          </h1>
          <div className="pixel-glow-purple text-xl mb-4">
            ARCADE EDITION
          </div>
        </div>
        
        {/* Start Prompt */}
          <div className="pixel-blink mb-12">
            <p className="text-2xl pixel-glow-pink mb-8">
              PRESS ENTER TO START
            </p>
            <button className="nes-btn is-primary text-lg px-8">
              ENTER
            </button>
          </div>
        
        {/* Arcade UI Elements */}
        <div className="absolute top-8 left-8 pixel-glow-purple text-sm">
          INSERT COIN
        </div>
        <div className="absolute top-8 right-8 pixel-glow-pink text-sm">
          HIGH SCORE 999999
        </div>
        <div className="absolute bottom-8 left-8 pixel-glow-pink text-sm">
          1 PLAYER
        </div>
        <div className="absolute bottom-8 right-8 pixel-glow-purple text-sm">
          COPYRIGHT 2024 ARCADE
        </div>
      </div>
    </div>
  );
};
