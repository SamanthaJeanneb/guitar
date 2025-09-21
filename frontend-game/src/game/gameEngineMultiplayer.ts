import * as THREE from 'three';

export interface Note {
  id: string;
  lane: 0 | 1 | 2 | 3;
  type: 'note';
  time: number;
  y: number;
  hit: boolean;
  glowIntensity: number;
  glowTime: number;
  holdDuration?: number;
  holdHeadHitTime?: number;
  releasedEarly?: boolean;
  track: 'guitar' | 'drum'; // Track type for dual-track system
}

export interface Judgment {
  type: 'Perfect' | 'Great' | 'Good' | 'Miss';
  score: number;
}

export class GameEngine {
  private notes: Note[] = [];
  private currentTime = 0;
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private audioElement: HTMLAudioElement | null = null;
  private startTime = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private running = false;
  
  private threeEnabled = true;
  private renderer: THREE.WebGLRenderer | null = null;
  private threeCanvas: HTMLCanvasElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private playfield: THREE.Group | null = null;
  private ringMeshes: THREE.Mesh[] = [];
  private ringGlowMeshes: THREE.Mesh[] = [];
  private drumRingMeshes: THREE.Mesh[] = [];
  private drumRingGlowMeshes: THREE.Mesh[] = [];
  private noteHaloMeshes = new Map<string, THREE.Mesh>();
  private noteTailMeshes = new Map<string, THREE.Mesh>();
  private ringGlow: number[] = [0, 0, 0, 0];
  private drumRingGlow: number[] = [0, 0];
  private ringBaseColors: number[] = [0x00ff00, 0xff0000, 0xffff00, 0x0066ff];
  private drumRingBaseColors: number[] = [0xff6600, 0x9900ff]; // Orange, Purple for drums (2 lanes)
  private noteHitGlow = new Map<string, number>();
  private noteGeometry: THREE.BufferGeometry | null = null;
  private noteMaterials: THREE.MeshStandardMaterial[] = [];
  private drumNoteMaterials: THREE.MeshStandardMaterial[] = [];
  private noteHaloMaterial: THREE.MeshBasicMaterial | null = null;
  private tailGeometry: THREE.BoxGeometry | null = null;
  private tailMaterials: THREE.MeshStandardMaterial[] = [];
  private noteMeshes = new Map<string, THREE.Mesh>();
  private readonly LANE_POSITIONS_3D = [8, 10, 12, 14]; // 4 guitar lanes on the right
  private readonly DRUM_LANE_POSITIONS_3D = [-5, -3]; // 2 drum lanes on the left with same spacing as guitar
  private readonly HIT_PLANE_Y = -5.0;
  private readonly Z_PER_MS = 0.02;
  private readonly RING_BASE_EMISSIVE = 0.25;
  // private readonly DRUM_TRACK_ANGLE = Math.PI / 12; // 15 degrees in radians for subtle visual separation
  
  private readonly NOTE_SPEED = 150;
  private readonly HIT_LINE_Y = 400;
  private readonly LANE_POSITIONS = [120, 200, 280, 360];
  private readonly NOTE_SIZE = 25;

  private readonly HIT_TARGET_SIZE = 30;
  private hitTargetGlow: number[] = [0, 0, 0, 0]; // Guitar track glow
  private hitTargetGlowTime: number[] = [0, 0, 0, 0]; // Guitar track glow time
  private drumHitTargetGlow: number[] = [0, 0]; // Drum track glow (2 lanes)
  private drumHitTargetGlowTime: number[] = [0, 0]; // Drum track glow time

  private bearProgress = 10.0;
  private manProgress = 0.0;
  private readonly MAN_CHASE_SPEED = 0.2;
  private readonly BEAR_HIT_BOOST = 2.0;
  private readonly BEAR_MISS_PENALTY = 0.5;
  private gameOver = false;
  private gameResult: 'bear_escaped' | 'man_caught' | null = null;

  private spacebarPressed = false;
  private spacebarBoostMultiplier = 1.0;

  private readonly PERFECT_WINDOW = 25;
  private readonly GREAT_WINDOW = 55;
  private readonly GOOD_WINDOW = 140;

  private totalNotes = 0;
  private perfectHits = 0;
  private greatHits = 0;
  private goodHits = 0;
  private missedHits = 0;
  private onNoteResult: ((result: { judgment: Judgment; note: Note; player: number; accuracy: number }) => void) | null = null;
  
  constructor(canvas: HTMLCanvasElement, audioContext: AudioContext, gainNode: GainNode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.audioContext = audioContext;
    this.gainNode = gainNode;
    this.setupSpacebarDetection();

    if (this.threeEnabled) {
      this.initThree();
    }
  }
  
  private setupSpacebarDetection() {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !this.spacebarPressed) {
        event.preventDefault();
        this.spacebarPressed = true;
        this.spacebarBoostMultiplier = 2.0;
        console.log('Spacebar pressed - Bear boost activated!');
      }
      
      // Handle drum track inputs (L and A keys)
      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        this.handleInput(0, 'hit', 1, 'drum');
      } else if (key === 'a') {
        event.preventDefault();
        this.handleInput(1, 'hit', 1, 'drum');
      }
    });
    
    document.addEventListener('keyup', (event) => {
      if (event.code === 'Space' && this.spacebarPressed) {
        event.preventDefault();
        this.spacebarPressed = false;
        this.spacebarBoostMultiplier = 1.0;
        console.log('Spacebar released - Bear boost deactivated!');
      }
    });
  }
  
  private async generateChartFromFile(songId: string, difficulty: 'expert' | 'hard' | 'normal' | 'easy' = 'expert') {
    try {
      const tryLoadChart = async (path: string) => {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      };

      const candidates = [
        `/songs/${songId}/chart.chart`,
        `/songs/${songId}/waves.chart`,
        `/songs/${songId}/notes.chart`,
      ];

      let text = '';
      for (const url of candidates) {
        try {
          text = await tryLoadChart(url);
          if (text && /\[Song\]/.test(text) && /\[SyncTrack\]/.test(text)) break;
        } catch {
          // try next
        }
      }

      if (!text || !/\[Song\]/.test(text) || !/\[SyncTrack\]/.test(text)) {
        console.warn('ChartValidationFailed', { songId, reason: 'Missing [Song] or [SyncTrack] section' });
        this.notes = [];
        this.totalNotes = 0;
        return;
      }

      const { parse, convertChartToMultiplayerNotes } = await import('../lib/chartParser');
      const chart = parse(text);
      const gameNotes = convertChartToMultiplayerNotes(chart, difficulty);

      this.notes = gameNotes.map(note => ({
        ...note,
        y: -this.NOTE_SIZE,
        glowIntensity: 0,
        glowTime: 0,
        track: note.track || 'guitar' // Use track from parser or default to guitar
      }));
      this.totalNotes = gameNotes.length;
      this.notes.sort((a, b) => a.time - b.time);
      
      // Create/update 3D meshes for notes
      if (this.threeEnabled) {
        this.syncThreeNoteMeshes();
      }
      
      console.log('ChartLoaded', { 
        songId, 
        difficulty, 
        totalNotes: this.totalNotes,
        firstNoteTime: this.notes[0]?.time || 0,
        lastNoteTime: this.notes[this.notes.length - 1]?.time || 0
      });
    } catch (err) {
      console.error('ChartLoadError', err);
      this.notes = [];
      this.totalNotes = 0;
    }
  }

  start(songId?: string) {
    // Ensure only one loop is running
    if (this.running) this.stop();
    this.running = true;
    
    // Reset chase mechanics
    this.bearProgress = 10.0;
    this.manProgress = 0.0;
    this.gameOver = false;
    this.gameResult = null;
    
    // Reset spacebar state
    this.spacebarPressed = false;
    this.spacebarBoostMultiplier = 1.0;
    
    if (songId) {
      // kick off chart load and audio
      this.generateChartFromFile(songId).catch(err => console.error('ChartLoadError', err));
      this.playMusic(songId);
    }
    this.startTime = performance.now();
    
    // Start game loop
    this.rafId = requestAnimationFrame(this.gameLoop);
  }
  
  private playMusic(songId: string) {
    this.audioElement = new Audio(`/songs/${songId}/song.ogg`);
    this.audioElement.volume = 1; // use gainNode for master volume control
    
    // Connect to Web Audio API
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const source = this.audioContext.createMediaElementSource(this.audioElement);
    source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    this.audioElement.play().then(() => {
      console.log('MusicPlay', { songId, t0: this.audioContext.currentTime });
    }).catch(err => {
      console.warn('Music playback failed:', err);
    });
    
    this.audioElement.addEventListener('ended', () => {
      console.log('MusicEnd', { songId });
    });
  }
  
  setNoteResultCallback(callback: (result: { judgment: Judgment; note: Note; player: number; accuracy: number }) => void) {
    this.onNoteResult = callback;
  }
  

  private gameLoop = () => {
    if (!this.running) return;
    this.update();
    this.render();
    this.rafId = requestAnimationFrame(this.gameLoop);
  };
  
  private update() {
    this.currentTime = performance.now() - this.startTime;
    
    // Update note positions (top to bottom)
    this.notes.forEach(note => {
      if (!note.hit) {
        const timeUntilHit = note.time - this.currentTime;
        note.y = this.HIT_LINE_Y - (timeUntilHit * this.NOTE_SPEED / 1000);
        
        // Mark as missed if too far past hit line and count it
        if (note.y > this.HIT_LINE_Y + 100 && !note.hit) {
          note.hit = true;
          this.missedHits++;
          const accuracy = this.calculateAccuracy();
          
          console.log('NoteMiss', { 
            player: 1, // Default to player 1 for auto-misses
            lane: note.lane, 
            deltaMs: Math.abs(note.y - this.HIT_LINE_Y) * 1000 / this.NOTE_SPEED
          });
          console.log('AccuracyUpdated', { 
            player: 1, 
            accuracy: accuracy 
          });
          
          if (this.onNoteResult) {
            this.onNoteResult({
              judgment: { type: 'Miss', score: 0 },
              note,
              player: 1,
              accuracy
            });
          }
        }
      }
    });
    
    // Update 3D note mesh positions and visibility
    if (this.threeEnabled && this.scene) {
      this.updateThreeNotes();
    }
    
     // Update hit target glow effects for guitar track
     for (let i = 0; i < 4; i++) {
       if (this.hitTargetGlowTime[i] > 0) {
         this.hitTargetGlowTime[i] -= 16; // Assuming 60fps
         this.hitTargetGlow[i] = Math.max(0, this.hitTargetGlowTime[i] / 300); // Fade over 300ms
       }
     }
     
     // Update hit target glow effects for drum track
     for (let i = 0; i < 2; i++) {
       if (this.drumHitTargetGlowTime[i] > 0) {
         this.drumHitTargetGlowTime[i] -= 16; // Assuming 60fps
         this.drumHitTargetGlow[i] = Math.max(0, this.drumHitTargetGlowTime[i] / 300); // Fade over 300ms
       }
     }
     
     // Update chase mechanics
     if (!this.gameOver) {
       // Man constantly chases at fixed speed
       this.manProgress += (this.MAN_CHASE_SPEED * 16) / 1000; // Convert to per-frame
       
       // Check win/lose conditions
       if (this.bearProgress >= 100) {
         this.gameOver = true;
         this.gameResult = 'bear_escaped';
         console.log('Bear escaped!');
       } else if (this.manProgress >= this.bearProgress) {
         this.gameOver = true;
         this.gameResult = 'man_caught';
         console.log('Man caught the bear!');
       }
     }
   }
  
  private render() {
    // Render 3D scene first (background)
    if (this.threeEnabled && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    // Clear 2D overlay canvas with transparent background to stack over 3D
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // If 3D enabled, skip 2D lane guides and hit line
    if (!this.threeEnabled) {
      // Draw all 4 lanes
      this.LANE_POSITIONS.forEach(x => this.drawLane(x));
      
      // Draw hit line (horizontal)
      this.ctx.strokeStyle = '#ff00ff';
      this.ctx.lineWidth = 4;
      this.ctx.shadowColor = '#ff00ff';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(80, this.HIT_LINE_Y);
      this.ctx.lineTo(400, this.HIT_LINE_Y);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
    
    // If 3D enabled, skip drawing 2D notes to avoid duplication
    if (!this.threeEnabled) {
      const now = this.currentTime;
      this.notes.forEach(note => {
        const sustainActive = !!(note.holdDuration && note.holdHeadHitTime !== undefined && !note.releasedEarly && now < (note.holdHeadHitTime + note.holdDuration));
        if ((!note.hit || sustainActive) && note.y > -this.NOTE_SIZE - 400 && note.y < this.canvas.height + this.NOTE_SIZE) {
          this.drawNote(note, sustainActive);
        }
      });
    }
    
    // 3D mode uses glowing ring meshes; skip 2D hit targets
    if (!this.threeEnabled) {
      this.drawHitTargets();
    }
    
    // Skip top lane labels
    
  // External UI now renders chase progress bar and accuracy info; removed internal draw to avoid duplication
   }
  
  private drawLane(x: number) {
    // Draw lane guide line
    this.ctx.strokeStyle = '#8a2be240';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(x, 50);
    this.ctx.lineTo(x, this.canvas.height - 50);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // --- Three.js helpers ---
  private initThree() {
    try {
      const parent = this.canvas.parentElement as HTMLElement | null;
      if (!parent) return;
      parent.style.position = parent.style.position || 'relative';
      
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(window.devicePixelRatio || 1);
      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0); // Transparent background
      const glCanvas = this.renderer.domElement;
      this.threeCanvas = glCanvas;
      glCanvas.style.position = 'absolute';
      glCanvas.style.left = '0';
      glCanvas.style.top = '0';
      glCanvas.style.zIndex = '0';
      // Ensure 2D canvas is above
      this.canvas.style.position = 'relative';
      this.canvas.style.zIndex = '1';
      // Insert behind 2D canvas
      parent.insertBefore(glCanvas, this.canvas);
      
      // Scene and camera
      this.scene = new THREE.Scene();
      this.scene.background = null; // Transparent background
      this.camera = new THREE.PerspectiveCamera(63, this.canvas.width / this.canvas.height, 0.1, 1000); // Zoom out 5% to fit both tracks in frame
      // Position camera to view both tracks - drums on left, guitar on right
      this.camera.position.set(4.5, 4.5, -10); // Center camera between leftmost (-5) and rightmost (14) tracks
      this.camera.lookAt(new THREE.Vector3(4.5, 0, 0)); // Look at true center point between all tracks

      // Playfield group angled slightly for a top view
      this.playfield = new THREE.Group();
      this.playfield.rotation.x = -Math.PI / 20; // more tilt (~30°) for stronger 3D
      this.scene.add(this.playfield);
      
      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(5, 10, 5);
      this.scene.add(ambient, dir);
      
      // Grid removed to keep only lane divider lines visible

      // Guitar track lane divider bars (straight)
      const guitarLaneXs: number[] = [0, 1, 2, 3].map(i => this.getLaneX(i as 0|1|2|3));
      const dividerGeo = new THREE.BoxGeometry(0.12, 0.05, 160);
      const guitarDividerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9b59ff, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.4 });
      const centerZ = 80;
      
      // Guitar track dividers (straight)
      for (let i = 0; i < guitarLaneXs.length - 1; i++) {
        const xMid = (guitarLaneXs[i] + guitarLaneXs[i + 1]) / 2;
        const bar = new THREE.Mesh(dividerGeo, guitarDividerMat);
        bar.position.set(xMid, this.HIT_PLANE_Y + 0.03, centerZ);
        this.playfield.add(bar);
      }
      // Guitar track outer boundary lines
      const guitarDx = guitarLaneXs[1] - guitarLaneXs[0];
      const guitarLeftEdge = new THREE.Mesh(dividerGeo, guitarDividerMat);
      guitarLeftEdge.position.set(guitarLaneXs[0] - guitarDx / 2, this.HIT_PLANE_Y + 0.03, centerZ);
      this.playfield.add(guitarLeftEdge);
      const guitarRightEdge = new THREE.Mesh(dividerGeo, guitarDividerMat);
      guitarRightEdge.position.set(guitarLaneXs[3] + guitarDx / 2, this.HIT_PLANE_Y + 0.03, centerZ);
      this.playfield.add(guitarRightEdge);
      
      // Drum track lane divider bars (pivoted 15 degrees) - 2 lanes
      const drumLaneXs: number[] = [0, 1].map(i => this.getDrumLaneX(i as 0|1));
      const drumDividerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff6600, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.4 });
      
      // Drum track dividers (pivoted) - only one divider between 2 lanes
      const xMid = (drumLaneXs[0] + drumLaneXs[1]) / 2;
      const bar = new THREE.Mesh(dividerGeo, drumDividerMat);
      bar.position.set(xMid, this.HIT_PLANE_Y + 0.03, centerZ);
      // bar.rotation.z = this.DRUM_TRACK_ANGLE; // Temporarily remove rotation to test positioning
      this.playfield.add(bar);
      
      // Drum track outer boundary lines (pivoted)
      const drumDx = drumLaneXs[1] - drumLaneXs[0];
      const drumLeftEdge = new THREE.Mesh(dividerGeo, drumDividerMat);
      drumLeftEdge.position.set(drumLaneXs[0] - drumDx / 2, this.HIT_PLANE_Y + 0.03, centerZ);
      // drumLeftEdge.rotation.z = this.DRUM_TRACK_ANGLE; // Temporarily remove rotation to test positioning
      this.playfield.add(drumLeftEdge);
      const drumRightEdge = new THREE.Mesh(dividerGeo, drumDividerMat);
      drumRightEdge.position.set(drumLaneXs[1] + drumDx / 2, this.HIT_PLANE_Y + 0.03, centerZ);
      // drumRightEdge.rotation.z = this.DRUM_TRACK_ANGLE; // Temporarily remove rotation to test positioning
      this.playfield.add(drumRightEdge);

      // Track and hit rings for guitar track (slightly smaller than note disk)
      const ringGeo = new THREE.TorusGeometry(0.7, 0.07, 16, 48);
      // Additive outer glow ring (larger tube and radius)
      const ringGlowGeo = new THREE.TorusGeometry(0.74, 0.18, 16, 48);
      const ringGlowMatBase = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const laneColors = [0x00ff00, 0xff0000, 0xffff00, 0x0066ff];
      
      // Create guitar track rings
      for (let i = 0 as 0|1|2|3; i < 4; i = (i + 1) as 0|1|2|3) {
        const x = this.getLaneX(i);
        const mat = new THREE.MeshStandardMaterial({ color: laneColors[i], emissive: laneColors[i], emissiveIntensity: this.RING_BASE_EMISSIVE, metalness: 0.0, roughness: 0.9 });
        const ring = new THREE.Mesh(ringGeo, mat);
        ring.position.set(x, this.HIT_PLANE_Y, 0);
        ring.rotation.x = Math.PI / 2;
        this.playfield!.add(ring);
        this.ringMeshes[i] = ring;

        const ringGlow = new THREE.Mesh(ringGlowGeo, ringGlowMatBase.clone());
        ringGlow.position.copy(ring.position);
        ringGlow.rotation.copy(ring.rotation);
        ringGlow.visible = false;
        this.playfield!.add(ringGlow);
        this.ringGlowMeshes[i] = ringGlow;
      }
      
      // Create drum track rings (pivoted 15 degrees) - 2 lanes
      for (let i = 0; i < 2; i++) {
        const x = this.getDrumLaneX(i as 0|1);
        const mat = new THREE.MeshStandardMaterial({ 
          color: this.drumRingBaseColors[i], 
          emissive: this.drumRingBaseColors[i], 
          emissiveIntensity: this.RING_BASE_EMISSIVE, 
          metalness: 0.0, 
          roughness: 0.9 
        });
        const ring = new THREE.Mesh(ringGeo, mat);
        ring.position.set(x, this.HIT_PLANE_Y, 0);
        ring.rotation.x = Math.PI / 2;
        // ring.rotation.z = this.DRUM_TRACK_ANGLE; // Temporarily remove rotation to test positioning
        this.playfield!.add(ring);
        this.drumRingMeshes[i] = ring;

        const ringGlow = new THREE.Mesh(ringGlowGeo, ringGlowMatBase.clone());
        ringGlow.position.copy(ring.position);
        ringGlow.rotation.copy(ring.rotation);
        ringGlow.visible = false;
        this.playfield!.add(ringGlow);
        this.drumRingGlowMeshes[i] = ringGlow;
      }
      ringGeo.dispose();
      ringGlowGeo.dispose();
      
      // Notes geometry (disk) and materials
      this.noteGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.18, 28);
      this.noteMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300, metalness: 0.1, roughness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000, metalness: 0.1, roughness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x333300, metalness: 0.1, roughness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x001133, metalness: 0.1, roughness: 0.4 }),
      ];
      
      // Drum note materials (different colors for drum track - 2 lanes)
      this.drumNoteMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x331100, metalness: 0.1, roughness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: 0x9900ff, emissive: 0x220033, metalness: 0.1, roughness: 0.4 }),
      ];

      this.noteHaloMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      // Tail geometry and materials (thicker base)
      this.tailGeometry = new THREE.BoxGeometry(0.25, 0.12, 1);
      this.tailMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x006600, transparent: true, opacity: 0.45, metalness: 0.05, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x660000, transparent: true, opacity: 0.45, metalness: 0.05, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x666600, transparent: true, opacity: 0.45, metalness: 0.05, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x003388, transparent: true, opacity: 0.45, metalness: 0.05, roughness: 0.8 }),
      ];

    } catch (e) {
      console.warn('ThreeInitFailed', e);
      this.threeEnabled = false;
    }
    // Animate guitar ring glow/scale feedback decay (ring turns white while glowing)
    for (let i = 0; i < this.ringMeshes.length; i++) {
      const ring = this.ringMeshes[i];
      if (!ring) continue;
      const mat = ring.material as THREE.MeshStandardMaterial;
      const g = this.ringGlow[i] || 0;
      if (g > 0.01) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = this.RING_BASE_EMISSIVE + g * 3.2;
      } else {
        mat.color.setHex(this.ringBaseColors[i]);
        mat.emissive.setHex(this.ringBaseColors[i]);
        mat.emissiveIntensity = this.RING_BASE_EMISSIVE;
      }
      const s = 1 + g * 0.45;
      ring.scale.set(s, s, s);
      // Outer additive glow ring
      const ringGlowMesh = this.ringGlowMeshes[i];
      if (ringGlowMesh) {
        const m = ringGlowMesh.material as THREE.MeshBasicMaterial;
        if (g > 0.01) {
          ringGlowMesh.visible = true;
          const pulse = 0.6 + 0.4 * Math.sin(this.currentTime / 70);
          m.opacity = Math.min(1, 0.25 + g * 0.55 * pulse);
          ringGlowMesh.scale.set(1 + g * 0.2, 1 + g * 0.2, 1 + g * 0.2);
        } else {
          ringGlowMesh.visible = false;
          m.opacity = 0;
        }
      }
      // slower decay so it lingers a bit longer
      this.ringGlow[i] = Math.max(0, g - 0.03);
    }
    
    // Animate drum ring glow/scale feedback decay
    for (let i = 0; i < this.drumRingMeshes.length; i++) {
      const ring = this.drumRingMeshes[i];
      if (!ring) continue;
      const mat = ring.material as THREE.MeshStandardMaterial;
      const g = this.drumRingGlow[i] || 0;
      if (g > 0.01) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = this.RING_BASE_EMISSIVE + g * 3.2;
      } else {
        mat.color.setHex(this.drumRingBaseColors[i]);
        mat.emissive.setHex(this.drumRingBaseColors[i]);
        mat.emissiveIntensity = this.RING_BASE_EMISSIVE;
      }
      const s = 1 + g * 0.45;
      ring.scale.set(s, s, s);
      // Outer additive glow ring
      const ringGlowMesh = this.drumRingGlowMeshes[i];
      if (ringGlowMesh) {
        const m = ringGlowMesh.material as THREE.MeshBasicMaterial;
        if (g > 0.01) {
          ringGlowMesh.visible = true;
          const pulse = 0.6 + 0.4 * Math.sin(this.currentTime / 70);
          m.opacity = Math.min(1, 0.25 + g * 0.55 * pulse);
          ringGlowMesh.scale.set(1 + g * 0.2, 1 + g * 0.2, 1 + g * 0.2);
        } else {
          ringGlowMesh.visible = false;
          m.opacity = 0;
        }
      }
      // slower decay so it lingers a bit longer
      this.drumRingGlow[i] = Math.max(0, g - 0.03);
    }
  }

  private timeToZ(noteTimeMs: number): number {
    // At noteTimeMs == currentTime -> z = 0 (hit plane)
    // Positive z means in front of the hit line; will move toward 0 over time
    return Math.max(-5, (noteTimeMs - this.currentTime) * this.Z_PER_MS);
  }

  private getLaneX(lane: 0|1|2|3): number {
    // Flip orientation so lane 0 (green) is leftmost and lane 3 (blue) rightmost
    const x = this.LANE_POSITIONS_3D[3 - lane];
    return x;
  }
  
  private getDrumLaneX(lane: 0|1): number {
    // Drum lanes positioned to the right of guitar lanes
    // Based on paint visualization: drum track should be clearly separated and angled
    const x = this.DRUM_LANE_POSITIONS_3D[lane]; // Direct positioning to the right
    return x;
  }

  private syncThreeNoteMeshes() {
    if (!this.scene || !this.noteGeometry || this.noteMaterials.length !== 4) return;
    // Remove existing meshes not in current notes
    const validIds = new Set(this.notes.map(n => n.id));
    for (const [id, mesh] of this.noteMeshes) {
      if (!validIds.has(id)) {
        this.scene.remove(mesh);
        (mesh.geometry as THREE.BufferGeometry).dispose();
        if (Array.isArray(mesh.material)) (mesh.material as THREE.Material[]).forEach((m: THREE.Material) => m.dispose());
        else (mesh.material as THREE.Material).dispose();
        this.noteMeshes.delete(id);
        const halo = this.noteHaloMeshes.get(id);
        if (halo) {
          this.scene.remove(halo);
          if (halo.geometry) (halo.geometry as THREE.BufferGeometry).dispose();
          this.noteHaloMeshes.delete(id);
        }
      }
    }
    // Create meshes for notes missing a mesh
    for (const n of this.notes) {
      if (this.noteMeshes.has(n.id)) continue;
      
      // Choose material based on track type
      const material = n.track === 'drum' 
        ? this.drumNoteMaterials[n.lane < 2 ? n.lane : (n.lane % 2)] 
        : this.noteMaterials[n.lane];
      
      const mesh = new THREE.Mesh(this.noteGeometry, material);
      
      // Position based on track type
      if (n.track === 'drum') {
        // For drum notes, lane should be 0 or 1, but we need to handle the case where it might be 0-3
        const drumLane = n.lane < 2 ? n.lane as 0|1 : (n.lane % 2) as 0|1;
        mesh.position.set(this.getDrumLaneX(drumLane), this.HIT_PLANE_Y, this.timeToZ(n.time));
        // mesh.rotation.z = this.DRUM_TRACK_ANGLE; // Temporarily remove rotation to test positioning
      } else {
        mesh.position.set(this.getLaneX(n.lane), this.HIT_PLANE_Y, this.timeToZ(n.time));
      }
      
      this.playfield!.add(mesh);
      this.noteMeshes.set(n.id, mesh);

      if (this.noteHaloMaterial) {
        const halo = new THREE.Mesh(this.noteGeometry, this.noteHaloMaterial);
        halo.position.copy(mesh.position);
        halo.rotation.copy(mesh.rotation);
        halo.scale.set(1.6, 1.6, 1.6);
        this.playfield!.add(halo);
        this.noteHaloMeshes.set(n.id, halo);
      }

      // Tail for sustain notes
      if (n.holdDuration && n.holdDuration > 0 && this.tailGeometry) {
        const tail = new THREE.Mesh(this.tailGeometry, this.tailMaterials[n.lane]);
        tail.position.copy(mesh.position);
        tail.rotation.copy(mesh.rotation);
        this.playfield!.add(tail);
        this.noteTailMeshes.set(n.id, tail);
      }
    }
    console.log('ThreeNotesCreated', { count: this.noteMeshes.size });
  }

  private updateThreeNotes() {
    // Update mesh positions and visibility based on timing and hit state
    for (const n of this.notes) {
      const mesh = this.noteMeshes.get(n.id);
      if (!mesh) continue;
      const z = this.timeToZ(n.time);
      mesh.position.z = z;
      const halo = this.noteHaloMeshes.get(n.id);
      if (halo) halo.position.z = z;
      const tail = this.noteTailMeshes.get(n.id);
      // Fade out when hit or long past
      const sustainActive = !!(n.holdDuration && n.holdHeadHitTime !== undefined && !n.releasedEarly && (this.currentTime < (n.holdHeadHitTime + n.holdDuration)));
      const shouldShow = !n.hit || sustainActive;
      mesh.visible = !!(shouldShow && z > -5 && z < 400);
      if (halo) halo.visible = this.spacebarPressed || (this.noteHitGlow.get(n.id) || 0) > 0;

      // Update sustain tail position/length/brightness
      if (tail && n.holdDuration && n.holdDuration > 0) {
        const durationZ = (n.holdDuration) * this.Z_PER_MS;
        const clampedLen = Math.max(0.001, durationZ);
        tail.visible = mesh.visible;
        tail.position.z = z + clampedLen / 2;
        const thicknessScale = sustainActive ? 2.0 : 1.2;
        tail.scale.set(thicknessScale, thicknessScale * 0.8, clampedLen);
        const tm = tail.material as THREE.MeshStandardMaterial;
        if (sustainActive) {
          tm.emissiveIntensity = 3.0;
          tm.opacity = 0.95;
        } else {
          tm.emissiveIntensity = 0.8;
          tm.opacity = 0.5;
        }
      }

      // Per-note spacebar glow
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (this.spacebarPressed) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0xffffff);
        const pulse = 0.5 + 0.5 * Math.sin(this.currentTime / 90);
        mat.emissiveIntensity = 2.2 + pulse * 1.0;
        if (halo && this.noteHaloMaterial) {
          const haloPulse = 0.5 + 0.5 * Math.sin(this.currentTime / 80);
          this.noteHaloMaterial.opacity = 0.4 * haloPulse + 0.2;
          const s = 1.3 + 0.15 * haloPulse;
          halo.scale.set(s, s, s);
        }
      } else {
        const laneIdx = n.lane;
        if (n.track === 'drum') {
          // Use drum colors (orange and purple) for drum notes
          const drumColors = [0xff6600, 0x9900ff]; // Orange, Purple
          const drumEmissive = [0x331100, 0x220033]; // Orange emissive, Purple emissive
          mat.color.setHex(drumColors[laneIdx]);
          mat.emissive.setHex(drumEmissive[laneIdx]);
        } else {
          // Use guitar colors for guitar notes
          const baseColors = [0x00ff00, 0xff0000, 0xffff00, 0x0066ff];
          mat.color.setHex(baseColors[laneIdx]);
          mat.emissive.setHex([0x003300, 0x330000, 0x333300, 0x001133][laneIdx]);
        }
        mat.emissiveIntensity = 0.6;
      }
      // Brief hit glow on the note itself
      const hitGlow = this.noteHitGlow.get(n.id) || 0;
      if (hitGlow > 0) {
        const glowPulse = 0.5 + 0.5 * Math.sin(this.currentTime / 60);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2.4 * hitGlow + 1.0 + glowPulse * 0.5);
        if (halo && this.noteHaloMaterial) {
          halo.visible = true;
          this.noteHaloMaterial.opacity = Math.max(this.noteHaloMaterial.opacity, 0.35 * hitGlow + 0.2);
          const s2 = 1.25 + 0.2 * hitGlow;
          halo.scale.set(s2, s2, s2);
        }
        this.noteHitGlow.set(n.id, Math.max(0, hitGlow - 0.05));
      }
    }
  }
  
  private drawNote(note: Note, sustainActive: boolean) {
    const x = this.LANE_POSITIONS[note.lane];
    
    // Retro arcade note colors based on lane
    const laneColors = [
      { primary: '#00ff00', secondary: '#44ff44', glow: '#00ff00' }, // Green
      { primary: '#ff0000', secondary: '#ff4444', glow: '#ff0000' }, // Red  
      { primary: '#ffff00', secondary: '#ffff44', glow: '#ffff00' }, // Yellow
      { primary: '#0066ff', secondary: '#4499ff', glow: '#0066ff' }  // Blue
    ];
    
    const colors = laneColors[note.lane];
    
    // If spacebar is pressed, make notes glow bright
    if (this.spacebarPressed) {
      // Intense glow effect for spacebar boost
      this.ctx.shadowColor = colors.glow;
      this.ctx.shadowBlur = 20;
      
      // Draw multiple glowing circles for bright effect
      for (let i = 0; i < 3; i++) {
        const alpha = 0.6 - i * 0.15;
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = colors.primary;
        this.ctx.beginPath();
        this.ctx.arc(x, note.y, this.NOTE_SIZE * (0.8 + i * 0.3), 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      // Reset shadow and alpha
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;
    }
    
    // Sustain tail (draw behind head)
    if (note.holdDuration && note.holdDuration > 0) {
      const pixelsPerMs = this.NOTE_SPEED / 1000;
      const tailLengthPx = note.holdDuration * pixelsPerMs;
      // Tail extends upward (earlier time) from head
      const tailTopY = note.y - tailLengthPx;
      // If actively held, brighten the tail
      if (sustainActive) {
        this.ctx.strokeStyle = colors.glow;
        this.ctx.lineWidth = 8;
        this.ctx.shadowColor = colors.glow;
        this.ctx.shadowBlur = 12;
      } else {
        this.ctx.strokeStyle = colors.secondary + '66';
        this.ctx.lineWidth = 6;
      }
      this.ctx.beginPath();
      this.ctx.moveTo(x, tailTopY);
      this.ctx.lineTo(x, note.y);
      this.ctx.stroke();
      this.ctx.lineWidth = 3;
      this.ctx.shadowBlur = 0;
    }

    // Main note head
    const headAlpha = sustainActive ? 1 : 1;
    this.ctx.globalAlpha = headAlpha;
    // Shining effect for active sustain hold
    if (sustainActive && note.holdHeadHitTime !== undefined) {
      const elapsed = this.currentTime - note.holdHeadHitTime;
      const progress = Math.max(0, Math.min(1, note.holdDuration ? elapsed / note.holdDuration : 0));
      const pulse = 0.5 + 0.5 * Math.sin(elapsed / 120); // fast pulsing
      // Outer pulsing glow rings
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const frac = i / ringCount;
        this.ctx.globalAlpha = (0.35 - frac * 0.1) * (0.6 + pulse * 0.4);
        this.ctx.fillStyle = colors.primary;
        this.ctx.shadowColor = colors.glow;
        this.ctx.shadowBlur = 15 + pulse * 10;
        this.ctx.beginPath();
        this.ctx.arc(x, note.y, this.NOTE_SIZE * (0.8 + frac * 0.9 + progress * 0.2), 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;
    }
    // Core note head (always)
    this.ctx.fillStyle = colors.primary;
    this.ctx.beginPath();
    this.ctx.arc(x, note.y, this.NOTE_SIZE * 0.8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = sustainActive ? '#ffffff' : colors.secondary;
    this.ctx.lineWidth = sustainActive ? 4 : 3;
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }
  
  private drawHitTargets() {
    const laneColors = [
      { primary: '#00ff00', secondary: '#44ff44', glow: '#00ff00' }, // Green
      { primary: '#ff0000', secondary: '#ff4444', glow: '#ff0000' }, // Red  
      { primary: '#ffff00', secondary: '#ffff44', glow: '#ffff00' }, // Yellow
      { primary: '#0066ff', secondary: '#4499ff', glow: '#0066ff' }  // Blue
    ];
    
    this.LANE_POSITIONS.forEach((x, lane) => {
      const colors = laneColors[lane];
      const glowIntensity = this.hitTargetGlow[lane];
      
      // Draw empty circle outline (Guitar Hero style)
      this.ctx.strokeStyle = colors.secondary;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(x, this.HIT_LINE_Y, this.HIT_TARGET_SIZE * 0.8, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // If glowing, fill with intense glow effect
      if (glowIntensity > 0) {
        // Intense glow effect
        this.ctx.shadowColor = colors.glow;
        this.ctx.shadowBlur = 15 + (glowIntensity * 25);
        // Draw multiple glowing circles
        for (let i = 0; i < 3; i++) {
          const alpha = glowIntensity * (0.4 - i * 0.1);
          this.ctx.globalAlpha = alpha;
          this.ctx.fillStyle = colors.primary;
          this.ctx.beginPath();
          this.ctx.arc(x, this.HIT_LINE_Y, this.HIT_TARGET_SIZE * (0.6 + i * 0.2), 0, Math.PI * 2);
          this.ctx.fill();
        }
        // Reset
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = colors.primary;
        this.ctx.beginPath();
        this.ctx.arc(x, this.HIT_LINE_Y, this.HIT_TARGET_SIZE * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  handleInput(lane: 0 | 1 | 2 | 3, _inputType: 'hit', player: number, track: 'guitar' | 'drum' = 'guitar'): { judgment: Judgment | null; note: Note | null; accuracy: number } {
    // Immediate visual feedback on key press: pulse ring
    if (track === 'guitar') {
      this.ringGlow[lane] = 1.0;
    } else {
      this.drumRingGlow[lane] = 1.0;
    }
    
    // Time-based detection at the 3D ring plane (z=0)
    const now = this.currentTime;
    const laneNotes = this.notes.filter(note => note.lane === lane && !note.hit && note.track === track);
    if (laneNotes.length === 0) {
      this.missedHits++;
      const accuracy = this.calculateAccuracy();
      this.bearProgress -= this.BEAR_MISS_PENALTY;
      this.bearProgress = Math.max(0, this.bearProgress);
      if (this.onNoteResult) {
        this.onNoteResult({ judgment: { type: 'Miss', score: 0 }, note: null as unknown as Note, player, accuracy });
      }
      return { judgment: { type: 'Miss', score: 0 }, note: null, accuracy };
    }

    // Find the closest by absolute time difference
    const closestNote = laneNotes.reduce((closest, note) => {
      const a = Math.abs((closest.time) - now);
      const b = Math.abs((note.time) - now);
      return b < a ? note : closest;
    });
    const deltaMs = Math.abs(closestNote.time - now);

    closestNote.hit = true;
    if (closestNote.holdDuration) {
      closestNote.holdHeadHitTime = this.currentTime;
    }
    
    // Determine judgment
    let judgment: Judgment;
    const baseScore = 100;
    const typeBonus = 1;
    if (deltaMs <= this.PERFECT_WINDOW) {
      judgment = { type: 'Perfect', score: Math.floor(baseScore * typeBonus) };
      this.perfectHits++;
      this.bearProgress += this.BEAR_HIT_BOOST * 1.5 * this.spacebarBoostMultiplier;
    } else if (deltaMs <= this.GREAT_WINDOW) {
      judgment = { type: 'Great', score: Math.floor(70 * typeBonus) };
      this.greatHits++;
      this.bearProgress += this.BEAR_HIT_BOOST * this.spacebarBoostMultiplier;
    } else if (deltaMs <= this.GOOD_WINDOW) {
      judgment = { type: 'Good', score: Math.floor(40 * typeBonus) };
      this.goodHits++;
      this.bearProgress += this.BEAR_HIT_BOOST * 0.7 * this.spacebarBoostMultiplier;
    } else {
      judgment = { type: 'Miss', score: 0 };
      this.missedHits++;
      console.log('NoteMiss', { player, lane, deltaMs });
    }

    // 3D note glow feedback only on successful hits
    if (judgment.type !== 'Miss') {
      this.noteHitGlow.set(closestNote.id, 1.0);
    }
    
    const accuracy = this.calculateAccuracy();
    console.log('AccuracyUpdated', { player, accuracy });
    
    if (this.onNoteResult) this.onNoteResult({ judgment, note: closestNote, player, accuracy });
    
    return { judgment, note: closestNote, accuracy };
  }
  
  private calculateAccuracy(): number {
    const processed = this.perfectHits + this.greatHits + this.goodHits + this.missedHits;
    if (processed === 0) return 100;
    
    // Calculate accuracy as percentage of perfect hits
    // Perfect = 100%, Great = 90%, Good = 75%, Miss = 0%
    const weightedScore = (this.perfectHits * 100) + (this.greatHits * 90) + (this.goodHits * 75) + (this.missedHits * 0);
    const maxPossibleScore = processed * 100;
    
    return Math.max(0, Math.min(100, (weightedScore / maxPossibleScore)));
  }
  
   getStats() {
     return {
       totalNotes: this.perfectHits + this.greatHits + this.goodHits + this.missedHits,
       perfectHits: this.perfectHits,
       greatHits: this.greatHits,
       goodHits: this.goodHits,
       missedHits: this.missedHits,
       accuracy: this.calculateAccuracy(),
       bearProgress: this.bearProgress,
       manProgress: this.manProgress,
       gameOver: this.gameOver,
       gameResult: this.gameResult,
       spacebarPressed: this.spacebarPressed,
       spacebarBoostMultiplier: this.spacebarBoostMultiplier
     };
   }
  
  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
      console.log('MusicPause', { currentTime: this.audioElement.currentTime });
    }
  }
  
  resume() {
    if (this.audioElement) {
      this.audioElement.play();
    }
  }

  stop() {
    // Stop RAF loop
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Stop and reset audio
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {
        console.warn('AudioStopError', e);
      }
    }
    // Dispose 3D resources
    if (this.threeEnabled) {
      this.disposeThree();
    }
  }
  
  getCurrentTime(): number {
    return this.currentTime;
  }
  
  getActiveNotes(): Note[] {
    return this.notes.filter(note => !note.hit && note.y > -50 && note.y < this.canvas.height + 50);
  }
  
  setVolume(volume: number) {
    this.gainNode.gain.value = volume;
  }
  
  // Method to add drum notes for testing
  addDrumNote(lane: 0 | 1, time: number, holdDuration?: number) {
    const note: Note = {
      id: `drum_${Date.now()}_${Math.random()}`,
      lane,
      type: 'note',
      time,
      y: -this.NOTE_SIZE,
      hit: false,
      glowIntensity: 0,
      glowTime: 0,
      track: 'drum',
      holdDuration
    };
    
    this.notes.push(note);
    this.notes.sort((a, b) => a.time - b.time);
    this.totalNotes++;
    
    // Create 3D mesh for the drum note
    if (this.threeEnabled) {
      this.syncThreeNoteMeshes();
    }
    
    return note;
  }

  handleRelease(lane: 0|1|2|3) {
    const now = this.currentTime;
    // Find active sustain in this lane (head already hit, sustain not finished)
    const active = this.notes.find(n => n.lane === lane && n.holdDuration && n.holdHeadHitTime !== undefined && !n.releasedEarly && now < (n.holdHeadHitTime + n.holdDuration));
    if (active) {
      active.releasedEarly = true;
      // Penalize as a miss for sustain tail
      this.missedHits++;
    }
  }

  private disposeThree() {
    try {
      // Remove note meshes
      for (const [, mesh] of this.noteMeshes) {
        this.scene?.remove(mesh);
      }
      this.noteMeshes.clear();
      for (const [, halo] of this.noteHaloMeshes) {
        this.scene?.remove(halo);
      }
      this.noteHaloMeshes.clear();
      for (const [, tail] of this.noteTailMeshes) {
        this.scene?.remove(tail);
      }
      this.noteTailMeshes.clear();
      
      // Dispose scene objects (geometries/materials)
      if (this.scene) {
        this.scene.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            const geometry = obj.geometry as THREE.BufferGeometry | undefined;
            const material = obj.material as THREE.Material | THREE.Material[] | undefined;
            if (geometry) geometry.dispose();
            if (material) {
              if (Array.isArray(material)) (material as THREE.Material[]).forEach((m: THREE.Material) => m.dispose());
              else material.dispose();
            }
          }
        });
      }

      // Dispose shared note resources
      this.noteMaterials.forEach(m => m.dispose());
      this.noteMaterials = [];
      this.drumNoteMaterials.forEach(m => m.dispose());
      this.drumNoteMaterials = [];
      if (this.noteGeometry) {
        this.noteGeometry.dispose();
        this.noteGeometry = null;
      }
      if (this.noteHaloMaterial) {
        this.noteHaloMaterial.dispose();
        this.noteHaloMaterial = null;
      }
      if (this.tailGeometry) {
        this.tailGeometry.dispose();
        this.tailGeometry = null;
      }
      this.tailMaterials.forEach(m => m.dispose());
      this.tailMaterials = [];

      // Dispose renderer
      if (this.renderer) {
        this.renderer.dispose();
      }

      // Remove WebGL canvas
      if (this.threeCanvas && this.threeCanvas.parentElement) {
        this.threeCanvas.parentElement.removeChild(this.threeCanvas);
      }

      // Null references
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.threeCanvas = null;
    } catch (e) {
      console.warn('ThreeDisposeFailed', e);
    }
  }
}
