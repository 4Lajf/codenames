// Simulates Socket.IO behavior for UI testing
// Emits events with delays to simulate network latency

export function createMockSocket() {
  const listeners = new Map<string, Function[]>();
  
  // We need to inject a way to handle mock events, but for now we'll just keep it simple
  // and let the stores/actions drive the socket
  
  const socket = {
    id: 'mock-socket-id',
    
    on(event: string, callback: Function) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(callback);
    },
    
    emit(event: string, data?: any) {
      // Simulate server response with delay
      setTimeout(() => {
        // In a real mock, we would switch on event and trigger response listeners
        // For this UI-first implementation, we'll expose a trigger method
        console.log(`[MockSocket] Emitted: ${event}`, data);
      }, 100 + Math.random() * 200);
    },
    
    off(event: string, callback?: Function) {
      if (callback) {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          const index = eventListeners.indexOf(callback);
          if (index > -1) eventListeners.splice(index, 1);
        }
      } else {
        listeners.delete(event);
      }
    },
    
    // Helper to trigger events (for testing/stores)
    _trigger(event: string, data: any) {
      listeners.get(event)?.forEach(cb => cb(data));
    }
  };

  return socket;
}

