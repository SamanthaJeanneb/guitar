import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, Song } from '../store/gameStore';
import { useGeminiApi } from '../hooks/useGeminiApi';

interface Character {
  id: string;
  name: string;
  color: string;
}

const CHARACTERS: Character[] = [
  { id: 'bear', name: 'BEAR', color: 'from-red-500 to-orange-500' },
  { id: 'man', name: 'MAN', color: 'from-blue-500 to-cyan-500' },
];

type AppWindow = Window & { gameAudioContext?: AudioContext; gameGainNode?: GainNode };

export const SongSelectScreen: React.FC = () => {
  const { song, players, lobby, selectSong, selectCharacter, toggleReady, startMatch, setScreen, hostLobby, joinLobby, netConnected, netError } = useGameStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const [focusMode, setFocusMode] = useState<'song' | 'character'>('song');
  // Character swapper logic
  const CHARACTERS_FULL = React.useMemo(() => [
    { id: 'bear', name: 'BEAR', power: 85, speed: 70, style: 60, color: 'from-red-500 to-orange-500' },
    { id: 'man', name: 'MAN', power: 60, speed: 85, style: 80, color: 'from-blue-500 to-cyan-500' },
  ], []);
  const getCharIndex = React.useCallback((player: 1 | 2) => {
    const id = player === 1 ? players.p1.characterId : players.p2.characterId;
    return CHARACTERS_FULL.findIndex(c => c.id === id) >= 0 ? CHARACTERS_FULL.findIndex(c => c.id === id) : 0;
  }, [players.p1.characterId, players.p2.characterId, CHARACTERS_FULL]);
  const swapChar = React.useCallback((player: 1 | 2, dir: -1 | 1) => {
    const idx = getCharIndex(player);
    const newIdx = (idx + CHARACTERS_FULL.length + dir) % CHARACTERS_FULL.length;
    selectCharacter(player, CHARACTERS_FULL[newIdx].id);
  }, [getCharIndex, selectCharacter, CHARACTERS_FULL]);
  const renderChar = (player: 1 | 2) => {
    const idx = getCharIndex(player);
    const char = CHARACTERS_FULL[idx];
    const isP2Available = lobby.connectedP2 || player === 1;
    const imgSrc = char.id === 'bear' ? '/images/bearcharacter.png' : '/images/mancharacter.png';
    return (
      <div className="flex flex-col items-center py-8">
        {!isP2Available && <p className="text-gray-500 text-sm mb-4">Waiting for opponent...</p>}
        {isP2Available && (
          <>
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                className="nes-btn is-warning text-base px-2 py-1"
                style={{ minWidth: 32, minHeight: 32 }}
                onClick={() => swapChar(player, -1)}
                aria-label="Previous Character"
              >←</button>
              <img src={imgSrc} alt={char.name} style={{ width: 220, height: 260 }} />
              <button
                className="nes-btn is-warning text-base px-2 py-1"
                style={{ minWidth: 32, minHeight: 32 }}
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
            <div className="bg-gray-900/50 rounded-lg p-2 w-full max-w-xs mx-auto text-xs">
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
      </div>
    );
  };
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateChart, setGenerateChart] = useState(false);
  const currentSongRef = useRef<string>('');
  const [lobbyJoinCode, setLobbyJoinCode] = useState('');
  const geminiApi = useGeminiApi();

  const playPreview = useCallback((songItem: Song) => {
    // Stop current preview if playing
    if (previewAudio && currentSongRef.current !== songItem.id) {
      previewAudio.pause();
      console.log('MusicPreviewStop', { songId: currentSongRef.current });
    }

    // Don't restart if same song
    if (currentSongRef.current === songItem.id && previewAudio && !previewAudio.paused) {
      return;
    }

    const audio = new Audio(`/songs/${songItem.id}/song.ogg`);
    audio.volume = 0; // Controlled by Web Audio API
    audio.loop = true; // Loop the preview

    const w = window as AppWindow;
    const audioContext = w.gameAudioContext;
    const gainNode = w.gameGainNode;

    if (audioContext && gainNode) {
      const source = audioContext.createMediaElementSource(audio);
      source.connect(gainNode);
    }

    audio
      .play()
      .then(() => {
        setPreviewAudio(audio);
        currentSongRef.current = songItem.id;
        console.log('MusicPreviewStart', { songId: songItem.id });
      })
      .catch((err) => {
        console.warn('Preview playback failed:', err);
      });
  }, [previewAudio]);

  useEffect(() => {
    // Load song manifest from public folder
    const loadSongs = async () => {
      try {
        const res = await fetch('/songs/index.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Song[] = await res.json();
        setSongs(data);
        if (data.length > 0 && !song) {
          setSelectedSongIndex(0);
          selectSong(data[0]);
          playPreview(data[0]);
        }
      } catch (e) {
        console.warn('Failed to load songs manifest', e);
        setSongs([]);
      }
    };
    loadSongs();
  }, [playPreview, selectSong, song]);

  useEffect(() => {
    // Initialize audio context and gain node if not exists
    const w = window as AppWindow;
    if (!w.gameAudioContext) {
      w.gameAudioContext = new AudioContext();
      w.gameGainNode = w.gameAudioContext.createGain();
      w.gameGainNode.connect(w.gameAudioContext.destination);

      // Apply saved volume
      const savedVolume = localStorage.getItem('save-the-bear-volume');
      if (savedVolume && w.gameGainNode) {
        w.gameGainNode.gain.value = parseFloat(savedVolume);
      }
    }

    // Auto-select first song and start preview if none selected
    if (songs.length > 0 && !song) {
      selectSong(songs[0]);
      playPreview(songs[0]);
    }

    // Auto-select first character for P1
    if (!players.p1.characterId) {
      selectCharacter(1, CHARACTERS[0].id);
    }

    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [song, players.p1.characterId, selectSong, selectCharacter, songs, playPreview, previewAudio]);

  const canStart = useCallback(() => {
    if (lobby.mode === 'solo') {
      return Boolean(song && players.p1.characterId);
    } else {
      return Boolean(
        song &&
          players.p1.characterId &&
          lobby.connectedP2 &&
          players.p2.characterId &&
          lobby.p1Ready &&
          lobby.p2Ready
      );
    }
  }, [lobby.connectedP2, lobby.mode, lobby.p1Ready, lobby.p2Ready, players.p1.characterId, players.p2.characterId, song]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp': {
          event.preventDefault();
          if (focusMode === 'song' && songs.length > 0) {
            const newIndex = (selectedSongIndex - 1 + songs.length) % songs.length;
            setSelectedSongIndex(newIndex);
            selectSong(songs[newIndex]);
            playPreview(songs[newIndex]);
          } else {
            swapChar(1, -1);
          }
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          if (focusMode === 'song' && songs.length > 0) {
            const newIndex = (selectedSongIndex + 1) % songs.length;
            setSelectedSongIndex(newIndex);
            selectSong(songs[newIndex]);
            playPreview(songs[newIndex]);
          } else {
            swapChar(1, 1);
          }
          break;
        }
        case 'Tab': {
          event.preventDefault();
          setFocusMode(focusMode === 'song' ? 'character' : 'song');
          break;
        }
        case 'Enter': {
          event.preventDefault();
          if (focusMode === 'song' || focusMode === 'character') {
            if (lobby.mode !== 'solo') {
              toggleReady(1);
            } else if (canStart()) {
              startMatch();
            }
          } else if (canStart()) {
            startMatch();
          }
          break;
        }
        case ' ': {
          event.preventDefault();
          if (lobby.mode !== 'solo') {
            toggleReady(1);
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          setScreen('MODE_SELECT');
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSongIndex, focusMode, selectSong, selectCharacter, startMatch, setScreen, songs, lobby.mode, toggleReady, canStart, playPreview, swapChar]);

  const getDifficultyColor = (difficulty: Song['difficulty']) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-400 bg-green-400/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'Hard': return 'text-red-400 bg-red-400/20';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'audio/mp3' || file.type === 'audio/wav' || file.type === 'audio/mpeg' || file.type === 'audio/mp4')) {
      setUploadFile(file);
    } else {
      alert('Please upload an MP3, WAV, or MP4 audio file');
    }
  };

  const handleUploadAndGenerate = async () => {
    if (!uploadFile) return;
    
    setIsGenerating(true);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('song', uploadFile);
      
      // Upload to backend
      const response = await fetch('http://localhost:3001/api/upload-song', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Optionally generate chart using Gemini if enabled
        if (generateChart) {
          try {
            const songName = result.song.title;
            const chartContent = await geminiApi.generateChart(songName);
            
            // Save chart to the song directory
            const chartResponse = await fetch('http://localhost:3001/api/save-chart', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                songName: result.song.id,
                chartData: chartContent
              })
            });
            
            if (chartResponse.ok) {
              console.log('Chart generated and saved for:', songName);
            }
          } catch (chartError) {
            console.warn('Chart generation failed:', chartError);
            // Don't fail the upload if chart generation fails
          }
        }
        
        // Reload songs from the updated index.json
        const songsResponse = await fetch('/songs/index.json', { cache: 'no-cache' });
        if (songsResponse.ok) {
          const updatedSongs: Song[] = await songsResponse.json();
          setSongs(updatedSongs);
          
          // Find and select the new song
          const newSongIndex = updatedSongs.findIndex(song => song.id === result.song.id);
          if (newSongIndex >= 0) {
            setSelectedSongIndex(newSongIndex);
            selectSong(updatedSongs[newSongIndex]);
          }
        }
        
        console.log('Song uploaded successfully:', result.song);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload song. Please try again.');
    } finally {
      // Reset upload state
      setUploadFile(null);
      setShowUpload(false);
      setIsGenerating(false);
      setGenerateChart(false);
    }
  };
  
  return (
    <div className="min-h-screen p-8 relative">
      
      <div className="game-container">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="retro-title text-4xl mb-2 pixel-glow-pink">SONG SELECT</h1>
          <p className="pixel-glow-purple">Choose your song</p>
        </div>
        
        {/* Main Content */}
        <div className="flex gap-8 mb-8 relative z-10 justify-center items-start">
          {/* Character Selection - Left Side (swapper) */}
          <div className="flex-shrink-0 w-80">
            <div className={`pixel-panel p-6 ${focusMode === 'character' ? 'highlighted' : ''}`}> 
              <h2 className="text-lg pixel-glow-purple mb-6">
                Character {focusMode === 'character' && <span className="pixel-glow-pink">[ACTIVE]</span>}
              </h2>
              {/* Player 1 Character Swapper */}
              {renderChar(1)}
              {/* Player 2 Character Swapper (if multiplayer) */}
              {lobby.mode !== 'solo' && renderChar(2)}
            </div>
          </div>
          
          {/* Song Selection - Center */}
          <div className="flex-1 max-w-2xl">
            <div className={`pixel-panel p-6 ${focusMode === 'song' ? 'highlighted' : ''}`}>
              <h2 className="text-lg pixel-glow-purple mb-6">
                TRACKS {focusMode === 'song' && <span className="pixel-glow-pink">[ACTIVE]</span>}
              </h2>
              
              {/* Upload Button */}
              <div className="mb-4 text-center">
                <button
                  onClick={() => setShowUpload(!showUpload)}
                >
                  {showUpload ? 'CLOSE UPLOAD' : '+ UPLOAD SONG'}
                </button>
              </div>
              
              {/* Upload Panel */}
              {showUpload && (
                <div className="pixel-panel outlined p-4 mb-4">
                  <h3 className="text-sm pixel-glow-pink mb-4 text-center">UPLOAD SONG</h3>
                  <div className="space-y-4">
                    <div>
                      <input
                        type="file"
                        accept=".mp3,.wav,.mp4"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="song-upload"
                      />
                      <label
                        htmlFor="song-upload"
                        className="pixel-button w-full text-center cursor-pointer block py-3"
                      >
                        {uploadFile ? uploadFile.name : 'SELECT MP3/WAV/MP4 FILE'}
                      </label>
                    </div>
                    
                    {uploadFile && (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="generate-chart"
                            checked={generateChart}
                            onChange={(e) => setGenerateChart(e.target.checked)}
                            disabled={isGenerating}
                            className="w-4 h-4"
                          />
                          <label htmlFor="generate-chart" className="text-sm text-pixel-white">
                            Generate chart using AI (requires Gemini API key)
                          </label>
                        </div>
                        
                        <div className="text-center">
                          <button
                            className={`pixel-button px-6 py-3 ${isGenerating ? 'selected' : ''}`}
                            onClick={handleUploadAndGenerate}
                            disabled={isGenerating || geminiApi.isLoading}
                          >
                            {isGenerating || geminiApi.isLoading ? (
                              <span className="pixel-blink">
                                {generateChart ? 'GENERATING CHART...' : 'UPLOADING SONG...'}
                              </span>
                            ) : (
                              generateChart ? 'UPLOAD & GENERATE CHART' : 'UPLOAD SONG'
                            )}
                          </button>
                        </div>
                        
                        {geminiApi.error && (
                          <div className="text-red-400 text-xs text-center">
                            Chart generation failed: {geminiApi.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {songs.map((songItem, index) => (
                  <div
                    key={songItem.id}
                    className={`p-4 pixel-panel transition-all cursor-pointer ${
                      selectedSongIndex === index && focusMode === 'song'
                        ? 'highlighted scale-103'
                        : song?.id === songItem.id
                        ? 'outlined'
                        : 'hover:border-pixel-purple'
                    }`}
                    onClick={() => {
                      setSelectedSongIndex(index);
                      selectSong(songItem);
                      playPreview(songItem);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm text-pixel-white">{songItem.title}</h3>
                        <div className="pixel-glow-purple text-xs">{songItem.bpm} BPM</div>
                      </div>
                      <div className={`px-2 py-1 pixel-panel text-xs ${getDifficultyColor(songItem.difficulty)}`}>
                        {songItem.difficulty}
                      </div>
                    </div>
                    
                    {/* Selection indicator */}
                    {selectedSongIndex === index && focusMode === 'song' && (
                      <div className="flex items-center justify-center mt-2">
                        <div className="pixel-arrow left mr-2 pixel-blink"></div>
                        <span className="pixel-glow-pink text-xs">SELECT</span>
                        <div className="pixel-arrow right ml-2 pixel-blink"></div>
                      </div>
                    )}
                  </div>
                ))}
                {songs.length === 0 && (
                  <div className="p-4 pixel-panel text-pixel-gray text-center">
                    <div className="text-xs">NO TRACKS FOUND</div>
                    <div className="text-xs mt-2 pixel-blink">Insert game cartridge</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Ready Status Panel - Right Side (Multiplayer Only) */}
          {lobby.mode !== 'solo' && (
            <div className="flex-shrink-0 w-80">
              <div className="pixel-panel p-6 border-4 border-yellow-400">
                <h3 className="text-lg pixel-glow-pink mb-4">STATUS</h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-sm pixel-glow-pink mb-2">PLAYER 1</h4>
                    <div className={`text-lg ${lobby.p1Ready ? 'text-green-400' : 'text-yellow-400'}`}>
                      {lobby.p1Ready ? '✓ READY' : '⏳ NOT READY'}
                    </div>
                    <button
                      onClick={() => toggleReady(1)}
                      className={`mt-2 pixel-button text-xs ${
                        lobby.p1Ready 
                          ? 'border-4 border-red-500 text-red-400' 
                          : 'border-4 border-green-500 text-green-400'
                      }`}
                    >
                      {lobby.p1Ready ? 'UNREADY' : 'READY UP'}
                    </button>
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm pixel-glow-purple mb-2">PLAYER 2</h4>
                    <div className={`text-lg ${lobby.p2Ready ? 'text-green-400' : 'text-yellow-400'}`}>
                      {lobby.p2Ready ? '✓ READY' : '⏳ NOT READY'}
                    </div>
                    {/* Only show toggle for player 2 if this client IS player 2 */}
                    {lobby.side === 'blue' && (
                      <button
                        onClick={() => toggleReady(2)}
                        disabled={!lobby.connectedP2}
                        className={`mt-2 pixel-button text-xs ${
                          lobby.p2Ready 
                            ? 'border-4 border-red-500 text-red-400' 
                            : 'border-4 border-green-500 text-green-400'
                        } ${!lobby.connectedP2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {lobby.p2Ready ? 'UNREADY' : 'READY UP'}
                      </button>
                    )}
                  </div>
                </div>
                {lobby.p1Ready && lobby.p2Ready && (
                  <div className="mt-4 text-green-400 text-sm pixel-blink text-center">
                    ALL PLAYERS READY!
                  </div>
                )}
                <div className="mt-4 text-xs text-center text-pixel-gray">
                  {netConnected ? <span className="text-green-400">NET OK</span> : <span className="text-yellow-400">CONNECTING…</span>}
                  {netError && <div className="text-red-400 mt-1">{netError}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Lobby Actions */}
        {lobby.mode !== 'solo' && (
        <div className="pixel-panel p-4 mb-8">
          <h3 className="text-sm text-pixel-white mb-3">MULTIPLAYER LOBBY</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center">
              <button
                className="pixel-button px-6 py-3 w-full"
                onClick={hostLobby}
              >
                CREATE LOBBY CODE
              </button>
              {lobby.code && (
                <div className="mt-2 text-pixel-gray text-xs">CODE: {lobby.code} {lobby.redPresent && '(P1)'} {lobby.bluePresent && '(P2)'}
                </div>
              )}
            </div>
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER LOBBY CODE"
                  value={lobbyJoinCode}
                  onChange={(e) => setLobbyJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 px-3 py-2 pixel-panel text-pixel-white text-center"
                />
                <button
                  className="pixel-button px-4"
                  disabled={lobbyJoinCode.length !== 6}
                  onClick={() => joinLobby(lobbyJoinCode)}
                >
                  JOIN
                </button>
              </div>
              <div className="mt-1 text-pixel-gray text-xs">Codes are 6 characters</div>
            </div>
          </div>
        </div>
        )}

        {/* Start Button */}
        <div className="text-center mb-8">
          <button
            className={`pixel-button px-8 py-4 text-lg ${canStart() ? 'selected' : ''}`}
            disabled={!canStart()}
            onClick={() => { if (canStart()) { startMatch(); } }}
          >
            {lobby.mode === 'solo' ? (canStart() ? 'START MATCH' : 'SELECT SONG & CHARACTER') : (canStart() ? (lobby.side === 'red' ? 'START MATCH' : 'WAIT FOR HOST') : 'BOTH PLAYERS MUST BE READY')}
          </button>
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center text-pixel-gray text-sm mt-8">
          <div>
            <div>UP DOWN NAVIGATE</div>
            <div>TAB SWITCH</div>
            {lobby.mode !== 'solo' && <div>SPACE READY</div>}
          </div>
          <div>
            <div>{lobby.mode === 'solo' ? 'ENTER START' : 'READY TO START'}</div>
            <div>ESC BACK</div>
          </div>
        </div>
        
        {/* Back Button */}
        <div className="absolute top-8 left-8">
          <button
            className="pixel-button"
           onClick={() => setScreen('MODE_SELECT')}
          >
            ← BACK
          </button>
        </div>
      </div>
    </div>
  );
};
