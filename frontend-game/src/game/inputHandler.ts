export type InputAction = 'LANE_0' | 'LANE_1' | 'LANE_2' | 'LANE_3';

export interface InputEvent {
  player: 1 | 2;
  action: InputAction;
  timestamp: number;
  lane: 0 | 1 | 2 | 3;
  type: 'hit' | 'release';
}

export class InputHandler {
  private callbacks = new Map<string, (event: InputEvent) => void>();
  private keyStates = new Map<string, boolean>();
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }
  
  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key;
    
    // Prevent repeat events
    if (this.keyStates.get(key)) return;
    this.keyStates.set(key, true);
    
    const inputEvent = this.mapKeyToInput(key);
    if (inputEvent) {
      console.log('Input', { player: inputEvent.player, action: inputEvent.action });
      this.callbacks.forEach(callback => callback(inputEvent));
    }
  };
  
  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key;
    if (!this.keyStates.get(key)) return;
    this.keyStates.set(key, false);
    const laneMap: Record<string, number> = { v:0, c:1, x:2, z:3 };
    const lower = key.toLowerCase();
    if (laneMap[lower] !== undefined) {
      const timestamp = performance.now();
      const evt: InputEvent = {
        player: 1,
        action: `LANE_${laneMap[lower]}` as InputAction,
        timestamp,
        lane: laneMap[lower] as 0|1|2|3,
        type: 'release'
      };
      this.callbacks.forEach(cb => cb(evt));
    }
  };
  
  private mapKeyToInput(key: string): InputEvent | null {
    const timestamp = performance.now();
    
    switch (key.toLowerCase()) {
      case 'z':
        return { player: 1, action: 'LANE_0', timestamp, lane: 0, type: 'hit' };
      case 'x':
        return { player: 1, action: 'LANE_1', timestamp, lane: 1, type: 'hit' };
      case 'c':
        return { player: 1, action: 'LANE_2', timestamp, lane: 2, type: 'hit' };
      case 'v':
        return { player: 1, action: 'LANE_3', timestamp, lane: 3, type: 'hit' };
      
      // Player 2 controls
      default:
        return null;
    }
  }
  
  onInput(callback: (event: InputEvent) => void): () => void {
    const id = Math.random().toString(36);
    this.callbacks.set(id, callback);
    
    // Return cleanup function
    return () => {
      this.callbacks.delete(id);
    };
  }
  
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.callbacks.clear();
  }
}
