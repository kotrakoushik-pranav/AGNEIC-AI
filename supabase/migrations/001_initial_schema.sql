-- ============================================================
-- Aegis AI — Supabase Initial Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Enable UUID extension ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (mirrors Supabase Auth users with extra profile data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role        TEXT NOT NULL DEFAULT 'operator', -- operator | admin
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-create profile row when auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CAMERAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cameras (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id        TEXT NOT NULL UNIQUE,   -- e.g. CAM-01, mobile-uuid
    name             TEXT NOT NULL,
    location         TEXT,
    pairing_token    TEXT,                   -- short-lived QR token
    token_expires_at TIMESTAMPTZ,
    connection_status TEXT NOT NULL DEFAULT 'OFFLINE', -- OFFLINE|CONNECTING|CONNECTED|RECONNECTING|ERROR
    last_seen        TIMESTAMPTZ,
    ip_address       TEXT,
    stream_url       TEXT,
    is_monitoring    BOOLEAN NOT NULL DEFAULT FALSE,
    adapter_type     TEXT DEFAULT 'webrtc',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_user_id  ON public.cameras(user_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status   ON public.cameras(connection_status);
CREATE INDEX IF NOT EXISTS idx_cameras_token    ON public.cameras(pairing_token);

CREATE TRIGGER trg_cameras_updated_at
    BEFORE UPDATE ON public.cameras
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CAMERA SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.camera_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id        UUID NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
    connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at  TIMESTAMPTZ,
    status           TEXT NOT NULL DEFAULT 'CONNECTING',
    error_message    TEXT,
    device_name      TEXT,
    device_ip        TEXT,
    frames_received  INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camera_sessions_camera_id ON public.camera_sessions(camera_id);
CREATE INDEX IF NOT EXISTS idx_camera_sessions_status    ON public.camera_sessions(status);

-- ============================================================
-- PERSONS  (registered individuals for face recognition)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.persons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    reference_id    TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    face_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_user_id ON public.persons(user_id);

CREATE TRIGGER trg_persons_updated_at
    BEFORE UPDATE ON public.persons
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DETECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.detections (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    camera_id        UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
    person_id        UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    detection_type   TEXT NOT NULL,   -- face|fire|smoke|person|obstacle|fall|accident
    confidence       FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bounding_box     JSONB,
    latitude         FLOAT,
    longitude        FLOAT,
    metadata         JSONB,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detections_user_id      ON public.detections(user_id);
CREATE INDEX IF NOT EXISTS idx_detections_camera_id    ON public.detections(camera_id);
CREATE INDEX IF NOT EXISTS idx_detections_type         ON public.detections(detection_type);
CREATE INDEX IF NOT EXISTS idx_detections_timestamp    ON public.detections(timestamp DESC);

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incidents (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    camera_id        UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
    type             TEXT NOT NULL,
    severity         TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    title            TEXT NOT NULL,
    description      TEXT,
    status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
    latitude         FLOAT,
    longitude        FLOAT,
    detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at  TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    metadata         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id    ON public.incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status     ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity   ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected   ON public.incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_camera     ON public.incidents(camera_id);

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    camera_id        UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
    incident_id      UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    type             TEXT NOT NULL, -- FIRE|UNKNOWN_PERSON|KNOWN_PERSON|OBSTACLE|CAMERA_OFFLINE|SYSTEM_ERROR|OTHER
    severity         TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    message          TEXT NOT NULL,
    acknowledged     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id     ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON public.alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_created     ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_incident    ON public.alerts(incident_id);

-- ============================================================
-- GPS LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gps_locations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    camera_id   UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL,
    accuracy    FLOAT,
    altitude    FLOAT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_user_id   ON public.gps_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_gps_camera_id ON public.gps_locations(camera_id);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON public.gps_locations(timestamp DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_locations  ENABLE ROW LEVEL SECURITY;

-- ── Users: can only read/update their own profile ─────────────
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- ── Cameras: user owns their cameras ──────────────────────────
CREATE POLICY "cameras_select_own" ON public.cameras
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cameras_insert_own" ON public.cameras
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cameras_update_own" ON public.cameras
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cameras_delete_own" ON public.cameras
    FOR DELETE USING (auth.uid() = user_id);

-- ── Camera sessions ───────────────────────────────────────────
CREATE POLICY "camera_sessions_own" ON public.camera_sessions
    FOR ALL USING (
        camera_id IN (SELECT id FROM public.cameras WHERE user_id = auth.uid())
    );

-- ── Persons ──────────────────────────────────────────────────
CREATE POLICY "persons_own" ON public.persons
    FOR ALL USING (auth.uid() = user_id);

-- ── Detections ───────────────────────────────────────────────
CREATE POLICY "detections_own" ON public.detections
    FOR ALL USING (auth.uid() = user_id);

-- ── Incidents ────────────────────────────────────────────────
CREATE POLICY "incidents_own" ON public.incidents
    FOR ALL USING (auth.uid() = user_id);

-- ── Alerts ───────────────────────────────────────────────────
CREATE POLICY "alerts_own" ON public.alerts
    FOR ALL USING (auth.uid() = user_id);

-- ── GPS ──────────────────────────────────────────────────────
CREATE POLICY "gps_own" ON public.gps_locations
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME: enable publications for live sync
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.detections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_sessions;

-- ============================================================
-- DASHBOARD STATISTICS VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
    u.id AS user_id,
    (SELECT COUNT(*) FROM public.cameras       WHERE user_id = u.id)                                          AS total_cameras,
    (SELECT COUNT(*) FROM public.cameras       WHERE user_id = u.id AND connection_status = 'CONNECTED')      AS connected_cameras,
    (SELECT COUNT(*) FROM public.incidents     WHERE user_id = u.id AND status = 'OPEN')                      AS open_incidents,
    (SELECT COUNT(*) FROM public.incidents     WHERE user_id = u.id AND status = 'OPEN' AND severity = 'CRITICAL') AS critical_incidents,
    (SELECT COUNT(*) FROM public.alerts        WHERE user_id = u.id AND acknowledged = FALSE)                  AS unacknowledged_alerts,
    (SELECT COUNT(*) FROM public.persons       WHERE user_id = u.id AND active = TRUE)                        AS registered_persons,
    (SELECT COUNT(*) FROM public.detections    WHERE user_id = u.id AND timestamp >= CURRENT_DATE)            AS detections_today,
    (SELECT COUNT(*) FROM public.gps_locations WHERE user_id = u.id)                                          AS gps_records
FROM public.users u;
