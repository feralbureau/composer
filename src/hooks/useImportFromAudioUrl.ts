import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useComposerReturnStore } from "@/stores/composer-return-store";
import { stripQueryParams } from "@/utils/url-params";

// -- Constants ----------------------------------------------------------------

const AUDIO_PARAM_NAMES = ["audioUrl", "title", "artist", "album", "duration", "lyrics", "returnApi", "armor"] as const;
const LOG_PREFIX = "[Boot]";

// -- Helpers -------------------------------------------------------------------

function readTrimmed(params: URLSearchParams, name: string): string | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function parseDurationSec(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function deriveFileName(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.includes(".")) return last;
    return u.pathname.replace(/\//g, "_") || "audio";
  } catch {
    return "audio";
  }
}

function deriveMimeType(url: string, fileName: string): string {
  const ext = (fileName.split(".").pop() || url.split(".").pop() || "").toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    opus: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
  };
  return mimeMap[ext] || "audio/mpeg";
}

// -- Hook ---------------------------------------------------------------------

function useImportFromAudioUrl(): void {
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fetchingRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const audioUrl = readTrimmed(params, "audioUrl");
    if (!audioUrl) return;

    fetchingRef.current = true;
    stripQueryParams(AUDIO_PARAM_NAMES);

    const title = readTrimmed(params, "title") ?? undefined;
    const artist = readTrimmed(params, "artist") ?? undefined;
    const album = readTrimmed(params, "album") ?? undefined;
    const durationSec = parseDurationSec(readTrimmed(params, "duration"));
    const lyrics = readTrimmed(params, "lyrics");
    const returnApi = readTrimmed(params, "returnApi");
    const armor = readTrimmed(params, "armor");

    let cancelled = false;

    if (import.meta.env.DEV) console.log(`${LOG_PREFIX} useImportFromAudioUrl awaiting settled`, { audioUrl });

    getPersistenceSettled().then(async () => {
      if (cancelled) return;

      try {
        if (import.meta.env.DEV) console.log(`${LOG_PREFIX} useImportFromAudioUrl fetching`, { audioUrl });

        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const blob = await response.blob();
        if (cancelled) return;

        const fileName = deriveFileName(audioUrl);
        const mimeType = deriveMimeType(audioUrl, fileName);
        const file = new File([blob], fileName, { type: mimeType });

        if (import.meta.env.DEV) console.log(`${LOG_PREFIX} useImportFromAudioUrl loaded`, { fileName, size: file.size });

        useAudioStore.getState().setSource({ type: "file", file });

        const meta: Record<string, string | number | undefined> = {};
        if (title) meta.title = title;
        if (artist) meta.artist = artist;
        if (album) meta.album = album;
        if (durationSec !== undefined) meta.duration = durationSec;
        if (Object.keys(meta).length > 0) {
          useProjectStore.getState().setMetadata(meta as any);
        }

        // Store return config for "Send to Liner" button in export panel
        if (returnApi) {
          useComposerReturnStore.getState().setReturnConfig({ returnApi, armor: armor ?? undefined });
        }

        // Open the lyrics import modal pre-filled with track info and optional lyrics text
        useImportModalStore.getState().open({
          prefill: { track: title, artist, album, durationSec },
          section: "paste",
          body: lyrics ?? undefined,
        });

        toast.success(`Loaded audio: ${fileName}`);
      } catch (err) {
        console.error(`${LOG_PREFIX} useImportFromAudioUrl failed`, err);
        toast.error(`Could not load audio from URL: ${err instanceof Error ? err.message : "unknown error"}`);
      } finally {
        fetchingRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromAudioUrl };
