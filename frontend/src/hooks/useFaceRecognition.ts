/**
 * useFaceRecognition — drives the entire real facial recognition pipeline.
 *
 * Responsibilities:
 *  - Browser webcam access (getUserMedia)
 *  - Live video rendering to <video> element
 *  - Frame capture at a controlled interval
 *  - Submitting frames to the backend for recognition
 *  - Receiving WebSocket recognition_event broadcasts
 *  - Maintaining derived state (faces, counts, events)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  submitFrame,
  startRecognition,
  stopRecognition,
  getRecognitionEvents,
  FaceResult,
  RecognitionEvent,
} from '../services/recognitionService';

// ── Types ────────────────────────────────────────────────────────────────────

export type CameraStatus =
  | 'no_camera'
  | 'connecting'
  | 'connected'
  | 'permission_denied'
  | 'camera_error'
  | 'disconnected';

export type RecognitionSessionStatus = 'inactive' | 'starting' | 'active' | 'stopping' | 'error';

export interface FaceRecognitionState {
  cameraStatus: CameraStatus;
  cameraError: string | null;
  recognitionStatus: RecognitionSessionStatus;
  recognitionError: string | null;
  facesDetected: number;
  recognizedCount: number;
  unknownCount: number;
  currentFaces: FaceResult[];
  events: RecognitionEvent[];
  fps: number;
  modelReady: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const CAMERA_ID = null;        // null = webcam session key
const CAMERA_NAME = 'Webcam';
const FRAME_INTERVAL_MS = 300; // submit a frame every 300 ms (~3 fps to backend)
const WS_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/ws';

export function useFaceRecognition(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const [state, setState] = useState<FaceRecognitionState>({
    cameraStatus: 'no_camera',
    cameraError: null,
    recognitionStatus: 'inactive',
    recognitionError: null,
    facesDetected: 0,
    recognizedCount: 0,
    unknownCount: 0,
    currentFaces: [],
    events: [],
    fps: 0,
    modelReady: false,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fpsCounterRef = useRef({ count: 0, last: Date.now() });
  const mountedRef = useRef(true);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setPartial = useCallback((patch: Partial<FaceRecognitionState>) => {
    if (mountedRef.current) setState(prev => ({ ...prev, ...patch }));
  }, []);

  /** Capture one frame from the video element as a base64 JPEG data-URI. */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return null;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, [videoRef, canvasRef]);

  // ── WebSocket (recognition events) ───────────────────────────────────────

  const connectWs = useCallback(() => {
    if (wsRef.current) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'recognition_event') {
            setState(prev => ({
              ...prev,
              events: [msg.data as RecognitionEvent, ...prev.events].slice(0, 200),
            }));
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => { wsRef.current = null; };
      ws.onclose = () => { wsRef.current = null; };
    } catch { /* WS unavailable — events will still appear on next poll */ }
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────

  const connectCamera = useCallback(async () => {
    setPartial({ cameraStatus: 'connecting', cameraError: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        setPartial({ cameraStatus: 'camera_error', cameraError: 'Video element not available' });
        return;
      }

      video.srcObject = stream;
      streamRef.current = stream;

      // Wait for actual frames to arrive before marking "connected"
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Camera timeout — no frames received')), 8000);
        video.oncanplay = () => { clearTimeout(timeout); resolve(); };
        video.onerror = () => { clearTimeout(timeout); reject(new Error('Video element error')); };
      });

      await video.play();

      // Monitor for camera going offline
      stream.getTracks().forEach(track => {
        track.onended = () => {
          if (mountedRef.current) {
            setPartial({ cameraStatus: 'disconnected', cameraError: 'Camera disconnected' });
            stopRecognitionSession();
          }
        };
      });

      setPartial({ cameraStatus: 'connected', cameraError: null });
      connectWs();

    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowed')) {
        setPartial({ cameraStatus: 'permission_denied', cameraError: 'Camera permission denied by browser' });
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setPartial({ cameraStatus: 'no_camera', cameraError: 'No camera found on this device' });
      } else {
        setPartial({ cameraStatus: 'camera_error', cameraError: msg });
      }
    }
  }, [videoRef, connectWs, setPartial]);

  const disconnectCamera = useCallback(() => {
    stopRecognitionSession();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPartial({
      cameraStatus: 'disconnected',
      cameraError: null,
      facesDetected: 0,
      recognizedCount: 0,
      unknownCount: 0,
      currentFaces: [],
    });
  }, [videoRef, setPartial]);

  // ── Recognition ───────────────────────────────────────────────────────────

  const startRecognitionSession = useCallback(async () => {
    setPartial({ recognitionStatus: 'starting', recognitionError: null });
    try {
      await startRecognition(CAMERA_ID, CAMERA_NAME);
      setPartial({ recognitionStatus: 'active' });

      // Start frame submission loop
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      fpsCounterRef.current = { count: 0, last: Date.now() };

      frameTimerRef.current = setInterval(async () => {
        // Abort if camera or recognition no longer active
        if (!streamRef.current) return;

        const frameB64 = captureFrame();
        if (!frameB64) return;

        try {
          const result = await submitFrame(CAMERA_ID, CAMERA_NAME, frameB64);

          // FPS counter
          const fpsc = fpsCounterRef.current;
          fpsc.count++;
          const now = Date.now();
          const elapsed = now - fpsc.last;
          if (elapsed >= 1000) {
            const fps = Math.round((fpsc.count * 1000) / elapsed);
            fpsc.count = 0;
            fpsc.last = now;
            setPartial({ fps });
          }

          if (result.active === false) return;

          setPartial({
            facesDetected: result.faces_detected,
            recognizedCount: result.recognized,
            unknownCount: result.unknown,
            currentFaces: result.faces ?? [],
          });
        } catch { /* network errors are transient */ }
      }, FRAME_INTERVAL_MS);

    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : 'Failed to start recognition';
      setPartial({ recognitionStatus: 'error', recognitionError: msg });
    }
  }, [captureFrame, setPartial]);

  // Defined separately (not inside startRecognitionSession) so disconnectCamera can call it
  function stopRecognitionSession() {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    stopRecognition(CAMERA_ID).catch(() => { /* best-effort */ });
    setState(prev => ({
      ...prev,
      recognitionStatus: 'inactive',
      facesDetected: 0,
      recognizedCount: 0,
      unknownCount: 0,
      currentFaces: [],
      fps: 0,
    }));
  }

  const stopRecognitionSessionCb = useCallback(() => {
    stopRecognitionSession();
  }, []); // eslint-disable-line

  // ── Initial event load + check model ──────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    // Load recent events
    getRecognitionEvents(50)
      .then(evts => setPartial({ events: evts }))
      .catch(() => { /* backend may not be up yet */ });

    // Check if model is ready
    import('../services/recognitionService').then(({ getRecognitionStatus }) => {
      getRecognitionStatus()
        .then(s => setPartial({ modelReady: s.model_ready }))
        .catch(() => { /* ignore */ });
    });

    return () => {
      mountedRef.current = false;
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // eslint-disable-line

  return {
    ...state,
    connectCamera,
    disconnectCamera,
    startRecognition: startRecognitionSession,
    stopRecognition: stopRecognitionSessionCb,
  };
}
