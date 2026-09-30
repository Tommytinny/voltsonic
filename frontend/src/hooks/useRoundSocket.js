const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";

function toWebSocketUrl(baseUrl) {
  if (!baseUrl) return "ws://127.0.0.1:8000/ws/rounds";
  if (baseUrl.startsWith("https://")) return baseUrl.replace(/^https:/, "wss:") + "/ws/rounds";
  if (baseUrl.startsWith("http://")) return baseUrl.replace(/^http:/, "ws:") + "/ws/rounds";
  return `${baseUrl.replace(/\/$/, "")}/ws/rounds`;
}

export function useRoundSocket() {
  const [roundState, setRoundState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = toWebSocketUrl(BACKEND_API_URL);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "round_update" && payload?.data) {
          setRoundState(payload.data);
        }
      } catch (error) {
        console.error("Failed to parse round socket message:", error);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onerror = () => {
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  return { roundState, connected };
}
