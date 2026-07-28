import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { exec } from "child_process";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

let ytApiKeyCache: string | null = null;

function parseJsonBrackets(html: string, startIdx: number): string | null {
  let braceCount = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIdx; i < html.length; i++) {
    const char = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return html.substring(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

function extractJsonAfter(html: string, keyword: string): string | null {
  // Look for assignment like: window['ytInitialData'] = { ... or ytInitialData = { ...
  const regex = new RegExp(`(?:window\\s*\\[\\s*["']${keyword}["']\\s*\\]|${keyword})\\s*=\\s*\\{`);
  const match = html.match(regex);
  if (!match || match.index === undefined) {
    // Fallback if the regex fails to match
    const idx = html.indexOf(keyword);
    if (idx === -1) return null;
    const startIdx = html.indexOf('{', idx);
    if (startIdx === -1) return null;
    return parseJsonBrackets(html, startIdx);
  }
  
  const startIdx = match.index + match[0].length - 1;
  return parseJsonBrackets(html, startIdx);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure high limits for JSON and URL-encoded payloads to support video uploads
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // We need to create an HTTP server to share between Express and WebSocket
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Store rooms: pairing code -> Room
  interface Room {
    code: string;
    serverName?: string;
    serverSocket: WebSocket | null;
    clientSockets: Map<string, WebSocket>;
    clientMetadata: Map<string, { id: string; name: string; type: string }>;
    pendingSockets: Map<string, WebSocket>;
    media?: Map<string, { mimeType: string; data: Buffer }>;
    lastState?: any;
  }
  const rooms = new Map<string, Room>();

  // Media endpoints for direct high-speed streaming (bypasses heavy WebSocket frames)
  app.post("/api/media/:roomCode/:mediaKey", (req, res) => {
    const { roomCode, mediaKey } = req.params;
    const contentType = req.headers["content-type"] || "";

    const room = rooms.get(roomCode);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (!room.media) {
      room.media = new Map();
    }

    // Support JSON-based base64 (backward compatibility)
    if (contentType.includes("application/json")) {
      const { data } = req.body;
      if (!data || typeof data !== "string" || !data.startsWith("data:")) {
        return res.status(400).json({ error: "Invalid data format. Expected base64 data URI." });
      }

      try {
        const parts = data.split(",");
        const mimeString = parts[0].split(":")[1].split(";")[0];
        const base64Data = parts[1];
        const buffer = Buffer.from(base64Data, "base64");

        room.media.set(mediaKey, {
          mimeType: mimeString,
          data: buffer,
        });

        console.log(`[Media Server] Saved JSON-base64 '${mediaKey}' for room ${roomCode} (${mimeString}, ${buffer.length} bytes)`);
        return res.json({ success: true, size: buffer.length });
      } catch (err: any) {
        console.error("[Media Server] Error saving JSON media upload:", err);
        return res.status(500).json({ error: "Failed to save uploaded media file", details: err?.message || err });
      }
    }

    // Otherwise, parse raw binary data directly! (Extremely memory efficient, no base64 overhead)
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          return res.status(400).json({ error: "Empty request body" });
        }

        room.media!.set(mediaKey, {
          mimeType: contentType || "application/octet-stream",
          data: buffer,
        });

        console.log(`[Media Server] Saved RAW Binary '${mediaKey}' for room ${roomCode} (${contentType}, ${buffer.length} bytes)`);
        return res.json({ success: true, size: buffer.length });
      } catch (err: any) {
        console.error("[Media Server] Error reading raw binary stream:", err);
        return res.status(500).json({ error: "Failed to save raw binary media", details: err?.message || err });
      }
    });

    req.on("error", (err) => {
      console.error("[Media Server] Stream read error:", err);
      res.status(500).json({ error: "Stream read error", details: err?.message || err });
    });
  });

  // Helper to transcode video with maximum Samsung Tizen compatibility
  const transcodeVideo = (inputPath: string, outputPath: string, stage: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      let ffmpegCmd = "";
      
      if (stage === 0) {
        // Stage 0: Maximum compatibility profile (H.264 Main @ Level 4.0, AAC 48kHz stereo, faststart)
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 -movflags +faststart "${outputPath}"`;
      } else if (stage === 1) {
        // Stage 1: Extreme compatibility profile (H.264 Baseline @ Level 3.1, AAC 44.1kHz stereo, faststart)
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -c:a aac -ar 44100 -ac 2 -movflags +faststart "${outputPath}"`;
      } else if (stage === 2) {
        // Stage 2: Reduced Resolution (1280x720) & Bitrate (1200k), baseline level 3.0
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -b:v 1200k -maxrate 1200k -bufsize 2400k -c:a aac -ar 44100 -ac 2 -movflags +faststart "${outputPath}"`;
      } else {
        // Stage 3: Low Resolution (854x480) & Minimal Bitrate (600k) for slow TV chips
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w='min(854,iw)':h='min(480,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -b:v 600k -maxrate 600k -bufsize 1200k -c:a aac -ar 44100 -ac 2 -movflags +faststart "${outputPath}"`;
      }

      console.log(`[Transcoder] Running stage ${stage} command: ${ffmpegCmd}`);
      
      exec(ffmpegCmd, (error, stdout, stderr) => {
        if (error) {
          const errStr = (stderr || "").toString().toLowerCase();
          // If it fails on audio codecs/streams (e.g. video has no audio channel), fallback with no audio (-an)
          if (errStr.includes("audio") || errStr.includes("aac") || errStr.includes("sample rate") || errStr.includes("stream")) {
            console.warn("[Transcoder] Failed with audio settings. Retrying without audio track (-an)...");
            let retryCmd = "";
            if (stage === 0) {
              retryCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -an -movflags +faststart "${outputPath}"`;
            } else if (stage === 1) {
              retryCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -an -movflags +faststart "${outputPath}"`;
            } else if (stage === 2) {
              retryCmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -b:v 1200k -maxrate 1200k -bufsize 2400k -an -movflags +faststart "${outputPath}"`;
            } else {
              retryCmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w='min(854,iw)':h='min(480,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -b:v 600k -maxrate 600k -bufsize 1200k -an -movflags +faststart "${outputPath}"`;
            }

            console.log(`[Transcoder] Running fallback command: ${retryCmd}`);
            exec(retryCmd, (retryError, retryStdout, retryStderr) => {
              if (retryError) {
                reject(new Error(`Transcode fallback failed: ${retryStderr || retryError.message}`));
              } else {
                resolve();
              }
            });
          } else {
            reject(new Error(`Transcode failed: ${stderr || error.message}`));
          }
        } else {
          resolve();
        }
      });
    });
  };

  // Store active upload metadata or temporary folders
  const tempUploadsBase = path.join(process.cwd(), "temp_uploads");

  app.post("/api/upload-chunk/init", express.json(), async (req, res) => {
    try {
      const { fileName, fileSize, totalChunks } = req.body;
      if (!fileName || !fileSize || !totalChunks) {
        return res.status(400).json({ error: "Faltan parámetros obligatorios (fileName, fileSize, totalChunks)" });
      }

      const uploadId = crypto.randomBytes(16).toString("hex");
      const uploadDir = path.join(tempUploadsBase, uploadId);
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const metadata = { fileName, fileSize, totalChunks, createdAt: Date.now() };
      await fs.promises.writeFile(path.join(uploadDir, "metadata.json"), JSON.stringify(metadata, null, 2));

      console.log(`[Chunk Upload Init] Sesión iniciada: ${uploadId} para archivo: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${totalChunks} partes)`);
      res.json({ uploadId });
    } catch (err: any) {
      console.error("[Chunk Upload Init Error]:", err);
      res.status(500).json({ error: "Error al iniciar subida por partes", details: err.message });
    }
  });

  app.post("/api/upload-chunk/chunk", express.raw({ type: "*/*", limit: "15mb" }), async (req, res) => {
    try {
      const uploadId = req.query.uploadId as string;
      const chunkIndex = parseInt(req.query.chunkIndex as string, 10);

      if (!uploadId || isNaN(chunkIndex)) {
        return res.status(400).json({ error: "Faltan parámetros uploadId o chunkIndex" });
      }

      const uploadDir = path.join(tempUploadsBase, uploadId);
      if (!fs.existsSync(uploadDir)) {
        return res.status(404).json({ error: "Sesión de subida no encontrada o expirada" });
      }

      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: "Contenido de parte vacío" });
      }

      const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);
      await fs.promises.writeFile(chunkPath, buffer);

      console.log(`[Chunk Upload] Guardada parte ${chunkIndex} para sesión ${uploadId} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      res.json({ success: true, chunkIndex });
    } catch (err: any) {
      console.error("[Chunk Upload Error]:", err);
      res.status(500).json({ error: "Error al subir parte", details: err.message });
    }
  });

  app.post("/api/upload-chunk/complete", express.json(), async (req, res) => {
    const { uploadId, stage } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: "Falta parámetro uploadId" });
    }

    const uploadDir = path.join(tempUploadsBase, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: "Sesión de subida no encontrada" });
    }

    let inputPath = "";
    let outputPath = "";

    try {
      // Read metadata
      const metadataPath = path.join(uploadDir, "metadata.json");
      const metadataContent = await fs.promises.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);
      const totalChunks = metadata.totalChunks;

      console.log(`[Chunk Upload Complete] Ensamblando ${totalChunks} partes para sesión: ${uploadId}...`);

      // Concatenate all chunks
      const chunkBuffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Falta la parte ${i} para completar el ensamblado del vídeo.`);
        }
        const chunkBuffer = await fs.promises.readFile(chunkPath);
        chunkBuffers.push(chunkBuffer);
      }

      const fullBuffer = Buffer.concat(chunkBuffers);
      console.log(`[Chunk Upload Complete] Ensamblado completado con éxito. Tamaño total: ${(fullBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      let finalBuffer: Buffer;
      const transcodeStage = parseInt(stage !== undefined ? String(stage) : "0", 10);

      const id = crypto.randomBytes(8).toString("hex");
      inputPath = path.join(process.cwd(), `temp_input_${id}`);
      outputPath = path.join(process.cwd(), `temp_output_${id}.mp4`);

      // Write assembled original video buffer to temporary file
      await fs.promises.writeFile(inputPath, fullBuffer);

      if (transcodeStage === -1) {
        console.log("[Chunk Upload Complete] Stage is -1 (Original MP4). Applying loss-less container faststart optimization...");
        try {
          // Loss-less faststart container correction: copy audio/video codecs as-is, but put moov atom at the beginning
          await new Promise<void>((resolve, reject) => {
            const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart "${outputPath}"`;
            console.log(`[Chunk Upload Complete] Running faststart optimization: ${ffmpegCmd}`);
            exec(ffmpegCmd, (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
          finalBuffer = await fs.promises.readFile(outputPath);
          console.log(`[Chunk Upload Complete] Loss-less faststart container correction completed! Size: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        } catch (faststartErr: any) {
          console.warn("[Chunk Upload Complete] Faststart command failed or FFmpeg not found. Falling back to unoptimized raw copy.", faststartErr);
          finalBuffer = fullBuffer;
        }
      } else {
        // Run FFmpeg transcoding
        try {
          await transcodeVideo(inputPath, outputPath, transcodeStage);
          // Read transcoded file
          finalBuffer = await fs.promises.readFile(outputPath);
        } catch (transcodeErr: any) {
          console.error("[Chunk Upload Complete] FFmpeg conversion failed:", transcodeErr);
          throw new Error(`FFmpeg falló o no está instalado en el sistema. Detalles del sistema: ${transcodeErr.message || transcodeErr}`);
        }
      }

      // Generate unique filename to support multiple background videos
      const videoId = crypto.randomBytes(8).toString("hex");
      const fileName = `custom_bg_video_${videoId}.mp4`;

      // Save to public/
      const publicDir = path.join(process.cwd(), "public");
      await fs.promises.mkdir(publicDir, { recursive: true });
      const publicPath = path.join(publicDir, fileName);
      await fs.promises.writeFile(publicPath, finalBuffer);

      // Save to dist/ if dist directory exists
      const distDir = path.join(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        await fs.promises.mkdir(distDir, { recursive: true });
        const distPath = path.join(distDir, fileName);
        await fs.promises.writeFile(distPath, finalBuffer);
      }

      // Validate file write success
      if (!fs.existsSync(publicPath)) {
        throw new Error(`El archivo final no se guardó correctamente en la ruta: ${publicPath}`);
      }
      const stats = await fs.promises.stat(publicPath);
      if (stats.size === 0) {
        throw new Error("El archivo guardado final en el servidor tiene 0 bytes de tamaño.");
      }

      console.log(`[Chunk Upload Complete] Video ensamblado y publicado! Ruta: /${fileName}, Tamaño: ${stats.size} bytes`);

      // Cleanup session temp folder recursively
      await fs.promises.rm(uploadDir, { recursive: true, force: true }).catch(() => {});

      res.json({
        success: true,
        filePath: `/${fileName}`,
        size: stats.size
      });
    } catch (err: any) {
      console.error("[Chunk Upload Complete Error]:", err);
      res.status(500).json({
        error: "Error al ensamblar, transcodificar o guardar el vídeo",
        details: err?.message || String(err)
      });
    } finally {
      // Cleanup temp files
      if (inputPath && fs.existsSync(inputPath)) {
        fs.promises.unlink(inputPath).catch(() => {});
      }
      if (outputPath && fs.existsSync(outputPath)) {
        fs.promises.unlink(outputPath).catch(() => {});
      }
    }
  });

  app.post("/api/transcode-video", express.raw({ type: "*/*", limit: "150mb" }), async (req, res) => {
    const stage = parseInt(req.query.stage as string || "0", 10);
    let inputPath = "";
    let outputPath = "";
    try {
      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ 
          error: "Payload de archivo vacío o inválido", 
          details: "El cuerpo binario recibido en el servidor está vacío. Asegúrese de enviar los bytes del vídeo directamente." 
        });
      }

      let finalBuffer: Buffer;

      if (stage === -1) {
        console.log("[Transcoder API] Stage is -1, skipping transcoding and using raw input video.");
        finalBuffer = buffer;
      } else {
        const id = crypto.randomBytes(8).toString("hex");
        inputPath = path.join(process.cwd(), `temp_input_${id}`);
        outputPath = path.join(process.cwd(), `temp_output_${id}.mp4`);

        // Write original video buffer to temporary file
        await fs.promises.writeFile(inputPath, buffer);

        // Run FFmpeg transcoding
        try {
          await transcodeVideo(inputPath, outputPath, stage);
          // Read transcoded file
          finalBuffer = await fs.promises.readFile(outputPath);
        } catch (transcodeErr: any) {
          console.error("[Transcoder API] FFmpeg conversion failed:", transcodeErr);
          throw new Error(`FFmpeg falló o no está instalado en el sistema. Detalles del sistema: ${transcodeErr.message || transcodeErr}`);
        }
      }

      // Generate unique filename to support multiple background videos
      const videoId = crypto.randomBytes(8).toString("hex");
      const fileName = `custom_bg_video_${videoId}.mp4`;

      // Save to public/
      const publicDir = path.join(process.cwd(), "public");
      await fs.promises.mkdir(publicDir, { recursive: true });
      const publicPath = path.join(publicDir, fileName);
      await fs.promises.writeFile(publicPath, finalBuffer);

      // Save to dist/ if dist directory exists
      const distDir = path.join(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        await fs.promises.mkdir(distDir, { recursive: true });
        const distPath = path.join(distDir, fileName);
        await fs.promises.writeFile(distPath, finalBuffer);
      }

      // Validate file write success
      if (!fs.existsSync(publicPath)) {
        throw new Error(`El archivo no se guardó correctamente en la ruta: ${publicPath}`);
      }
      const stats = await fs.promises.stat(publicPath);
      if (stats.size === 0) {
        throw new Error("El archivo guardado en el servidor tiene 0 bytes de tamaño.");
      }

      console.log(`[Transcoder API] Custom video saved successfully! Path: /${fileName}, Size: ${stats.size} bytes`);

      // Return JSON response instead of raw binary, conforming to user requirement to copy/save to app resources,
      // verify saving, and treat it identically to the demo video (which is a static asset)
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        filePath: `/${fileName}`,
        size: stats.size
      }));
    } catch (err: any) {
      console.error("[Transcoder API] Error during transcoding/saving:", err);
      res.status(500).json({ 
        error: "Error al transcodificar o guardar el vídeo en el servidor", 
        details: err?.message || String(err)
      });
    } finally {
      // Cleanup temp files
      if (inputPath && fs.existsSync(inputPath)) {
        fs.promises.unlink(inputPath).catch(() => {});
      }
      if (outputPath && fs.existsSync(outputPath)) {
        fs.promises.unlink(outputPath).catch(() => {});
      }
    }
  });

  app.post("/api/media/re-transcode/:roomCode/:mediaKey", async (req, res) => {
    const { roomCode, mediaKey } = req.params;
    const stage = parseInt(req.body.stage || "1", 10);

    const room = rooms.get(roomCode);
    if (!room || !room.media) {
      return res.status(404).json({ error: "Room or media cache not found on server" });
    }

    const mediaItem = room.media.get(mediaKey);
    if (!mediaItem) {
      return res.status(404).json({ error: "Media item not found inside server room cache" });
    }

    let inputPath = "";
    let outputPath = "";
    try {
      console.log(`[Re-Transcoder] Request to re-transcode '${mediaKey}' for room '${roomCode}' with stage ${stage}...`);
      const id = crypto.randomBytes(8).toString("hex");
      inputPath = path.join(process.cwd(), `temp_re_input_${id}`);
      outputPath = path.join(process.cwd(), `temp_re_output_${id}.mp4`);

      // Write currently stored video buffer to temporary file
      await fs.promises.writeFile(inputPath, mediaItem.data);

      // Run FFmpeg transcoding with higher compatibility options
      await transcodeVideo(inputPath, outputPath, stage);

      // Read transcoded file
      const transcodedBuffer = await fs.promises.readFile(outputPath);

      // Update room media cache
      room.media.set(mediaKey, {
        mimeType: "video/mp4",
        data: transcodedBuffer,
      });

      console.log(`[Re-Transcoder] '${mediaKey}' updated to stage ${stage} (${transcodedBuffer.length} bytes)`);

      // Broadcast WebSocket notification to reload this media across all clients in the room
      const updatePayload = JSON.stringify({
        type: "media_updated",
        key: mediaKey,
        version: Date.now()
      });

      if (room.serverSocket && room.serverSocket.readyState === WebSocket.OPEN) {
        room.serverSocket.send(updatePayload);
      }
      for (const clientSocket of room.clientSockets.values()) {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(updatePayload);
        }
      }

      return res.json({ success: true, size: transcodedBuffer.length });
    } catch (err: any) {
      console.error("[Re-Transcoder API] Error during re-transcoding:", err);
      return res.status(500).json({ error: "Failed to re-transcode video", details: err?.message || err });
    } finally {
      // Cleanup temp files
      if (inputPath && fs.existsSync(inputPath)) {
        fs.promises.unlink(inputPath).catch(() => {});
      }
      if (outputPath && fs.existsSync(outputPath)) {
        fs.promises.unlink(outputPath).catch(() => {});
      }
    }
  });

  app.get("/api/media/:roomCode/:mediaKey", (req, res) => {
    const { roomCode, mediaKey } = req.params;
    
    // Add full CORS support headers for absolute compatibility with Tizen web wrappers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    const room = rooms.get(roomCode);
    if (!room || !room.media) {
      return res.status(404).send("Room or media cache not found on server");
    }

    const mediaItem = room.media.get(mediaKey);
    if (!mediaItem) {
      return res.status(404).send("Media item not found inside server room cache");
    }

    // Always enforce the correct video/mp4 mimetype for any video file key
    let contentType = mediaItem.mimeType;
    if (mediaKey.toLowerCase().includes("video") || contentType.includes("octet-stream")) {
      contentType = "video/mp4";
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : mediaItem.data.length - 1;
      const chunksize = (end - start) + 1;
      const file = mediaItem.data.slice(start, end + 1);

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${mediaItem.data.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      });
      res.end(file);
    } else {
      res.writeHead(200, {
        "Content-Length": mediaItem.data.length,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      });
      res.end(mediaItem.data);
    }
  });

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "server-ready" });
  });

  app.get("/api/rooms", (req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
      code: r.code,
      serverName: r.serverName || "PC Servidor Principal",
      clientsCount: r.clientSockets.size
    }));
    res.json({ rooms: list });
  });

  app.get("/api/youtube/search", async (req, res) => {
    const query = (req.query.query as string) || "";
    const continuation = (req.query.continuation as string) || "";

    if (!query && !continuation) {
      return res.json({ items: [], continuationToken: "" });
    }

    try {
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const fetchHeaders = {
        "User-Agent": userAgent,
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Cookie": "CONSENT=YES+cb.20210328-17-p0.es+F+803; SOCS=CAI;",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      };

      if (continuation) {
        let apiKey = ytApiKeyCache;
        if (!apiKey) {
          const initialUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query || "lofi")}&hl=es`;
          const initRes = await fetch(initialUrl, { headers: fetchHeaders });
          const initHtml = await initRes.text();
          const keyMatch = initHtml.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || initHtml.match(/"innertubeApiKey"\s*:\s*"([^"]+)"/);
          if (keyMatch) {
            apiKey = keyMatch[1];
            ytApiKeyCache = apiKey;
          }
        }

        const url = `https://www.youtube.com/youtubei/v1/search?key=${apiKey || ""}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": userAgent,
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20240101.01.00",
                hl: "es",
                gl: "ES"
              }
            },
            continuation: continuation
          })
        });

        const data = (await response.json()) as any;
        const items: any[] = [];
        let nextContinuationToken = "";

        // Recursive crawler for maximum resilience
        function findRenderers(obj: any) {
          if (!obj || typeof obj !== 'object') return;
          
          if (obj.videoRenderer) {
            const vr = obj.videoRenderer;
            const videoId = vr.videoId;
            if (videoId && !items.some(x => x.id === videoId)) {
              const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || "";
              const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || "";
              const channel = vr.longBylineText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "";
              const duration = vr.lengthText?.simpleText || "";
              items.push({
                id: videoId,
                type: 'video',
                title,
                thumbnail,
                channel,
                duration,
                url: `https://www.youtube.com/watch?v=${videoId}`
              });
            }
          }
          
          if (obj.playlistRenderer) {
            const pr = obj.playlistRenderer;
            const playlistId = pr.playlistId;
            if (playlistId && !items.some(x => x.id === playlistId)) {
              const title = pr.title?.runs?.[0]?.text || pr.title?.simpleText || "";
              const thumbnail = pr.thumbnails?.[0]?.thumbnails?.[0]?.url || pr.thumbnail?.thumbnails?.[0]?.url || "";
              const channel = pr.longBylineText?.runs?.[0]?.text || pr.shortBylineText?.runs?.[0]?.text || "";
              const duration = (pr.videoCountText?.runs?.[0]?.text || pr.videoCount || "Playlist") + " vídeos";
              items.push({
                id: playlistId,
                type: 'playlist',
                title,
                thumbnail,
                channel,
                duration,
                url: `https://www.youtube.com/playlist?list=${playlistId}`
              });
            }
          }

          for (const key of Object.keys(obj)) {
            findRenderers(obj[key]);
          }
        }

        function findContinuationToken(obj: any): string | null {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.continuationItemRenderer) {
            const token = obj.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
            if (token) return token;
          }
          for (const key of Object.keys(obj)) {
            const tok = findContinuationToken(obj[key]);
            if (tok) return tok;
          }
          return null;
        }

        findRenderers(data);
        nextContinuationToken = findContinuationToken(data) || "";

        return res.json({ items, continuationToken: nextContinuationToken });
      } else {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=es`;
        const searchRes = await fetch(searchUrl, { headers: fetchHeaders });
        const html = await searchRes.text();

        const keyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || html.match(/"innertubeApiKey"\s*:\s*"([^"]+)"/);
        if (keyMatch) {
          ytApiKeyCache = keyMatch[1];
        }

        const dataJson = extractJsonAfter(html, 'ytInitialData');
        if (!dataJson) {
          throw new Error("Could not extract ytInitialData from YouTube response");
        }

        const ytData = JSON.parse(dataJson);
        const items: any[] = [];
        let nextContinuationToken = "";

        // Recursive crawler for maximum resilience
        function findRenderers(obj: any) {
          if (!obj || typeof obj !== 'object') return;
          
          if (obj.videoRenderer) {
            const vr = obj.videoRenderer;
            const videoId = vr.videoId;
            if (videoId && !items.some(x => x.id === videoId)) {
              const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || "";
              const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || "";
              const channel = vr.longBylineText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "";
              const duration = vr.lengthText?.simpleText || "";
              items.push({
                id: videoId,
                type: 'video',
                title,
                thumbnail,
                channel,
                duration,
                url: `https://www.youtube.com/watch?v=${videoId}`
              });
            }
          }
          
          if (obj.playlistRenderer) {
            const pr = obj.playlistRenderer;
            const playlistId = pr.playlistId;
            if (playlistId && !items.some(x => x.id === playlistId)) {
              const title = pr.title?.runs?.[0]?.text || pr.title?.simpleText || "";
              const thumbnail = pr.thumbnails?.[0]?.thumbnails?.[0]?.url || pr.thumbnail?.thumbnails?.[0]?.url || "";
              const channel = pr.longBylineText?.runs?.[0]?.text || pr.shortBylineText?.runs?.[0]?.text || "";
              const duration = (pr.videoCountText?.runs?.[0]?.text || pr.videoCount || "Playlist") + " vídeos";
              items.push({
                id: playlistId,
                type: 'playlist',
                title,
                thumbnail,
                channel,
                duration,
                url: `https://www.youtube.com/playlist?list=${playlistId}`
              });
            }
          }

          for (const key of Object.keys(obj)) {
            findRenderers(obj[key]);
          }
        }

        function findContinuationToken(obj: any): string | null {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.continuationItemRenderer) {
            const token = obj.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
            if (token) return token;
          }
          for (const key of Object.keys(obj)) {
            const tok = findContinuationToken(obj[key]);
            if (tok) return tok;
          }
          return null;
        }

        findRenderers(ytData);
        nextContinuationToken = findContinuationToken(ytData) || "";

        return res.json({ items, continuationToken: nextContinuationToken });
      }
    } catch (error: any) {
      console.warn("YouTube search fallback triggered:", error?.message || error);
      const fallbackPresets = [
        { id: 'jfKfPfyJRdk', type: 'video', title: '☕ Lofi Girl - lofi hip hop radio - beats to relax/study to', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg', channel: 'Lofi Girl', duration: 'EN VIVO', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
        { id: 'Dx5_wdKkpBY', type: 'video', title: '🎷 Relaxing Jazz Music - Smooth Coffee Shop BGM', thumbnail: 'https://i.ytimg.com/vi/Dx5_wdKkpBY/hqdefault.jpg', channel: 'Cafe Music BGM', duration: 'EN VIVO', url: 'https://www.youtube.com/watch?v=Dx5_wdKkpBY' },
        { id: '5grNis6L_oI', type: 'video', title: '🏖️ Bossa Nova Jazz Music - Soft Lounge Restaurant', thumbnail: 'https://i.ytimg.com/vi/5grNis6L_oI/hqdefault.jpg', channel: 'Relaxing Bossa', duration: 'EN VIVO', url: 'https://www.youtube.com/watch?v=5grNis6L_oI' },
        { id: 'y7e-GC6oGIZ', type: 'video', title: '🎹 Piano Clásico y Relajante para Restaurantes', thumbnail: 'https://i.ytimg.com/vi/y7e-GC6oGIZ/hqdefault.jpg', channel: 'Relaxing Piano', duration: '3:00:00', url: 'https://www.youtube.com/watch?v=y7e-GC6oGIZ' },
        { id: 'vV77mrc3lP0', type: 'video', title: '🍔 Pop y Música Alegre Ambiental', thumbnail: 'https://i.ytimg.com/vi/vV77mrc3lP0/hqdefault.jpg', channel: 'Background Chill', duration: 'EN VIVO', url: 'https://www.youtube.com/watch?v=vV77mrc3lP0' },
        { id: '4xDzrJKXOOY', type: 'video', title: '🌌 Synthwave Chill & Chillwave Beats', thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg', channel: 'Lofi Records', duration: '2:45:00', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' }
      ];
      res.json({ items: fallbackPresets, continuationToken: "", fallback: true });
    }
  });

  // WebSocket handling
  wss.on("connection", (socket) => {
    let currentRoomCode: string | null = null;
    let isServer = false;
    let clientId: string | null = null;

    socket.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);

        // Keep-alive heartbeat handling
        if (data && data.type === "ping") {
          try {
            socket.send(JSON.stringify({ type: "pong" }));
          } catch (e) {}
          return;
        }

        if (data.type === "register_server") {
          // Check if a valid, unused 6-digit code is provided
          let code = data.code;
          const serverName = data.serverName || "PC Servidor Principal";
          if (!code || typeof code !== "string" || !/^\d{6}$/.test(code) || rooms.has(code)) {
            // Generate unique 6-digit code
            do {
              code = Math.floor(100000 + Math.random() * 900000).toString();
            } while (rooms.has(code));
          }

          const newRoom: Room = {
            code,
            serverName,
            serverSocket: socket,
            clientSockets: new Map(),
            clientMetadata: new Map(),
            pendingSockets: new Map(),
          };
          rooms.set(code, newRoom);
          currentRoomCode = code;
          isServer = true;

          socket.send(JSON.stringify({ type: "server_registered", code }));
          console.log(`PC Server registered with pairing code: ${code}, name: ${serverName}`);
        }

        else if (data.type === "register_client") {
          const { code, deviceId, deviceName, deviceType } = data;
          const room = rooms.get(code);

          if (room) {
            // Check if server is still connected
            if (!room.serverSocket) {
              socket.send(JSON.stringify({ type: "pairing_failed", reason: "Servidor desconectado" }));
              socket.close();
              return;
            }

            // Put in pendingSockets list for manual authorization on Server
            room.pendingSockets.set(deviceId, socket);
            currentRoomCode = code;
            isServer = false;
            clientId = deviceId;

            // Notify server that a client is requesting authorization
            room.serverSocket.send(JSON.stringify({
              type: "client_connection_request",
              deviceId,
              deviceName,
              deviceType: deviceType || "Tablet",
            }));

            console.log(`Client "${deviceName}" requested connection to room: ${code}`);
          } else {
            socket.send(JSON.stringify({ type: "pairing_failed", reason: "Código incorrecto o vencido" }));
            socket.close();
          }
        }

        else if (data.type === "auth_decision") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const { deviceId, approved, remember, deviceName, deviceType } = data;
              const pendingSocket = room.pendingSockets.get(deviceId);
              
              if (pendingSocket) {
                room.pendingSockets.delete(deviceId);
                
                if (approved) {
                  // Approved! Move from pending to active clientSockets
                  room.clientSockets.set(deviceId, pendingSocket);
                  room.clientMetadata.set(deviceId, { id: deviceId, name: deviceName, type: deviceType || "Tablet" });
                  
                  pendingSocket.send(JSON.stringify({ 
                    type: "pairing_success", 
                    code: currentRoomCode, 
                    deviceId,
                    remember
                  }));

                  // Immediately send cached state if available so that the screen is populated instantly
                  if (room.lastState) {
                    pendingSocket.send(JSON.stringify(room.lastState));
                    console.log(`[Cache Sync] Sent cached state directly to reconnected client: ${deviceId}`);
                  }

                  // Also notify server with confirmed client_joined state
                  room.serverSocket.send(JSON.stringify({
                    type: "client_joined",
                    deviceId,
                    deviceName,
                    deviceType: deviceType || "Tablet",
                    remember
                  }));
                  
                  console.log(`Client "${deviceName}" connection approved for room ${currentRoomCode}`);
                } else {
                  // Rejected!
                  pendingSocket.send(JSON.stringify({ 
                    type: "pairing_failed", 
                    reason: "Conexión rechazada por el PC Servidor" 
                  }));
                  pendingSocket.close();
                  console.log(`Client "${deviceName}" connection rejected for room ${currentRoomCode}`);
                }
              }
            }
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

        else if (data.type === "send_to_client") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const targetClient = room.clientSockets.get(data.deviceId);
              if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                targetClient.send(JSON.stringify(data.payload));
              }
            }
          }
        }

        else if (data.type === "state_broadcast") {
          if (isServer && currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              const payloadObj = {
                type: "sync_state",
                tickets: data.tickets,
                activeTicket: data.activeTicket,
                announcementCount: data.announcementCount,
                appConfig: data.appConfig,
                voiceSettings: data.voiceSettings,
                musicConfig: data.musicConfig,
                isWaitlistPaused: data.isWaitlistPaused,
              };
              room.lastState = payloadObj;
              const payload = JSON.stringify(payloadObj);
              
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

  // High-performance custom streaming route for background MP4 files
  // Guarantees proper Content-Type: video/mp4, HTTP 206 Partial Content range request support,
  // and aggressive caching for smart TVs and browsers.
  app.get("/*.mp4", (req, res, next) => {
    const filename = req.path.split("/").pop() || "";
    const publicPath = path.join(process.cwd(), "public", filename);
    const distPath = path.join(process.cwd(), "dist", filename);

    let filePath = "";
    if (fs.existsSync(publicPath)) {
      filePath = publicPath;
    } else if (fs.existsSync(distPath)) {
      filePath = distPath;
    } else {
      // Fallback to next middleware if the MP4 is located elsewhere
      return next();
    }

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
          return res.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunksize,
          "Content-Type": "video/mp4"
        });

        fileStream.pipe(res);
        console.log(`[Streaming] Servido rango bytes ${start}-${end}/${fileSize} para ${filename} (HTTP 206)`);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4"
        });
        fs.createReadStream(filePath).pipe(res);
        console.log(`[Streaming] Servido archivo completo ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB) (HTTP 200)`);
      }
    } catch (err: any) {
      console.error("[Streaming Error] Error serving MP4 file:", err);
      if (!res.headersSent) {
        res.status(500).send("Internal server error serving video");
      }
    }
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
