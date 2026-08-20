import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/auth.js";
export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const socket = useMemo(
    () =>
      token
        ? io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
            auth: { token },
            autoConnect: true
          })
        : null,
    [token]
  );
  useEffect(() => () => socket?.disconnect(), [socket]);
  return socket;
}
