import { create } from 'zustand';

export interface Song {
  id: string;
  title: string;
  bpm: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface Player {
  characterId: string | null;
  ready: boolean;
}

export interface Lobby {
  mode: 'solo' | 'host' | 'join';
  code: string | null;
  connectedP2: boolean;
  p1Ready: boolean;
  p2Ready: boolean;
}

export interface Settings {
  volume: number;
  scanlines: boolean;
}

export interface Gameplay {
  started: boolean;
  paused: boolean;
  scoreP1: number;
  scoreP2: number;
  comboP1: number;
  comboP2: number;
  accuracyP1: number;
  accuracyP2: number;
  healthP1: number;
  healthP2: number;
  gameOver: boolean;
}

export interface GameState {
  currentScreen: 'TITLE' | 'MODE_SELECT' | 'SONG_SELECT' | 'GAME' | 'RESULTS' | 'HOW_TO_PLAY' | 'SETTINGS';
  song: Song | null;
  players: {
    p1: Player;
    p2: Player;
  };
  lobby: Lobby;
  settings: Settings;
  gameplay: Gameplay;
  
  // Actions
  setScreen: (screen: GameState['currentScreen']) => void;
  selectSong: (song: Song) => void;
  selectCharacter: (player: 1 | 2, characterId: string) => void;
  setMode: (mode: 'solo' | 'multiplayer') => void;
  hostLobby: () => void;
  joinLobby: (code: string) => void;
  toggleReady: (player: 1 | 2) => void;
  startMatch: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  updateGameplay: (gameplay: Partial<Gameplay>) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentScreen: 'TITLE',
  song: null,
  players: {
    p1: { characterId: null, ready: false },
    p2: { characterId: null, ready: false },
  },
  lobby: {
    mode: 'solo',
    code: null,
    connectedP2: false,
    p1Ready: false,
    p2Ready: false,
  },
  settings: {
    volume: 0.8,
  },
  gameplay: {
    started: false,
    paused: false,
    scoreP1: 0,
    scoreP2: 0,
    comboP1: 0,
    comboP2: 0,
    accuracyP1: 100,
    accuracyP2: 100,
    healthP1: 100,
    healthP2: 100,
    gameOver: false,
  },

  setScreen: (screen) => set({ currentScreen: screen }),
  
  selectSong: (song) => {
    console.log('SongSelected', { id: song.id, title: song.title, bpm: song.bpm, difficulty: song.difficulty });
    set({ song });
  },
  
  selectCharacter: (player, characterId) => {
    console.log('CharacterSelected', { player, characterId });
    set((state) => ({
      players: {
        ...state.players,
        [player === 1 ? 'p1' : 'p2']: {
          characterId,
          ready: true,
        },
      },
    }));
  },
  
  setMode: (mode) => {
    if (mode === 'multiplayer') {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('LobbyHosted', { code });
      set((state) => ({
        lobby: {
          ...state.lobby,
          mode: 'host',
          code,
          connectedP2: true, // Auto-simulate P2 joining
          p1Ready: false,
          p2Ready: false,
        },
      }));
      
      // Simulate P2 joining after a short delay
      setTimeout(() => {
        const characters = ['bear', 'man'];
        const randomChar = characters[Math.floor(Math.random() * characters.length)];
        get().selectCharacter(2, randomChar);
        console.log('LobbyReady');
      }, 1000);
    } else {
      set((state) => ({
        lobby: {
          ...state.lobby,
          mode: 'solo',
          code: null,
          connectedP2: false,
          p1Ready: false,
          p2Ready: false,
        },
      }));
    }
  },
  
  hostLobby: () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('LobbyHosted', { code });
    set((state) => ({
      lobby: {
        ...state.lobby,
        mode: 'host',
        code,
        p1Ready: false,
        p2Ready: false,
      },
    }));
  },
  
  joinLobby: (code) => {
    console.log('LobbyJoined', { code });
    set((state) => ({
      lobby: {
        ...state.lobby,
        mode: 'join',
        code,
        connectedP2: true,
        p1Ready: false,
        p2Ready: false,
      },
    }));
    
    // Simulate P2 joining with a random character
    setTimeout(() => {
      const characters = ['bear', 'man'];
      const randomChar = characters[Math.floor(Math.random() * characters.length)];
      get().selectCharacter(2, randomChar);
      console.log('LobbyReady');
    }, 1000);
  },
  
  toggleReady: (player) => {
    console.log('PlayerReady', { player, ready: !get().lobby[`p${player}Ready`] });
    set((state) => ({
      lobby: {
        ...state.lobby,
        [`p${player}Ready`]: !state.lobby[`p${player}Ready`],
      },
    }));
  },
  
  startMatch: () => {
    const { lobby } = get();
    const mode = lobby.connectedP2 ? 'versus' : 'solo';
    console.log('MatchStart', { mode });
    set((state) => ({
      currentScreen: 'GAME',
      gameplay: {
        ...state.gameplay,
        started: true,
      },
    }));
  },
  
  updateSettings: (newSettings) => 
    set((state) => {
      const updatedSettings = { ...state.settings, ...newSettings };
      // Persist volume to localStorage
      if (newSettings.volume !== undefined) {
        localStorage.setItem('save-the-bear-volume', newSettings.volume.toString());
      }
      return { settings: updatedSettings };
    }),
  
  updateGameplay: (newGameplay) =>
    set((state) => ({
      gameplay: { ...state.gameplay, ...newGameplay },
    })),
  
  resetGame: () => 
    set({
      currentScreen: 'TITLE',
      song: null,
      players: {
        p1: { characterId: null, ready: false },
        p2: { characterId: null, ready: false },
      },
      lobby: {
        mode: 'solo',
        code: null,
        connectedP2: false,
        p1Ready: false,
        p2Ready: false,
      },
      gameplay: {
        started: false,
        paused: false,
        scoreP1: 0,
        scoreP2: 0,
        comboP1: 0,
        comboP2: 0,
        accuracyP1: 100,
        accuracyP2: 100,
        healthP1: 100,
        healthP2: 100,
        gameOver: false,
      },
    }),
}));