import { io, type Socket } from 'socket.io-client';
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Socket connection store
export const socketConnected = writable(false);
export const socketError = writable<string | null>(null);

let socket: Socket | null = null;

/**
 * Get the Socket.IO server URL
 * In dev mode with Vite, connect to port 3000 where the socket server runs
 * In production, connect to same origin
 */
function getSocketUrl(): string | undefined {
  if (!browser) return undefined;
  
  // Check if we're on Vite dev server (port 5173)
  if (window.location.port === '5173') {
    return 'http://localhost:3000';
  }
  
  // Production or dev:server mode - same origin
  return undefined;
}

/**
 * Initialize socket connection with authentication
 */
export function initSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  const socketUrl = getSocketUrl();

  // Create socket connection
  socket = io(socketUrl || '', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    socketConnected.set(true);
    socketError.set(null);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    socketConnected.set(false);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
    socketError.set(error.message);
    socketConnected.set(false);
  });

  return socket;
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketConnected.set(false);
  }
}

/**
 * Emit event with callback promise wrapper
 */
export function emitWithAck<T>(event: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    socket.emit(event, data, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

