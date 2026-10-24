import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";

export type Music = {
  tracks: string[];
  current: string | null;
  playing: boolean;
  error: string | null;
  setTracks: (t: string[]) => void;
  /** `force` plays even if music was just switched on and the setting hasn't come back yet. */
  play: (force?: boolean) => void;
  pause: () => void;
  next: (step?: number) => void;
  playTrack: (name: string) => void;
};

/** The launcher's own music: plays the player's tracks in a loop. */
export function useMusic(enabled: boolean, autoplay: boolean, volume: number): Music {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    api.musicList().then(setTracks, () => {});
    return () => {
      a.pause();
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  const load = useCallback(async (name: string) => {
    const a = audio.current;
    if (!a) return;
    setError(null);
    try {
      a.src = await api.musicLoad(name);
      setCurrent(name);
      await a.play();
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  const next = useCallback(
    (step = 1) => {
      if (tracks.length === 0) return;
      const i = current ? tracks.indexOf(current) : -1;
      load(tracks[(i + step + tracks.length) % tracks.length]);
    },
    [tracks, current, load],
  );

  useEffect(() => {
    const a = audio.current;
    if (a) a.onended = () => next(1);
  }, [next]);

  // Start once tracks are known, if asked to; stop when music is turned off.
  useEffect(() => {
    if (!enabled) {
      audio.current?.pause();
      return;
    }
    if (!started.current && autoplay && tracks.length > 0) {
      started.current = true;
      load(tracks[0]);
    }
  }, [enabled, autoplay, tracks, load]);

  return {
    tracks,
    current,
    playing,
    error,
    setTracks,
    play: (force) => {
      if (!enabled && !force) return;
      if (audio.current?.src) audio.current.play().catch(() => {});
      else if (tracks.length) load(tracks[0]);
    },
    pause: () => audio.current?.pause(),
    next,
    playTrack: (name) => enabled && load(name),
  };
}
