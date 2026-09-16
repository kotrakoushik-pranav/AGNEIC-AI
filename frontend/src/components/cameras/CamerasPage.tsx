import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Plus, Wifi, WifiOff, RefreshCw, Trash2,
  AlertCircle, CheckCircle, X, Smartphone,
  Copy, ExternalLink, Info,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  getCameras, createCamera, deleteCamera,
  connectCamera, disconnectCamera,
  testCameraConnection, getAllCameraHealth,
  ConnectPayload,
} from '../../services/cameraService';
import {
  createMobileSession, getMobileSession, cancelMobileSession,
  getServerInfo, listMobileSessions, getSessionForCamera, ServerInfo, MobileSession, SessionStatus,
} from '../../services/mobileService';
import { Camera as CameraType, CameraHealth } from '../../types';
import type { AxiosError } from 'axios';

// ── Error helper ──────────────────────────────────────────────────────────────

function friendlyError(e: unknown, context: string): string {
  // Use ApiError if available (from our typed interceptor)
  if (e && typeof e === 'object' && 'kind' in e) {
    const ae = e as { kind: string; message: string; detail: string | null; status: number };
    if (ae.kind === 'network_error' || ae.kind === 'timeout') {
      const base = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';
      return `Cannot reach backend at ${base}. Is the server running?`;
    }
    if (ae.kind === 'not_found') {
      return ae.detail ?? `${context}: not found — refresh and try again`;
    }
    if (ae.kind === 'bad_request') {
      return ae.detail ?? 'Bad request — check settings';
    }
    if (ae.kind === 'server_error') {
      return `Server error — check that the backend is running (${ae.status})`;
    }
    return ae.message || 'Unknown error';
  }
  // Fallback for raw AxiosError
  const axErr = e as AxiosError;
  const status = axErr?.response?.status;
  if (!status && !axErr?.response) {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';
    return `Cannot reach backend at ${base}. Is the server running?`;
  }
  if (status === 404) {
    return `${context}: not found — refresh and try again`;
  }
  if (status === 400) {
    const detail = (axErr?.response?.data as { detail?: string })?.detail;
    return detail ?? 'Bad request';
  }
  if (status && status >= 500) {
    return 'Server error — check that the backend is running';
  }
  return (e instanceof Error) ? e.message : 'Unknown error';
}

// ── Adapter groups ────────────────────────────────────────────────────────────

/** These types need a remote-device QR code flow (phone/second laptop). */
const REMOTE_WEBRTC_ADAPTERS = new Set(['mobile', 'webrtc', 'browser_client', 'phone', 'browser']);
/** These types are RTSP/HTTP — backend opens the stream, no browser camera. */
const RTSP_ADAPTERS = new Set(['rtsp', 'ip_camera', 'cctv', 'drone', 'http_mjpeg']);

const ADAPTER_LABELS: Record<string, string> = {
  mobile:         '📱 Mobile Phone (QR code)',
  browser_client: '💻 Second Laptop / Computer (link)',
  rtsp:           '📹 IP Camera / CCTV (RTSP)',
  ip_camera:      '📹 IP Camera (RTSP)',
  usb:            '🔌 USB Camera (server-side)',
  laptop_webcam:  '🖥️ Server Webcam (server-side)',
  drone:          '🚁 Drone (RTSP stream)',
};

// ── QR Session Panel ──────────────────────────────────────────────────────────

interface QRSessionPanelProps {
  camera: CameraType;
  onConnected: () => void;
  onCancel: () => void;
}

function QRSessionPanel({ camera, onConnected, onCancel }: QRSessionPanelProps) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('WAITING');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [lanOverride, setLanOverride] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store callbacks in refs so the useEffect never has them in its dependency array.
  // This prevents the QR from regenerating when the parent re-renders.
  const onConnectedRef = useRef(onConnected);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  // Derive the effective connect URL: use lanOverride if provided, else session.connect_url
  const effectiveUrl = lanOverride.trim() && session
    ? (() => {
        try {
          const u = new URL(session.connect_url);
          const override = lanOverride.trim().replace(/\/$/, '');
          return `${override}/mobile-camera?session=${u.searchParams.get('session') ?? session.session_id}`;
        } catch {
          return session.connect_url;
        }
      })()
    : connectUrl;

  // Regenerate QR when effectiveUrl changes
  useEffect(() => {
    if (!effectiveUrl) return;
    QRCode.toDataURL(effectiveUrl, {
      width: 220, margin: 2,
      color: { dark: '#e6edf3', light: '#0d1117' },
    }).then(setQrDataUrl).catch(() => {});
  }, [effectiveUrl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await getServerInfo();
        if (!cancelled) setServerInfo(info);
      } catch {
        if (!cancelled) setError('Cannot reach backend server — is it running?');
        return;
      }

      try {
        const sess = await createMobileSession({
          camera_id: camera.id,
          camera_name: camera.name,
          device_type: 'mobile',
        });
        if (cancelled) return;
        setSession(sess);
        setConnectUrl(sess.connect_url);

        // Poll session status until ONLINE
        pollRef.current = setInterval(async () => {
          if (cancelled) return;
          try {
            const updated = await getMobileSession(sess.session_id);
            setStatus(updated.status);
            if (updated.status === 'ONLINE') {
              clearInterval(pollRef.current!);
              onConnectedRef.current();
            }
          } catch { /* ignore transient errors */ }
        }, 2000);
      } catch (e: unknown) {
        if (!cancelled) {
          const axErr = e as AxiosError;
          const s = axErr?.response?.status;
          if (s === 404) {
            setError('Camera not found — register the camera first, then connect.');
          } else if (s === 400) {
            const detail = (axErr?.response?.data as { detail?: string })?.detail;
            setError(detail ?? 'Bad request — check camera settings.');
          } else if (s && s >= 500) {
            setError('Server error — make sure the backend is running.');
          } else {
            setError(friendlyError(e, 'Session'));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // Only re-run if camera.id or camera.name changes — NOT if onConnected changes.
  // onConnected is accessed via ref to prevent QR regeneration on parent re-renders.
  }, [camera.id, camera.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (session) {
      try { await cancelMobileSession(session.session_id); } catch { /* ignore */ }
    }
    onCancelRef.current();
  };

  const copyUrl = () => {
    const url = effectiveUrl ?? session?.connect_url;
    if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Detect if LAN IP looks like loopback (auto-detection failed)
  const lanIpIsLoopback = serverInfo?.lan_ip === '127.0.0.1' || serverInfo?.lan_ip === 'localhost';

  const statusColors: Record<string, string> = {
    WAITING:    'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
    CONNECTING: 'text-blue-400 bg-blue-900/20 border-blue-700/40',
    ONLINE:     'text-green-400 bg-green-900/20 border-green-700/40',
    OFFLINE:    'text-gray-500 bg-gray-900/20 border-gray-700/40',
    ERROR:      'text-red-400 bg-red-900/20 border-red-700/40',
  };

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-[#58a6ff]" />
          <h3 className="text-sm font-bold text-[#e6edf3]">Connect Mobile Camera</h3>
        </div>
        <button onClick={handleCancel} className="text-[#484f58] hover:text-[#e6edf3]">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-2 text-xs bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={12} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setError(null); /* re-trigger useEffect by updating a key isn't easy, so we just clear error to show spinner again and let user retry manually */ }}
              className="flex-1 py-1.5 text-[11px] font-semibold border border-red-700/50 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-1.5 text-[11px] font-semibold border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* LAN IP loopback warning */}
      {lanIpIsLoopback && (
        <div className="flex flex-col gap-2 text-xs bg-yellow-900/20 border border-yellow-700/40 text-yellow-400 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={12} />
            ⚠️ Server LAN IP could not be detected (got 127.0.0.1). Phone may not be able to connect. Make sure both devices are on the same Wi-Fi.
          </div>
          <button
            onClick={() => setShowOverride(v => !v)}
            className="text-[10px] underline text-yellow-300 self-start"
          >
            {showOverride ? 'Hide override' : 'Override LAN IP manually'}
          </button>
          {showOverride && (
            <input
              value={lanOverride}
              onChange={e => setLanOverride(e.target.value)}
              placeholder="http://192.168.1.X:8000"
              className="bg-[#0d1117] border border-yellow-700/50 rounded px-2 py-1.5 text-[11px] text-[#e6edf3] placeholder-[#484f58] font-mono focus:outline-none focus:border-yellow-500"
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="text-xs font-mono text-[#8b949e]">Status:</div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[status] ?? statusColors['WAITING']}`}>
          {status}
        </span>
        {status === 'WAITING' && (
          <span className="text-[10px] text-[#484f58]">Waiting for device to connect…</span>
        )}
      </div>

      {/* QR Code */}
      {qrDataUrl ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-[#8b949e] text-center">
            Scan with your phone to open the camera page:
          </p>
          <img src={qrDataUrl} alt="QR Code" className="rounded-xl border border-[#21262d]" />
          <p className="text-[10px] text-[#484f58] text-center max-w-xs break-all">
            {effectiveUrl}
          </p>
          <div className="flex gap-2 w-full">
            <button onClick={copyUrl}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs font-semibold rounded-lg transition-colors">
              <Copy size={12} />
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
            {effectiveUrl && (
              <a href={effectiveUrl} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#30363d] text-[#8b949e] hover:text-[#58a6ff] text-xs font-semibold rounded-lg transition-colors no-underline">
                <ExternalLink size={12} />
                Open Link
              </a>
            )}
          </div>
        </div>
      ) : !error ? (
        <div className="flex justify-center py-6">
          <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : null}

      {serverInfo && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2 text-[10px] flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-[#484f58]">Server LAN IP</span>
            <span className={`font-mono ${lanIpIsLoopback ? 'text-yellow-400' : 'text-[#58a6ff]'}`}>
              {serverInfo.lan_ip}:{serverInfo.port}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#484f58]">Protocol</span>
            <span className="text-[#8b949e] font-mono">{serverInfo.scheme.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Certificate warning — always show for HTTPS since it's self-signed */}
      {serverInfo?.scheme === 'https' && (
        <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg px-3 py-2 text-[10px] text-yellow-400 flex flex-col gap-1">
          <div className="font-bold">⚠️ Certificate Warning Expected</div>
          <div className="text-yellow-300/80 leading-relaxed">
            When your phone opens the link, the browser will show a security warning about the certificate.
            This is normal for local self-signed certs.
            <br/>
            Tap <strong>Advanced → Proceed to site</strong> (Chrome) or <strong>Show Details → visit this website</strong> (Safari).
            <br/>
            Then tap <strong>Start Camera</strong>.
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#484f58] text-center">
        📶 Phone and PC must be on the same Wi-Fi network.
        {serverInfo?.scheme === 'https'
          ? ' 🔒 HTTPS server is running on port 8443.'
          : ' ⚠️ Run start_https.ps1 for mobile camera support.'}
      </p>

      <button onClick={handleCancel}
        className="w-full py-2 border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs font-semibold rounded-lg transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ── RTSP/IP Camera Form ───────────────────────────────────────────────────────

interface RTSPFormProps {
  camera: CameraType;
  adapterType: string;
  onConnected: () => void;
  onCancel: () => void;
}

function RTSPForm({ camera, adapterType, onConnected, onCancel }: RTSPFormProps) {
  const isDrone = adapterType === 'drone';
  const [streamUrl, setStreamUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const placeholder = isDrone
    ? 'rtsp://drone-ip:554/stream'
    : 'rtsp://user:pass@192.168.1.100:554/stream';

  const handleTest = async () => {
    if (!streamUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testCameraConnection(camera.id, { adapter_type: 'rtsp', stream_url: streamUrl });
      setTestResult({ ok: r.success, msg: r.message });
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: friendlyError(e, 'Connection test') });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!streamUrl.trim()) return;
    setConnecting(true);
    try {
      await connectCamera(camera.id, { adapter_type: 'rtsp', stream_url: streamUrl });
      onConnected();
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: friendlyError(e, 'Connect') });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-[#21262d]">
      <div className="flex items-center gap-2 text-xs text-[#8b949e]">
        <Info size={11} />
        {isDrone
          ? '🚁 Drone — enter the RTSP stream URL from your ground station. Backend opens stream server-side.'
          : 'Backend opens RTSP stream server-side — no browser camera used.'}
      </div>
      <input
        value={streamUrl}
        onChange={e => setStreamUrl(e.target.value)}
        placeholder={placeholder}
        className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-[11px] text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] font-mono"
      />
      {testResult && (
        <div className={`flex items-center gap-1.5 text-[11px] rounded px-2 py-1 ${testResult.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
          {testResult.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
          {testResult.msg}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-[11px] font-semibold border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={handleTest} disabled={!streamUrl.trim() || testing}
          className="flex-1 py-1.5 text-[11px] font-semibold border border-[#58a6ff]/40 text-[#58a6ff] hover:bg-[#58a6ff]/10 rounded-lg disabled:opacity-40 transition-colors">
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button onClick={handleConnect} disabled={!streamUrl.trim() || connecting}
          className="flex-1 py-1.5 text-[11px] font-semibold bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg disabled:opacity-40 transition-colors">
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

// ── Add Camera Form ───────────────────────────────────────────────────────────

interface AddFormProps {
  onAdded: (camera: CameraType) => void;
  onClose: () => void;
}

function AddCameraForm({ onAdded, onClose }: AddFormProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) { setMsg({ ok: false, text: 'Camera name is required' }); return; }
    if (!location.trim()) { setMsg({ ok: false, text: 'Location is required' }); return; }
    setBusy(true);
    try {
      const cam = await createCamera({ name: name.trim(), location: location.trim() });
      setMsg({ ok: true, text: `Camera "${name}" registered` });
      setTimeout(() => { onAdded(cam); onClose(); }, 600);
    } catch (e: unknown) {
      setMsg({ ok: false, text: friendlyError(e, 'Register camera') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#e6edf3] flex items-center gap-2">
          <Plus size={15} className="text-[#58a6ff]" />
          Register Camera
        </h3>
        <button onClick={onClose} className="text-[#484f58] hover:text-[#e6edf3]"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e]">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="My Phone"
            className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e]">Location *</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Office Entrance"
            className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]" />
        </div>
      </div>

      <p className="text-[10px] text-[#8b949e] bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2">
        After registering, click <strong>Connect</strong> on the camera card to choose the source type and connect.
      </p>

      {msg && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-900/20 border border-green-700/40 text-green-400' : 'bg-red-900/20 border border-red-700/40 text-red-400'}`}>
          {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {msg.text}
        </div>
      )}

      <button onClick={handleAdd} disabled={busy}
        className="w-full py-2.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-sm font-bold rounded-lg">
        {busy ? 'Registering…' : 'Register Camera'}
      </button>
    </div>
  );
}

// ── Camera Card ───────────────────────────────────────────────────────────────

type FlowType = 'qr' | 'rtsp' | 'usb' | null;

interface CameraCardProps {
  camera: CameraType;
  health: CameraHealth | null;
  onRefresh: () => void;
  onDelete: (id: number) => void;
}

function CameraCard({ camera, health, onRefresh, onDelete }: CameraCardProps) {
  const [showFlow, setShowFlow] = useState<FlowType>(null);
  const [adapterType, setAdapterType] = useState('mobile');
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const status = health?.status ?? camera.status;
  const isOnline = status === 'ONLINE';
  const isConnecting = ['CONNECTING', 'RECONNECTING'].includes(status);

  const statusColors: Record<string, string> = {
    ONLINE:       'text-green-400 bg-green-900/20 border-green-700/50',
    CONNECTING:   'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
    RECONNECTING: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
    WAITING:      'text-blue-400 bg-blue-900/20 border-blue-700/50',
    ERROR:        'text-red-400 bg-red-900/20 border-red-700/50',
    OFFLINE:      'text-gray-500 bg-gray-900/20 border-gray-700/50',
  };
  const sc = statusColors[status] ?? statusColors['OFFLINE'];

  const handleConnectClick = () => {
    setConnectError(null);
    if (REMOTE_WEBRTC_ADAPTERS.has(adapterType)) {
      setShowFlow('qr');
    } else if (RTSP_ADAPTERS.has(adapterType)) {
      setShowFlow('rtsp');
    } else {
      // USB / laptop_webcam — connect directly
      setShowFlow('usb');
    }
  };

  const handleUSBConnect = async () => {
    try {
      const payload: ConnectPayload = { adapter_type: adapterType };
      await connectCamera(camera.id, payload);
      setShowFlow(null);
      onRefresh();
    } catch (e: unknown) {
      setConnectError(friendlyError(e, 'Connect'));
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Cancel any active mobile session for this camera
      const session = await getSessionForCamera(camera.id).catch(() => null);
      if (session) {
        await cancelMobileSession(session.session_id).catch(() => {});
      }
      await disconnectCamera(camera.id);
      onRefresh();
    } catch { /* ignore */ }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden flex flex-col">
      {/* Video placeholder area */}
      <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Camera size={28} className={isOnline ? 'text-green-400' : 'text-gray-600'} />
          <span className="text-[10px] text-gray-600 font-medium uppercase tracking-widest">
            {isOnline ? (health?.resolution && health.resolution !== 'unknown' ? health.resolution : 'ONLINE') : 'No Signal'}
          </span>
        </div>
        {/* Status badge */}
        <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc}`}>
          {status}
        </div>
        {/* AI badge */}
        {health?.ai_processing && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse" />
            <span className="text-[9px] text-[#58a6ff] font-bold">AI ACTIVE</span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Camera name + delete */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-[#e6edf3] text-sm">{camera.name}</div>
            <div className="text-[10px] text-[#484f58]">{camera.camera_code} · {camera.location}</div>
          </div>
          <button onClick={() => onDelete(camera.id)}
            className="text-[#484f58] hover:text-red-400 p-1 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>

        {/* Stats when online */}
        {health && isOnline && (
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-[#161b22] rounded px-2 py-1 text-center">
              <div className="text-[#484f58]">FPS</div>
              <div className="text-[#e6edf3] font-bold">{health.fps}</div>
            </div>
            <div className="bg-[#161b22] rounded px-2 py-1 text-center">
              <div className="text-[#484f58]">People</div>
              <div className="text-[#e6edf3] font-bold">{health.people_detected}</div>
            </div>
            <div className="bg-[#161b22] rounded px-2 py-1 text-center">
              <div className="text-[#484f58]">Frames</div>
              <div className="text-[#e6edf3] font-bold">{health.frame_count}</div>
            </div>
          </div>
        )}

        {/* Error reason */}
        {health?.error_reason && (
          <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/30 rounded px-2 py-1">
            {health.error_reason}
          </div>
        )}

        {/* Connect error */}
        {connectError && (
          <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/30 rounded px-2 py-1">
            {connectError}
          </div>
        )}

        {/* Adapter selector — only when offline and no flow open */}
        {!isOnline && !isConnecting && showFlow === null && (
          <select value={adapterType} onChange={e => setAdapterType(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-[11px] text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]">
            {Object.entries(ADAPTER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}

        {/* ── QR flow ── */}
        {showFlow === 'qr' && (
          <QRSessionPanel
            camera={camera}
            onConnected={() => { setShowFlow(null); onRefresh(); }}
            onCancel={() => setShowFlow(null)}
          />
        )}

        {/* ── RTSP flow ── */}
        {showFlow === 'rtsp' && (
          <RTSPForm
            camera={camera}
            adapterType={adapterType}
            onConnected={() => { setShowFlow(null); onRefresh(); }}
            onCancel={() => setShowFlow(null)}
          />
        )}

        {/* ── USB/server-side flow ── */}
        {showFlow === 'usb' && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#21262d]">
            <p className="text-[10px] text-[#8b949e]">
              {adapterType === 'laptop_webcam'
                ? '🖥️ Server webcam — the backend server will open the built-in webcam directly using OpenCV. No browser camera is used on your computer.'
                : '🔌 USB camera — the backend server will open the USB device directly. No browser camera is used.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowFlow(null)}
                className="flex-1 py-1.5 text-[11px] border border-[#30363d] text-[#8b949e] rounded-lg hover:text-[#e6edf3] transition-colors">
                Cancel
              </button>
              <button onClick={handleUSBConnect}
                className="flex-1 py-1.5 text-[11px] bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-colors">
                Connect {adapterType === 'laptop_webcam' ? 'Webcam' : 'USB'}
              </button>
            </div>
          </div>
        )}

        {/* ── Action buttons (no active flow) ── */}
        {showFlow === null && (
          <div className="flex gap-2">
            {!isOnline && !isConnecting ? (
              <button onClick={handleConnectClick}
                className="flex-1 py-1.5 text-[11px] font-semibold bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg flex items-center justify-center gap-1">
                <Wifi size={11} />
                Connect
              </button>
            ) : isOnline ? (
              <div className="flex gap-1.5">
                <button onClick={() => { setShowFlow('qr'); }}
                  className="flex-1 py-1.5 text-[11px] font-semibold border border-[#30363d] text-[#58a6ff] hover:border-[#58a6ff] rounded-lg flex items-center justify-center gap-1 transition-colors">
                  <RefreshCw size={11} />
                  Reconnect
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="flex-1 py-1.5 text-[11px] font-semibold border border-[#30363d] text-orange-400 hover:border-orange-400 rounded-lg flex items-center justify-center gap-1 disabled:opacity-40 transition-colors">
                  <WifiOff size={11} />
                  {disconnecting ? 'Stopping…' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="flex-1 py-1.5 text-[11px] text-center text-yellow-400 animate-pulse font-medium">
                {status}…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Debug / Diagnostics Panel ─────────────────────────────────────────────────

function DebugPanel() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [wsOk, setWsOk] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  // NOTE: No WebSocket opened here — the dashboard already has one via useDashboardData.
  // Opening a second one would cause duplicate event handling.
  // We test WS reachability with a one-shot probe that closes immediately.
  const wsProbeRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Check backend health via REST
    const checkHealth = async () => {
      try {
        const base = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';
        const r = await fetch(`${base}/api/health`);
        setBackendOk(r.ok);
      } catch { setBackendOk(false); }
    };

    getServerInfo()
      .then(i => { setInfo(i); setLoading(false); })
      .catch(() => setLoading(false));

    checkHealth();

    // One-shot WebSocket probe — connect, get onopen, then close immediately
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';
      const wsUrl = base.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);
      wsProbeRef.current = ws;
      ws.onopen = () => { setWsOk(true); ws.close(); };
      ws.onerror = () => { setWsOk(false); };
    } catch { setWsOk(false); }

    // Session + health poll (REST only, no WS)
    const t = setInterval(async () => {
      try {
        const data = await listMobileSessions();
        setSessions(data);
      } catch { /* ignore */ }
      checkHealth();
    }, 3000);

    return () => {
      clearInterval(t);
      if (wsProbeRef.current) {
        wsProbeRef.current.onopen = null;
        wsProbeRef.current.onerror = null;
        wsProbeRef.current.close();
        wsProbeRef.current = null;
      }
    };
  }, []);

  const copyMobileUrl = () => {
    if (info?.mobile_camera_url) {
      navigator.clipboard.writeText(info.mobile_camera_url).catch(() => {});
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#8b949e]">Connection Diagnostics</h3>

      {loading && <p className="text-[10px] text-[#484f58]">Loading…</p>}

      {/* Status indicators */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${backendOk === true ? 'bg-green-400' : backendOk === false ? 'bg-red-500' : 'bg-gray-600'}`} />
          <span className="text-[#484f58]">Backend:</span>
          <span className={backendOk === true ? 'text-green-400 font-bold' : backendOk === false ? 'text-red-400 font-bold' : 'text-gray-600'}>
            {backendOk === true ? 'ONLINE' : backendOk === false ? 'OFFLINE' : '…'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsOk ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-[#484f58]">WebSocket:</span>
          <span className={wsOk ? 'text-green-400 font-bold' : 'text-gray-500 font-bold'}>
            {wsOk ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Network info */}
      {info && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[#484f58]">LAN IP</span>
            <span className={`font-mono ${info.lan_ip === '127.0.0.1' ? 'text-yellow-400' : 'text-[#58a6ff]'}`}>{info.lan_ip}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[#484f58]">Port</span>
            <span className="text-[#8b949e] font-mono">{info.port}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[#484f58]">Protocol</span>
            <span className="text-[#8b949e] font-mono">{info.scheme.toUpperCase()}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[#484f58]">Mobile URL</span>
            <span className="text-[#8b949e] font-mono text-[9px] break-all">{info.mobile_camera_url}</span>
          </div>
        </div>
      )}

      {/* Copy URL button */}
      {info?.mobile_camera_url && (
        <button
          onClick={copyMobileUrl}
          className="flex items-center justify-center gap-1.5 py-1.5 border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-[11px] font-semibold rounded-lg transition-colors"
        >
          <Copy size={11} />
          {copiedUrl ? 'Copied!' : 'Copy Mobile Camera URL'}
        </button>
      )}

      {/* Active sessions */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-[#484f58]">Active Sessions ({sessions.length})</span>
        {sessions.length === 0 ? (
          <span className="text-[10px] text-[#484f58]">None</span>
        ) : (
          sessions.map((s) => (
            <div key={s.session_id}
              className="flex flex-col gap-0.5 text-[10px] bg-[#161b22] rounded px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[#58a6ff] font-mono">{s.session_id.slice(0, 8)}</span>
                <span className="text-[#8b949e]">{s.camera_name}</span>
                <span className="text-[#484f58]">·</span>
                <span className="text-[#8b949e]">{s.device_type}</span>
                <span className={`ml-auto font-bold ${s.status === 'ONLINE' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {s.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#484f58]">
                <span>Frames: {s.frames_received}</span>
                {s.device_ip && <span>IP: {s.device_ip}</span>}
                {s.connection_error && <span className="text-red-400 truncate">{s.connection_error}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CamerasPageProps {
  autoQuickMobile?: boolean;
  onAutoQuickMobileDone?: () => void;
}

export function CamerasPage({ autoQuickMobile, onAutoQuickMobileDone }: CamerasPageProps) {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [health, setHealth] = useState<Record<string, CameraHealth>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [quickConnectCamera, setQuickConnectCamera] = useState<CameraType | null>(null);
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggeredRef = useRef(false);

  const loadCameras = useCallback(async () => {
    try {
      const [cams, h] = await Promise.all([getCameras(), getAllCameraHealth()]);
      setCameras(cams);
      setHealth(h);
    } catch { /* backend unavailable */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCameras();
    healthPollRef.current = setInterval(async () => {
      try {
        const h = await getAllCameraHealth();
        setHealth(h);
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (healthPollRef.current) clearInterval(healthPollRef.current); };
  }, [loadCameras]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this camera?')) return;
    try {
      await deleteCamera(id);
      setCameras(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  }, []);

  // Auto-trigger quick mobile when navigated here from dashboard "Connect Mobile Camera"
  useEffect(() => {
    if (autoQuickMobile && !loading && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      // Reset the flag immediately so a re-navigation doesn't trigger again
      onAutoQuickMobileDone?.();
      handleQuickMobile();
    }
  // Only react to autoQuickMobile + loading changes, not handleQuickMobile identity
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuickMobile, loading]);

  const handleQuickMobile = async () => {
    setQuickError(null);
    setQuickConnecting(true);
    try {
      // Reuse the most-recent OFFLINE/WAITING camera created via Quick Connect
      // rather than always creating a new one. This prevents camera spam on
      // repeated clicks / page navigations.
      const existingQuick = cameras.find(c =>
        c.location === 'Quick Connect' && c.status === 'OFFLINE'
      );
      let cam: CameraType;
      if (existingQuick) {
        cam = existingQuick;
      } else {
        cam = await createCamera({
          name: `Mobile ${new Date().toLocaleTimeString()}`,
          location: 'Quick Connect',
        });
        setCameras(prev => [...prev, cam]);
      }
      setQuickConnectCamera(cam);
    } catch (e: unknown) {
      const msg = friendlyError(e, 'Quick Mobile');
      setQuickError(msg);
      console.error('Quick mobile error:', e);
    } finally {
      setQuickConnecting(false);
    }
  };

  const onlineCams = cameras.filter(c =>
    (health[String(c.id)]?.status ?? c.status) === 'ONLINE'
  ).length;

  return (
    <div className="p-6 flex flex-col gap-6 text-[#e6edf3]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/20 flex items-center justify-center">
          <Camera size={18} className="text-[#58a6ff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide">Camera Devices</h1>
          <p className="text-xs text-[#8b949e]">Multi-device camera management</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] px-3 py-1 rounded-full border border-[#30363d] text-[#8b949e]">
            {cameras.length} cameras
          </span>
          <span className={`text-[11px] px-3 py-1 rounded-full border font-semibold ${
            onlineCams > 0
              ? 'border-green-700/50 bg-green-900/20 text-green-400'
              : 'border-[#30363d] text-[#484f58]'
          }`}>
            {onlineCams} online
          </span>
          <button
            onClick={() => setShowDebug(v => !v)}
            className={`p-2 border rounded-lg transition-colors ${showDebug ? 'border-[#58a6ff]/40 text-[#58a6ff]' : 'border-[#21262d] text-[#484f58] hover:text-[#8b949e]'}`}
            title="Connection Diagnostics">
            <Info size={13} />
          </button>
          <button onClick={loadCameras}
            className="p-2 text-[#484f58] hover:text-[#8b949e] border border-[#21262d] rounded-lg transition-colors">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus size={13} />
            Add Camera
          </button>
          <button
            onClick={handleQuickMobile}
            disabled={quickConnecting}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1f6feb] hover:bg-[#388bfd] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            title="One-step: auto-registers a camera and opens QR code"
          >
            <Smartphone size={13} />
            {quickConnecting ? 'Creating…' : 'Quick Mobile'}
          </button>
        </div>
      </div>

      {/* Quick Mobile error banner */}
      {quickError && (
        <div className="flex items-center gap-2 text-xs bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          {quickError}
          <button onClick={() => setQuickError(null)} className="ml-auto text-[#484f58] hover:text-[#e6edf3]">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Diagnostics panel */}
      {showDebug && <DebugPanel />}

      {/* Add camera form */}
      {showAdd && (
        <AddCameraForm
          onAdded={cam => setCameras(prev => [...prev, cam])}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Quick Mobile overlay */}
      {quickConnectCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm">
            <QRSessionPanel
              camera={quickConnectCamera}
              onConnected={() => {
                setQuickConnectCamera(null);
                loadCameras();
              }}
              onCancel={async () => {
                try {
                  await deleteCamera(quickConnectCamera.id);
                  setCameras(prev => prev.filter(c => c.id !== quickConnectCamera.id));
                } catch { /* ignore */ }
                setQuickConnectCamera(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && cameras.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 bg-[#0d1117] border border-[#21262d] rounded-xl">
          <Camera size={48} className="text-[#484f58] opacity-40" />
          <div className="text-center">
            <p className="text-lg font-semibold text-[#8b949e]">No cameras connected</p>
            <p className="text-sm text-[#484f58] mt-1">
              Add a camera to begin surveillance.
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={14} />
            Add Camera
          </button>
        </div>
      )}

      {/* Camera grid */}
      {cameras.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map(cam => (
            <CameraCard
              key={cam.id}
              camera={cam}
              health={health[String(cam.id)] ?? null}
              onRefresh={loadCameras}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
