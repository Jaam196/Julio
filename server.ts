import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // We need to create an HTTP server to share between Express and WebSocket
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Store rooms: pairing code -> Room
  interface Room {
    code: string;
    serverSocket: WebSocket | null;
    clientSockets: Map<string, WebSocket>;
    clientMetadata: Map<string, { id: string; name: string }>;
  }
  const rooms = new Map<string, Room>();

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "server-ready" });
  });

  // WebSocket handling
  wss.on("connection", (socket) => {
    let currentRoomCode: string | null = null;
    let isServer = false;
    let clientId: string | null = null;

    socket.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "register_server") {
          // Generate unique 6-digit code
          let code = "";
          do {
            code = Math.floor(100000 + Math.random() * 900000).toString();
          } while (rooms.has(code));

          const newRoom: Room = {
            code,
            serverSocket: socket,
            clientSockets: new Map(),
            clientMetadata: new Map(),
          };
          rooms.set(code, newRoom);
          currentRoomCode = code;
          isServer = true;

          socket.send(JSON.stringify({ type: "server_registered", code }));
          console.log(`PC Server registered with pairing code: ${code}`);
        }

        else if (data.type === "register_client") {
          const { code, deviceId, deviceName } = data;
          const room = rooms.get(code);

          if (room) {
            // Check if server is still connected
            if (!room.serverSocket) {
              socket.send(JSON.stringify({ type: "pairing_failed", reason: "Servidor desconectado" }));
              return;
            }

            room.clientSockets.set(deviceId, socket);
            room.clientMetadata.set(deviceId, { id: deviceId, name: deviceName });
            currentRoomCode = code;
            isServer = false;
            clientId = deviceId;

            socket.send(JSON.stringify({ type: "pairing_success", code, deviceId }));
            
            // Notify server that a client is trying to join/has joined
            room.serverSocket.send(JSON.stringify({
              type: "client_joined",
              deviceId,
              deviceName,
            }));

            console.log(`Tablet client "${deviceName}" paired with room: ${code}`);
          } else {
            socket.send(JSON.stringify({ type: "pairing_failed", reason: "Código incorrecto o vencido" }));
          }
        }

        else if (data.type === "client_action") {
          if (currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room && room.serverSocket) {
              // Forward action to the PC Server
              room.serverSocket.send(JSON.stringify({
                type: "client_action",
                action: data.action,
                payload: data.payload,
                deviceId: clientId,
                deviceName: data.deviceName,
              }));
            }
          }
        }

        else if (data.type === "state_broadcast") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const payload = JSON.stringify({
                type: "sync_state",
                tickets: data.tickets,
                activeTicket: data.activeTicket,
                announcementCount: data.announcementCount,
                appConfig: data.appConfig,
                voiceSettings: data.voiceSettings,
                musicConfig: data.musicConfig,
              });
              
              // Send to all connected clients
              for (const clientSocket of room.clientSockets.values()) {
                if (clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(payload);
                }
              }
            }
          }
        }

        else if (data.type === "deauthorize_client") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const targetClient = room.clientSockets.get(data.deviceId);
              if (targetClient) {
                targetClient.send(JSON.stringify({ type: "deauthorized" }));
                targetClient.close();
                room.clientSockets.delete(data.deviceId);
                room.clientMetadata.delete(data.deviceId);
              }
            }
          }
        }

        else if (data.type === "rename_client") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const targetClient = room.clientSockets.get(data.deviceId);
              if (targetClient) {
                targetClient.send(JSON.stringify({ type: "rename", name: data.name }));
                const meta = room.clientMetadata.get(data.deviceId);
                if (meta) {
                  meta.name = data.name;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    });

    socket.on("close", () => {
      if (currentRoomCode) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          if (isServer) {
            // Server disconnected, notify clients and clean up room
            for (const clientSocket of room.clientSockets.values()) {
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({ type: "server_disconnected" }));
              }
            }
            rooms.delete(currentRoomCode);
            console.log(`PC Server room ${currentRoomCode} closed due to server disconnect.`);
          } else if (clientId) {
            room.clientSockets.delete(clientId);
            room.clientMetadata.delete(clientId);
            if (room.serverSocket && room.serverSocket.readyState === WebSocket.OPEN) {
              room.serverSocket.send(JSON.stringify({ type: "client_left", deviceId: clientId }));
            }
            console.log(`Client tablet ${clientId} disconnected from room ${currentRoomCode}.`);
          }
        }
      }
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
