import { useEffect, useRef } from "react";

/**
 * Lightweight WebAudio ambient pad (no external audio file required).
 * Starts muted-by-default; only plays after user toggles music on.
 */
export function useAmbientAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ gain: GainNode; osc: OscillatorNode[] } | null>(null);

  useEffect(() => {
    if (!enabled) {
      const nodes = nodesRef.current;
      if (nodes) {
        const now = nodes.gain.context.currentTime;
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.gain.gain.linearRampToValueAtTime(0, now + 0.35);
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new AudioCtx();
    ctxRef.current = ctx;

    if (!nodesRef.current) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const freqs = [110, 164.81, 196];
      const osc = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.04 - i * 0.01;
        o.connect(g);
        g.connect(gain);
        o.start();
        return o;
      });
      nodesRef.current = { gain, osc };
    }

    void ctx.resume();
    const now = ctx.currentTime;
    nodesRef.current.gain.gain.cancelScheduledValues(now);
    nodesRef.current.gain.gain.linearRampToValueAtTime(0.08, now + 0.5);

    return () => undefined;
  }, [enabled]);
}
