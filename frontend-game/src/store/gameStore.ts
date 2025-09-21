import { create } from 'zustand';
import { connectSpacetime, getConn, LobbyApi, subscribeLobby } from '../lib/spacetime';

let lobbyUnsub: (() => void) | null = null;

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
  // mode 'multiplayer' = user is on multiplayer menu but hasn't hosted or joined yet
  mode: 'solo' | 'multiplayer' | 'host' | 'join';
  code: string | null;
  connectedP2: boolean;
  p1Ready: boolean;
  p2Ready: boolean;
  redPresent?: boolean;
  bluePresent?: boolean;
  side?: 'red' | 'blue';
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
  gameOver: boolean;
  outcome?: 'bear_escaped' | 'man_caught' | null;
  // Synchronized bear vs man progress
  bearProgress: number;
  manProgress: number;
  synchronizedGameOver: boolean;
  synchronizedGameResult?: 'bear_escaped' | 'man_caught' | null;
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
  netConnected?: boolean;
  netError?: string | null;
  
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
  redPresent: false,
  bluePresent: false,
  side: undefined,
  },
  settings: {
  volume: 0.8,
  scanlines: false,
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
    gameOver: false,
    outcome: null,
    bearProgress: 10.0,
    manProgress: 0.0,
    synchronizedGameOver: false,
    synchronizedGameResult: null,
  },

  setScreen: (screen) => set({ currentScreen: screen }),
  
  selectSong: (song) => {
    console.log('SongSelected', { id: song.id, title: song.title, bpm: song.bpm, difficulty: song.difficulty });
    set({ song });
    // Persist to lobby if multiplayer
    const st = get();
    const conn = getConn();
    if (st.lobby.mode !== 'solo' && st.lobby.code && conn) {
      try { LobbyApi.setSong(conn, st.lobby.code, song.id); } catch (e) { console.warn('setSong failed', e); }
    }
  },
  
  selectCharacter: (player, characterId) => {
    console.log('CharacterSelected', { player, characterId });
    set((state) => ({
      players: {
        ...state.players,
        [player === 1 ? 'p1' : 'p2']: { characterId, ready: true },
      },
    }));
    // Persist if local side
    const st = get();
    const conn = getConn();
    const localPlayer = st.lobby.side === 'blue' ? 2 : 1;
    if (player === localPlayer) {
      console.log('[IdentityConfirm]', { action: 'selectCharacter', side: st.lobby.side, player: localPlayer, characterId, message: `Confirmed local player is P${localPlayer} (${st.lobby.side})` });
    }
    if (st.lobby.mode !== 'solo' && player === localPlayer && st.lobby.code && conn) {
      try { LobbyApi.setCharacter(conn, st.lobby.code, characterId); } catch (e) { console.warn('setCharacter failed', e); }
    }
  },
  
  setMode: (mode) => {
    if (mode === 'multiplayer') {
      // Enter neutral multiplayer menu state. Do NOT assign side until hostLobby/joinLobby.
      set((state) => ({ lobby: { ...state.lobby, mode: 'multiplayer', code: null, connectedP2: false, p1Ready: false, p2Ready: false, redPresent: false, bluePresent: false, side: undefined } }));
      // Pre-connect networking to reduce latency when hosting/joining, but no identity yet.
      if (!getConn()) {
        const saved = localStorage.getItem('auth_token') || undefined;
        void connectSpacetime(saved).then(({ connected, error }) => set({ netConnected: connected, netError: error ?? null }));
      } else {
        set({ netConnected: true, netError: null });
      }
    } else { // solo
      set((state) => ({
        lobby: { ...state.lobby, mode: 'solo', code: null, connectedP2: false, p1Ready: false, p2Ready: false, redPresent: false, bluePresent: false, side: undefined },
      }));
      lobbyUnsub?.(); lobbyUnsub = null;
    }
  },
  
  hostLobby: () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('LobbyHosted', { code });
    const conn = getConn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doCreate = (c: any) => { try { LobbyApi.create(c, code); } catch (e) { console.warn('Create reducer failed', e); } };
    if (conn && get().netConnected) {
      doCreate(conn);
      const s = get().song; if (s) { try { LobbyApi.setSong(conn, code, s.id); } catch (e) { console.warn('setSong (host immediate) failed', e); } }
    } else {
      const saved = localStorage.getItem('auth_token') || undefined;
      void connectSpacetime(saved).then((st) => { set({ netConnected: st.connected, netError: st.error }); if (st.conn && st.connected) { doCreate(st.conn); const s = get().song; if (s) { try { LobbyApi.setSong(st.conn, code, s.id); } catch (e) { console.warn('setSong (host connect) failed', e); } } } });
    }
  set((state) => ({ lobby: { ...state.lobby, mode: 'host', code, p1Ready: false, p2Ready: false, side: 'red' } }));
  console.log('[Identity]', { action: 'hostLobby', side: 'red', player: 1, message: 'You are Player 1 (red)' });
    const unsub = subscribeLobby(code, (rowRaw) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = rowRaw;
      set((state) => ({
  lobby: { ...state.lobby, connectedP2: !!row?.red && !!row?.blue, redPresent: !!row?.red, bluePresent: !!row?.blue, side: state.lobby.side, p1Ready: row?.redReady ?? state.lobby.p1Ready, p2Ready: row?.blueReady ?? state.lobby.p2Ready },
      }));
      if (row?.started && get().currentScreen !== 'GAME') { set({ currentScreen: 'GAME' }); }
      if (get().lobby.side === 'red' && row) {
  const localSongId = get().song?.id; const remoteSongId = row.songId ?? null;
        if (localSongId && !remoteSongId) { const c = getConn(); if (c && get().lobby.code) { try { LobbyApi.setSong(c, get().lobby.code!, localSongId); } catch (e) { console.warn('setSong (host sync) failed', e); } } }
      }
      if (row) {
        set((state) => ({
          players: {
            p1: { ...state.players.p1, characterId: state.lobby.side === 'blue' ? (row.redChar ?? state.players.p1.characterId) : state.players.p1.characterId, ready: state.players.p1.ready },
            p2: { ...state.players.p2, characterId: state.lobby.side !== 'blue' ? (row.blueChar ?? state.players.p2.characterId) : state.players.p2.characterId, ready: state.players.p2.ready },
          },
          gameplay: { 
            ...state.gameplay, 
            scoreP1: row.redScore ?? state.gameplay.scoreP1, 
            scoreP2: row.blueScore ?? state.gameplay.scoreP2,
            bearProgress: row.bearProgress ?? state.gameplay.bearProgress,
            manProgress: row.manProgress ?? state.gameplay.manProgress,
            synchronizedGameOver: row.gameOver ?? state.gameplay.synchronizedGameOver,
            synchronizedGameResult: row.gameResult as 'bear_escaped' | 'man_caught' | null ?? state.gameplay.synchronizedGameResult,
          },
        }));
      }
    });
    lobbyUnsub?.(); lobbyUnsub = unsub;
  },
  
  joinLobby: (code) => {
    console.log('LobbyJoined', { code });
    const conn = getConn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doJoin = (c: any) => { try { LobbyApi.join(c, code); } catch (e) { console.warn('Join reducer failed', e); } };
    if (conn && get().netConnected) { doJoin(conn); } else {
      const saved = localStorage.getItem('auth_token') || undefined;
      void connectSpacetime(saved).then((st) => { set({ netConnected: st.connected, netError: st.error }); if (st.conn && st.connected) doJoin(st.conn); });
    }
    set((state) => ({ lobby: { ...state.lobby, mode: 'join', code, connectedP2: false, p1Ready: false, p2Ready: false, side: 'blue' } }));
    console.log('[Identity]', { action: 'joinLobby', side: 'blue', player: 2, message: 'You are Player 2 (blue)' });
    const unsub = subscribeLobby(code, (rowRaw) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = rowRaw;
  set((state) => ({ lobby: { ...state.lobby, connectedP2: !!row?.red && !!row?.blue, redPresent: !!row?.red, bluePresent: !!row?.blue, side: state.lobby.side, p1Ready: row?.redReady ?? state.lobby.p1Ready, p2Ready: row?.blueReady ?? state.lobby.p2Ready } }));
      if (row?.started && get().currentScreen !== 'GAME') { set({ currentScreen: 'GAME' }); }
      if (row) {
        set((state) => ({
          players: {
            p1: { ...state.players.p1, characterId: state.lobby.side === 'blue' ? (row.redChar ?? state.players.p1.characterId) : state.players.p1.characterId, ready: state.players.p1.ready },
            p2: { ...state.players.p2, characterId: state.lobby.side !== 'blue' ? (row.blueChar ?? state.players.p2.characterId) : state.players.p2.characterId, ready: state.players.p2.ready },
          },
          gameplay: { 
            ...state.gameplay, 
            scoreP1: row.redScore ?? state.gameplay.scoreP1, 
            scoreP2: row.blueScore ?? state.gameplay.scoreP2,
            bearProgress: row.bearProgress ?? state.gameplay.bearProgress,
            manProgress: row.manProgress ?? state.gameplay.manProgress,
            synchronizedGameOver: row.gameOver ?? state.gameplay.synchronizedGameOver,
            synchronizedGameResult: row.gameResult as 'bear_escaped' | 'man_caught' | null ?? state.gameplay.synchronizedGameResult,
          },
        }));
      }
    });
    lobbyUnsub?.(); lobbyUnsub = unsub;
  },
  
  toggleReady: (player) => {
    const st = get();
    const desired = !st.lobby[`p${player}Ready` as const];
    console.log('PlayerReady', { player, ready: desired });
    set((state) => ({ lobby: { ...state.lobby, [`p${player}Ready`]: desired } as Lobby }));
    const conn = getConn();
    const side = get().lobby.side;
    const canChange = (player === 1 && side === 'red') || (player === 2 && side === 'blue');
    if (conn && canChange && st.lobby.code) {
      try { LobbyApi.setReady(conn, st.lobby.code, desired); } catch (e) { console.warn('setReady failed', e); }
    }
    const bothReady = get().lobby.p1Ready && get().lobby.p2Ready;
    if (bothReady && get().song) {
      const code = get().lobby.code; const conn2 = getConn();
      if (code && conn2) { try { LobbyApi.startMatch(conn2, code); } catch (e) { console.warn('startMatch reducer failed', e); } } else { get().startMatch(); }
    }
  },
  
  startMatch: () => {
    const { lobby } = get();
    const mode = lobby.connectedP2 ? 'versus' : 'solo';
    console.log('MatchStart', { mode });
    set((state) => ({ currentScreen: 'GAME', gameplay: { ...state.gameplay, started: true } }));
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
  
  resetGame: () => set({
    currentScreen: 'TITLE',
    song: null,
    players: { p1: { characterId: null, ready: false }, p2: { characterId: null, ready: false } },
    lobby: { mode: 'solo', code: null, connectedP2: false, p1Ready: false, p2Ready: false, redPresent: false, bluePresent: false, side: undefined },
    gameplay: { 
      started: false, 
      paused: false, 
      scoreP1: 0, 
      scoreP2: 0, 
      comboP1: 0, 
      comboP2: 0, 
      accuracyP1: 100, 
      accuracyP2: 100, 
      gameOver: false, 
      outcome: null,
      bearProgress: 10.0,
      manProgress: 0.0,
      synchronizedGameOver: false,
      synchronizedGameResult: null,
    },
  }),
}));
