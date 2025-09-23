import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { TitleScreen } from './screens/TitleScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { SongSelectScreen } from './screens/SongSelectScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { HowToPlayScreen } from './screens/HowToPlayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import sound from '../../assets/botanicpanic.mp3';

function AppWithTest() {
  const { currentScreen } = useGameStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [musicStarted, setMusicStarted] = useState(false);
  const fadeTime = 1.0; // seconds

  useEffect(() => {
    const audio = new Audio(sound);
    audio.loop = true;
    audioRef.current = audio;

    // Setup Web Audio API for fading
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const track = audioContext.createMediaElementSource(audio);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1; // start at full volume
    track.connect(gainNode).connect(audioContext.destination);

    audioContextRef.current = audioContext;
    gainRef.current = gainNode;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioContext.close();
    };
  }, []);

  // Start music after user interaction
  const handleUserInteraction = () => {
    if (!musicStarted && audioRef.current && audioContextRef.current) {
      audioContextRef.current.resume().then(() => {
        audioRef.current!.play().catch(err => console.warn('Autoplay blocked:', err));
        setMusicStarted(true);
      });
    }
  };

  // Fade and pause/resume depending on current screen
  useEffect(() => {
    if (!gainRef.current || !audioRef.current || !musicStarted) return;

    const gain = gainRef.current;
    const audio = audioRef.current;
    const now = audioContextRef.current!.currentTime;

    gain.gain.cancelScheduledValues(now);

    if (currentScreen === 'GAME') {
      // Fade out to 0
      gain.gain.linearRampToValueAtTime(0, now + fadeTime);
      // Pause after fadeTime
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0; // optional: reset to start
      }, fadeTime * 1000);
    } else {
      // Resume audio if paused
      if (audio.paused) {
        audioContextRef.current!.resume().then(() => {
          audio.play().catch(() => {});
        });
      }
      // Fade in to full volume
      gain.gain.linearRampToValueAtTime(1, now + fadeTime);
    }
  }, [currentScreen, musicStarted]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'TITLE': return <TitleScreen />;
      case 'MODE_SELECT': return <ModeSelectScreen />;
      case 'SONG_SELECT': return <SongSelectScreen />;
      case 'GAME': return <GameScreen />;
      case 'RESULTS': return <ResultsScreen />;
      case 'HOW_TO_PLAY': return <HowToPlayScreen />;
      case 'SETTINGS': return <SettingsScreen />;
      default: return <TitleScreen />;
    }
  };

  return (
    <div onClick={handleUserInteraction} style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Screen-specific border overlay */}
      <img
        src={
          currentScreen === 'SONG_SELECT'
            ? '/images/bordersongselect.png'
            : currentScreen === 'GAME'
            ? '/images/bordergame.png'
            : currentScreen === 'MODE_SELECT'
            ? '/images/bordermodeselect.png'
            : currentScreen === 'HOW_TO_PLAY'
            ? '/images/bordersongselect.png'
            : '/images/outline.png'
        }
        alt="Screen Border"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />
      {renderScreen()}
    </div>
  );
}

export default AppWithTest;
