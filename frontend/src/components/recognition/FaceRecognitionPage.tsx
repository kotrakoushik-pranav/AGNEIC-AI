import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Camera, UserCheck, AlertCircle, Wifi, WifiOff,
  Play, Square, UserPlus, Trash2, Upload, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, EyeOff
} from 'lucide-react';
import { useFaceRecognition, CameraStatus, RecognitionSessionStatus } from '../../hooks/useFaceRecognition';
import {
  getPersons, createPerson, deletePerson,
  addFaceToPerson, Person, RecognitionEvent
} from '../../services/recognitionService';

// ── Status helpers ────────────────────────────────────────────────────────────

function cameraStatusLabel(s: CameraStatus): string {
  switch (s) {
    case 'no_camera': return 'No Camera';
    case 'connecting': return 'Connecting…';
    case 'connected': return 'Connected';
    case 'permission_denied': return 'Permission Denied';
    case 'camera_error': return 'Camera Error';
    case 'disconnected': return 'Disconnected';
  }
}

function cameraStatusColor(s: CameraStatus): string {
  switch (s) {
    case 'connected': return 'text-green-400';
    case 'connecting': return 'text-yellow-400';
    case 'permission_denied':
    case 'camera_error': return 'text-red-400';
    case 'disconnected':
    case 'no_camera': return 'text-gray-500';
  }
}

function recStatusLabel(s: RecognitionSessionStatus): string {
  switch (s) {
    case 'inactive': return 'Inactive';
    case 'starting': return 'Starting…';
    case 'active': return 'ACTIVE';
    case 'stopping': return 'Stopping…';
    case 'error': return 'Error';
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function formatSimilarity(v: number | null): string {
  if (v === null) return '—';
  return (v * 100).toFixed(1) + '%';
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface RegisterPanelProps {
  onRegistered: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

function RegisterPanel({ onRegistered, videoRef }: RegisterPanelProps) {
  const [name, setName] = useState('');
  const [refId, setRefId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [captureMode, setCaptureMode] = useState<'capture' | 'upload'>('capture');
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setMsg({ ok: false, text: 'Connect camera first' });
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const b64 = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewB64(b64);
    setMsg(null);
  }, [videoRef]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewB64(reader.result as string);
    reader.readAsDataURL(file);
    setMsg(null);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!name.trim()) { setMsg({ ok: false, text: 'Name is required' }); return; }
    if (!previewB64) { setMsg({ ok: false, text: 'Capture or upload a face photo first' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const person = await createPerson(name.trim(), refId.trim() || undefined);
      const result = await addFaceToPerson(person.id, previewB64);
      if (!result.success) {
        // Created person but face failed — delete person to avoid orphan
        await deletePerson(person.id);
        setMsg({ ok: false, text: result.error ?? 'Face registration failed' });
      } else {
        setMsg({ ok: true, text: `${person.name} registered successfully` });
        setName('');
        setRefId('');
        setPreviewB64(null);
        onRegistered();
      }
    } catch (err: unknown) {
      setMsg({ ok: false, text: (err instanceof Error) ? err.message : 'Registration failed' });
    } finally {
      setBusy(false);
    }
  }, [name, refId, previewB64, onRegistered]);

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-[#8b949e] flex items-center gap-2">
        <UserPlus size={15} className="text-[#58a6ff]" />
        Register Person
      </h3>

      {/* Name + optional ID */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Full name *"
          value={name}
          onChange={e => setName(e.target.value)}
          className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]"
        />
        <input
          type="text"
          placeholder="ID / badge number (optional)"
          value={refId}
          onChange={e => setRefId(e.target.value)}
          className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
        />
      </div>

      {/* Capture mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setCaptureMode('capture')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${captureMode === 'capture' ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'}`}
        >
          <Camera size={12} className="inline mr-1.5" />
          Capture from Camera
        </button>
        <button
          onClick={() => { setCaptureMode('upload'); fileRef.current?.click(); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${captureMode === 'upload' ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'}`}
        >
          <Upload size={12} className="inline mr-1.5" />
          Upload Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>

      {/* Capture button (only shown in capture mode) */}
      {captureMode === 'capture' && (
        <button
          onClick={captureFromCamera}
          className="w-full py-2 bg-[#1f6feb]/10 border border-[#1f6feb]/40 text-[#58a6ff] text-sm font-semibold rounded-lg hover:bg-[#1f6feb]/20 transition-colors"
        >
          <Eye size={14} className="inline mr-2" />
          Capture Face from Live Camera
        </button>
      )}

      {/* Preview */}
      {previewB64 && (
        <div className="flex items-center gap-3">
          <img src={previewB64} alt="Face preview" className="w-16 h-16 rounded-lg object-cover border border-[#30363d]" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#8b949e]">Face captured</span>
            <button onClick={() => setPreviewB64(null)} className="text-xs text-[#f85149] hover:underline">
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-900/20 border border-green-700/40 text-green-400' : 'bg-red-900/20 border border-red-700/40 text-red-400'}`}>
          {msg.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
          {msg.text}
        </div>
      )}

      {/* Register button */}
      <button
        onClick={handleRegister}
        disabled={busy}
        className="w-full py-2.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
      >
        {busy ? 'Registering…' : 'Register Person'}
      </button>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Persons list ──────────────────────────────────────────────────────────────

interface PersonsListProps {
  persons: Person[];
  onDelete: (id: number) => void;
}

function PersonsList({ persons, onDelete }: PersonsListProps) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 flex flex-col gap-3">
      <h3 className="text-sm font-bold uppercase tracking-widest text-[#8b949e] flex items-center gap-2">
        <UserCheck size={15} className="text-[#58a6ff]" />
        Registered Persons
        <span className="ml-auto text-[#58a6ff] text-xs font-bold">{persons.length}</span>
      </h3>

      {persons.length === 0 ? (
        <p className="text-xs text-[#484f58] text-center py-4">
          No persons registered yet.<br />Register someone to start recognition.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {persons.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#161b22] border border-[#21262d]">
              <div className="w-7 h-7 rounded-full bg-[#1f6feb]/20 border border-[#1f6feb]/40 flex items-center justify-center text-[#58a6ff] text-[10px] font-bold flex-shrink-0">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#e6edf3] truncate">{p.name}</div>
                <div className="text-[10px] text-[#484f58]">
                  {p.face_count} face{p.face_count !== 1 ? 's' : ''}
                  {p.reference_id ? ` · ${p.reference_id}` : ''}
                </div>
              </div>
              <button
                onClick={() => onDelete(p.id)}
                className="text-[#484f58] hover:text-[#f85149] transition-colors p-1"
                title="Delete person"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Recognition events list ───────────────────────────────────────────────────

function EventsList({ events }: { events: RecognitionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-[#484f58] text-xs">
        No recognition events yet.<br />
        Connect camera, start recognition, and stand in front of it.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
      {events.map(ev => (
        <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#161b22] border border-[#21262d] text-xs">
          {/* Thumbnail */}
          {ev.face_crop_b64 ? (
            <img
              src={`data:image/jpeg;base64,${ev.face_crop_b64}`}
              alt="face"
              className="w-8 h-8 rounded object-cover border border-[#30363d] flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-[#21262d] flex items-center justify-center flex-shrink-0">
              <Camera size={12} className="text-[#484f58]" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#e6edf3] truncate">{ev.person_name}</div>
            <div className="text-[#484f58]">
              {ev.camera_name ?? 'Webcam'} · {formatTime(ev.detected_at)}
            </div>
          </div>

          {/* Status + similarity */}
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className={`font-bold ${ev.result_status === 'RECOGNIZED' ? 'text-green-400' : 'text-orange-400'}`}>
              {ev.result_status}
            </span>
            <span className="text-[#484f58]">{formatSimilarity(ev.similarity)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Live detections overlay info ──────────────────────────────────────────────

interface LiveFacesProps {
  faces: ReturnType<typeof useFaceRecognition>['currentFaces'];
}

function LiveFaces({ faces }: LiveFacesProps) {
  if (faces.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {faces.map((f, i) => (
        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
          f.status === 'RECOGNIZED'
            ? 'bg-green-900/20 border-green-700/40'
            : 'bg-orange-900/20 border-orange-700/40'
        }`}>
          {f.face_crop_b64 ? (
            <img
              src={`data:image/jpeg;base64,${f.face_crop_b64}`}
              alt="face"
              className="w-6 h-6 rounded object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded bg-[#21262d]" />
          )}
          <span className={f.status === 'RECOGNIZED' ? 'text-green-400 font-semibold' : 'text-orange-400 font-semibold'}>
            {f.person_name}
          </span>
          <span className="text-[#484f58] ml-auto">{formatSimilarity(f.similarity)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FaceRecognitionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fr = useFaceRecognition(videoRef, canvasRef);

  const [persons, setPersons] = useState<Person[]>([]);
  const [personsLoading, setPersonsLoading] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  const loadPersons = useCallback(async () => {
    setPersonsLoading(true);
    try {
      const list = await getPersons();
      setPersons(list);
    } catch { /* ignore */ }
    setPersonsLoading(false);
  }, []);

  useEffect(() => { loadPersons(); }, [loadPersons]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this person and all their face data?')) return;
    await deletePerson(id);
    setPersons(prev => prev.filter(p => p.id !== id));
  }, []);

  const isCamConnected = fr.cameraStatus === 'connected';
  const isRecActive = fr.recognitionStatus === 'active';

  return (
    <div className="p-6 flex flex-col gap-6 text-[#e6edf3]">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/20 flex items-center justify-center">
          <UserCheck size={18} className="text-[#58a6ff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide">Facial Recognition</h1>
          <p className="text-xs text-[#8b949e]">Real-time identity verification pipeline</p>
        </div>

        {/* Status pills */}
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
            isCamConnected
              ? 'border-green-700/50 bg-green-900/20 text-green-400'
              : 'border-[#30363d] bg-[#161b22] text-[#484f58]'
          }`}>
            {isCamConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            Camera: {cameraStatusLabel(fr.cameraStatus)}
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
            isRecActive
              ? 'border-green-700/50 bg-green-900/20 text-green-400'
              : 'border-[#30363d] bg-[#161b22] text-[#484f58]'
          }`}>
            {isRecActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            Recognition: {recStatusLabel(fr.recognitionStatus)}
          </span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
            fr.modelReady
              ? 'border-green-700/50 bg-green-900/20 text-green-400'
              : 'border-red-700/50 bg-red-900/20 text-red-400'
          }`}>
            Model: {fr.modelReady ? 'READY' : 'NOT AVAILABLE'}
          </span>
        </div>
      </div>

      {/* Error banners */}
      {fr.cameraError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-700/40 rounded-xl text-sm text-red-400">
          <AlertCircle size={15} />
          {fr.cameraError}
        </div>
      )}
      {fr.recognitionError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-700/40 rounded-xl text-sm text-red-400">
          <AlertCircle size={15} />
          {fr.recognitionError}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex gap-6">

        {/* ── LEFT: Camera + stats ── */}
        <div className="flex flex-col gap-4 flex-[2] min-w-0">

          {/* Camera viewport */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">

            {/* Camera controls */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21262d]">
              <Camera size={14} className="text-[#8b949e]" />
              <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest flex-1">
                Live Camera Feed
              </span>
              {fr.fps > 0 && (
                <span className="text-[10px] text-[#484f58]">{fr.fps} fps</span>
              )}
              <div className="flex gap-2">
                {!isCamConnected ? (
                  <button
                    onClick={fr.connectCamera}
                    disabled={fr.cameraStatus === 'connecting'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Wifi size={12} />
                    {fr.cameraStatus === 'connecting' ? 'Connecting…' : 'Connect Camera'}
                  </button>
                ) : (
                  <>
                    {!isRecActive ? (
                      <button
                        onClick={fr.startRecognition}
                        disabled={fr.recognitionStatus === 'starting' || !fr.modelReady}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f6feb] hover:bg-[#388bfd] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Play size={12} />
                        {fr.recognitionStatus === 'starting' ? 'Starting…' : 'Start Recognition'}
                      </button>
                    ) : (
                      <button
                        onClick={fr.stopRecognition}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Square size={12} />
                        Stop Recognition
                      </button>
                    )}
                    <button
                      onClick={fr.disconnectCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#30363d] text-[#8b949e] hover:border-[#f85149] hover:text-[#f85149] text-xs font-semibold rounded-lg transition-colors"
                    >
                      <WifiOff size={12} />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Video area */}
            <div className="relative bg-black" style={{ minHeight: 320 }}>
              {/* Actual live video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[460px] object-contain ${isCamConnected ? 'block' : 'hidden'}`}
              />

              {/* Offline overlay */}
              {!isCamConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0d1117]" style={{ minHeight: 320 }}>
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.15)' }}
                  >
                    <Camera size={36} className="text-[#8b949e]" />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${cameraStatusColor(fr.cameraStatus)}`}>
                      {fr.cameraStatus === 'disconnected'
                        ? 'Camera disconnected. Connect a camera to resume facial recognition.'
                        : fr.cameraStatus === 'permission_denied'
                        ? 'Camera permission denied by browser.'
                        : fr.cameraStatus === 'camera_error'
                        ? (fr.cameraError ?? 'Camera error')
                        : 'No camera connected'}
                    </p>
                    {(fr.cameraStatus === 'no_camera' || fr.cameraStatus === 'disconnected') && (
                      <p className="text-xs text-[#484f58] mt-1">Click "Connect Camera" to start</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recognition overlay badge */}
              {isRecActive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">AI ACTIVE</span>
                </div>
              )}

              {/* Detected faces count */}
              {isRecActive && fr.facesDetected > 0 && (
                <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#58a6ff]">
                  {fr.facesDetected} face{fr.facesDetected !== 1 ? 's' : ''} detected
                </div>
              )}
            </div>

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Live detection stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Faces Detected', value: fr.facesDetected, color: 'text-[#58a6ff]' },
              { label: 'Recognized', value: fr.recognizedCount, color: 'text-green-400' },
              { label: 'Unknown', value: fr.unknownCount, color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-xl px-4 py-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8b949e]">{label}</span>
                <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Current live faces */}
          {isRecActive && fr.currentFaces.length > 0 && (
            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8b949e]">Current Detections</h3>
              <LiveFaces faces={fr.currentFaces} />
            </div>
          )}

          {/* Events */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#8b949e]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8b949e] flex-1">
                Recognition Events
              </h3>
              <button
                onClick={() => setShowEvents(v => !v)}
                className="text-[#484f58] hover:text-[#8b949e] transition-colors"
              >
                {showEvents ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {showEvents && <EventsList events={fr.events} />}
          </div>
        </div>

        {/* ── RIGHT: Register + persons ── */}
        <div className="flex flex-col gap-4 flex-[1] min-w-0" style={{ minWidth: 280 }}>

          {/* Register panel */}
          <RegisterPanel onRegistered={loadPersons} videoRef={videoRef} />

          {/* Persons list */}
          {personsLoading ? (
            <div className="text-xs text-[#484f58] text-center py-4">Loading…</div>
          ) : (
            <PersonsList persons={persons} onDelete={handleDelete} />
          )}

          {/* Refresh button */}
          <button
            onClick={loadPersons}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#8b949e] text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Refresh Persons
          </button>

          {/* Model info card */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8b949e]">Pipeline Info</h3>
            <div className="flex flex-col gap-1 text-[10px] text-[#484f58]">
              <div className="flex justify-between">
                <span>Detector</span>
                <span className="text-[#8b949e]">YuNet (OpenCV)</span>
              </div>
              <div className="flex justify-between">
                <span>Embeddings</span>
                <span className="text-[#8b949e]">SFace 128-dim</span>
              </div>
              <div className="flex justify-between">
                <span>Metric</span>
                <span className="text-[#8b949e]">Cosine similarity</span>
              </div>
              <div className="flex justify-between">
                <span>Device</span>
                <span className="text-[#8b949e]">CPU</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
