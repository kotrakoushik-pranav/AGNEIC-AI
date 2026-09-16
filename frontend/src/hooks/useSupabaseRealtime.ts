/**
 * useSupabaseRealtime — subscribes to Supabase Realtime changes for cross-device sync.
 *
 * Subscribes to:
 *   - public.incidents  (INSERT, UPDATE)
 *   - public.alerts     (INSERT, UPDATE)
 *   - public.cameras    (UPDATE)
 *   - public.detections (INSERT)
 *
 * Only active when Supabase is configured and user is authenticated.
 * Falls back gracefully when Supabase is not configured.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RealtimeCallbacks {
  onIncidentChange?: () => void;
  onAlertChange?: () => void;
  onCameraChange?: () => void;
  onDetectionChange?: () => void;
}

export function useSupabaseRealtime({
  onIncidentChange,
  onAlertChange,
  onCameraChange,
  onDetectionChange,
}: RealtimeCallbacks) {
  const { session, supabaseConfigured } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !session?.user?.id) return;

    const userId = session.user.id;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`aegis-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `user_id=eq.${userId}` },
        () => { onIncidentChange?.(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `user_id=eq.${userId}` },
        () => { onAlertChange?.(); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cameras', filter: `user_id=eq.${userId}` },
        () => { onCameraChange?.(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'detections', filter: `user_id=eq.${userId}` },
        () => { onDetectionChange?.(); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[Realtime] Supabase channel subscribed');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.user?.id, supabaseConfigured, onIncidentChange, onAlertChange, onCameraChange, onDetectionChange]);
}
