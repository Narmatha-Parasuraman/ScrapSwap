import { io } from 'socket.io-client';
import { SOCKET_URL } from './config.js';

let currentToken = null;

// `auth` as a function is re-invoked by socket.io-client on every connect
// AND every reconnect attempt, so a dropped connection automatically
// re-authenticates with whatever the current token is -- no separate
// "re-identify on reconnect" logic needed. Room membership is derived
// server-side from the verified token, never from anything the client claims.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: currentToken }),
});

export function setSocketToken(token) {
  currentToken = token;
}

// Without a listener, socket.io-client's manager treats an unhandled
// connect_error as an uncaught exception in some browsers -- a normal
// occurrence (stale token, brief network hiccup during reconnect) shouldn't
// crash the page.
socket.on('connect_error', (err) => {
  console.warn('[socket] connection error:', err.message);
});
