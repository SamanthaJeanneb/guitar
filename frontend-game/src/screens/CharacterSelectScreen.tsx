import React from 'react';
import { NeonButton } from '../components/ui/NeonButton';
import { PixelPanel } from '../components/ui/PixelPanel';
import { useGameStore } from '../store/gameStore';

interface Character {
  id: string;
  name: string;
  power: number;
  speed: number;
  style: number;
  color: string;
}


const CHARACTERS: Character[] = [
  { id: 'bear', name: 'BEAR', power: 85, speed: 70, style: 60, color: 'from-red-500 to-orange-500' },
  { id: 'man', name: 'MAN', power: 60, speed: 85, style: 80, color: 'from-blue-500 to-cyan-500' },
];


export const CharacterSelectScreen: React.FC = () => {
  const { players, selectCharacter, setScreen, lobby } = useGameStore();

  // Helper to get current character index for a player
  const getCharIndex = (player: 1 | 2) => {
    const id = player === 1 ? players.p1.characterId : players.p2.characterId;
    return CHARACTERS.findIndex(c => c.id === id) >= 0 ? CHARACTERS.findIndex(c => c.id === id) : 0;
  };

  // Swap character for a player
  const swapChar = (player: 1 | 2, dir: -1 | 1) => {
    const idx = getCharIndex(player);
    const newIdx = (idx + dir + CHARACTERS.length) % CHARACTERS.length;
    selectCharacter(player, CHARACTERS[newIdx].id);
  };

  const renderChar = (player: 1 | 2) => {
    const idx = getCharIndex(player);
    const char = CHARACTERS[idx];
    const isP2Available = lobby.connectedP2 || player === 1;
    const imgSrc = char.id === 'bear' ? '/images/bearcharacter.png' : '/images/mancharacter.png';
    return (
      <PixelPanel variant="outlined" className="flex flex-col items-center py-8">
        <h2 className="text-3xl font-black text-white mb-2">PLAYER {player}</h2>
        {!isP2Available && <p className="text-gray-500 text-sm mb-4">Waiting for opponent...</p>}
        {isP2Available && (
          <>
            <div className="flex items-center justify-center gap-8 mb-4">
              <button
                className="nes-btn is-warning text-xl px-3 py-1"
                onClick={() => swapChar(player, -1)}
                aria-label="Previous Character"
              >←</button>
              <img src={imgSrc} alt={char.name} style={{ width: 120, height: 140 }} />
              <button
                className="nes-btn is-warning text-xl px-3 py-1"
                onClick={() => swapChar(player, 1)}
                aria-label="Next Character"
              >→</button>
            </div>
            <div className="text-center mb-2">
              <h3 className="text-2xl font-bold text-white mb-1">{char.name}</h3>
              <div className="text-lg text-pixel-gray mb-1">
                {char.id === 'bear' ? 'GUITAR' : 'DRUMS'}
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 w-full max-w-xs mx-auto">
              <h4 className="text-white mb-2 text-center">STATS</h4>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">POWER</span>
                  <span className="text-white">{char.power}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500" style={{ width: `${char.power}%` }} />
                </div>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">SPEED</span>
                  <span className="text-white">{char.speed}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: `${char.speed}%` }} />
                </div>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">STYLE</span>
                  <span className="text-white">{char.style}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500" style={{ width: `${char.style}%` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </PixelPanel>
    );
  };

  return (
    <div className="min-h-screen brick-wall p-8 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-purple-900/50 to-black/70"></div>
      <div className="max-w-6xl mx-auto">
        {/* Character Swappers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 relative z-10">
          {renderChar(1)}
          {renderChar(2)}
        </div>
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <NeonButton
            variant="secondary"
            onClick={() => setScreen('SONG_SELECT')}
          >
            ← BACK
          </NeonButton>
          <NeonButton
            variant="primary"
            disabled={!players.p1.characterId}
            onClick={() => setScreen('LOBBY')}
          >
            NEXT →
          </NeonButton>
        </div>
      </div>
    </div>
  );
};
