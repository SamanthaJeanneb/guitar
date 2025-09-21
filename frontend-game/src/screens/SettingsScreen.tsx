import React from 'react';
import { NeonButton } from '../components/ui/NeonButton';
import { PixelPanel } from '../components/ui/PixelPanel';
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

export const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, setScreen } = useGameStore();
  
  const handleVolumeChange = (volume: number) => {
    updateSettings({ volume });
    // Apply volume immediately to audio context if it exists
    const audioContext = (window as any).gameAudioContext;
    const gainNode = (window as any).gameGainNode;
    if (gainNode) {
      gainNode.gain.value = volume;
    }
  };
  
  return (
    <div className="min-h-screen brick-wall p-8 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-purple-900/50 to-black/70"></div>
      <div className="max-w-2xl mx-auto">
        {/* Settings Panel */}
        <PixelPanel className="mb-8">
          <div className="space-y-8">
            {/* Master Volume */}
            <div>
              <h3 className="text-2xl text-white mb-4 arcade-text">MASTER VOLUME</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-300 w-12">0%</span>
                  <div className="flex-1 relative">
                    <input
                      aria-label="Master Volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="slider w-full h-3 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #22d3ee ${settings.volume * 100}%, #374151 ${settings.volume * 100}%)`,
                      }}
                    />
                  </div>
                  <span className="text-gray-300 w-12">100%</span>
                </div>
                <div className="text-center">
                  <span className="text-cyan-400 text-xl arcade-text">
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PixelPanel>
        
        {/* Navigation */}
        <div className="flex justify-center">
          <NeonButton
            variant="secondary"
            onClick={() => {playSfx(selection, 3.0); setScreen('TITLE')}}
          >
            ← BACK TO MENU
          </NeonButton>
        </div>
      </div>
      
      <style>{`
        /* Reset default look */
        .slider { -webkit-appearance: none; appearance: none; outline: none; }
        /* Track */
        .slider::-webkit-slider-runnable-track { height: 12px; border-radius: 9999px; background: transparent; }
        .slider::-moz-range-track { height: 12px; border-radius: 9999px; background: transparent; }
        /* Thumb */
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #22d3ee;
          border: 2px solid #0ea5e9;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
          margin-top: -4px; /* center on 12px track */
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #22d3ee;
          border: 2px solid #0ea5e9;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
