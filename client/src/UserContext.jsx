import { createContext, useContext, useState } from 'react';
import { socket, setSocketToken } from './socket.js';
import { setAuthToken } from './api.js';

const UserContext = createContext(null);

function syncExternalState(user) {
  if (user) {
    localStorage.setItem('scrapswap_user', JSON.stringify(user));
    setAuthToken(user.token);
    setSocketToken(user.token);
    socket.connect();
  } else {
    localStorage.removeItem('scrapswap_user');
    setAuthToken(null);
    setSocketToken(null);
    socket.disconnect();
  }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(() => {
    const stored = localStorage.getItem('scrapswap_user');
    const parsed = stored ? JSON.parse(stored) : null;
    // Runs once, synchronously, during the initial render -- before any
    // child component's mount effect can fire and call the API. Doing this
    // sync (rather than in a useEffect keyed on `user`) matters: effects
    // fire children-first, so a page component that fetches on mount would
    // otherwise race ahead of this provider's own effect and send its first
    // request with no Authorization header.
    syncExternalState(parsed);
    return parsed;
  });

  function setUser(next) {
    syncExternalState(next);
    setUserState(next);
  }

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
