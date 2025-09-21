import React, { useState } from 'react';
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

export const HowToPlayScreen: React.FC = () => {
  const { setScreen } = useGameStore();
  const [showInputTest, setShowInputTest] = useState(false);
  const [lastInput, setLastInput] = useState<string>('');
  
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showInputTest) return;
      
      const key = event.key.toLowerCase();
      let inputName = '';
      
      switch (key) {
        case 'v': inputName = 'GREEN LANE'; break;
        case 'c': inputName = 'RED LANE'; break;
        case 'x': inputName = 'YELLOW LANE'; break;
        case 'z': inputName = 'BLUE LANE'; break;
      }
      
      if (inputName) {
        setLastInput(inputName);
        setTimeout(() => setLastInput(''), 1000);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showInputTest]);
  
  return (
    <div className="min-h-screen retro-bg scanlines p-8 relative">
      {/* Retro grid background */}
      <div className="absolute inset-0 pixel-bg opacity-15"></div>
      
      <div className="game-container">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="retro-title text-4xl mb-2 pixel-glow-pink">HOW TO PLAY</h1>
          <p className="pixel-glow-purple">Master the arcade rhythm</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 relative z-10">
          {/* Goal */}
          <div className="pixel-panel p-6">
            <h3 className="text-lg pixel-glow-pink mb-4">OBJECTIVE</h3>
            <p className="text-pixel-white mb-4 text-sm">
              Hit notes when they cross the target line. Timing is everything!
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-green-400">PERFECT</span>
                <span className="text-pixel-white">≤ 20ms</span>
              </div>
              <div className="flex justify-between">
                <span className="pixel-glow-purple">GREAT</span>
                <span className="text-pixel-white">≤ 40ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-400">GOOD</span>
                <span className="text-pixel-white">≤ 60ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-400">MISS</span>
                <span className="text-pixel-white"> 60ms</span>
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="pixel-panel p-6">
            <h3 className="text-lg pixel-glow-pink mb-4">CONTROLS</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-pixel-white text-sm mb-2">PLAYER 1</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-lg">V C X Z</span>
                    <span className="text-pixel-gray">Hit Notes</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-pixel-gray mt-4">
                <div>ESC = PAUSE GAME</div>
                <div>ENTER = SELECT/CONFIRM</div>
              </div>
            </div>
          </div>
          
          {/* Note Types */}
          <div className="pixel-panel p-6">
            <h3 className="text-lg pixel-glow-purple mb-4">LANES</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 lane-green flex items-center justify-center text-xs text-black">G</div>
                <span className="text-pixel-white text-sm">Green Lane</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 lane-red flex items-center justify-center text-xs text-white">R</div>
                <span className="text-pixel-white text-sm">Red Lane</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 lane-yellow flex items-center justify-center text-xs text-black">Y</div>
                <span className="text-pixel-white text-sm">Yellow Lane</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 lane-blue flex items-center justify-center text-xs text-white">B</div>
                <span className="text-pixel-white text-sm">Blue Lane</span>
              </div>
            </div>
          </div>
          
          {/* Tips */}
          <div className="pixel-panel p-6">
            <h3 className="text-lg pixel-glow-pink mb-4">TIPS</h3>
            <ul className="text-pixel-white space-y-2 text-xs">
              <li>• Perfect timing = maximum points</li>
              <li>• Build combos for score multipliers</li>
              <li>• Missing notes damages health</li>
              <li>• Hit notes when they cross the line</li>
              <li>• Different lanes = different colors</li>
            </ul>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            className="pixel-button"
            onClick={() => {playSfx(selection, 3.0); setScreen('TITLE')}}
          >
            ← BACK
          </button>
          
          <button
            className="pixel-button"
            onClick={() => {playSfx(selection, 3.0); setShowInputTest(!showInputTest)}}
          >
            {showInputTest ? 'CLOSE INPUT TEST' : 'TRY INPUT TEST'}
          </button>
        </div>
        
        {/* Input Test Overlay */}
        {showInputTest && (
          <div className="fixed inset-0 bg-pixel-darker bg-opacity-90 flex items-center justify-center z-50">
            <div className="pixel-panel p-8 max-w-md">
              <div className="text-center">
                <h3 className="text-lg pixel-glow-pink mb-4">INPUT TEST</h3>
                <p className="text-pixel-gray mb-6 text-sm">Press V C X Z to test</p>
                
                <div className="h-16 flex items-center justify-center pixel-panel bg-pixel-darker mb-6">
                  {lastInput ? (
                    <div className="text-lg text-green-400 pixel-blink">
                      {lastInput}
                    </div>
                  ) : (
                    <div className="text-pixel-gray text-sm pixel-blink">WAITING...</div>
                  )}
                </div>
                
                <button
                  className="pixel-button"
                  onClick={() => {playSfx(selection, 3.0); setShowInputTest(false)}}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
