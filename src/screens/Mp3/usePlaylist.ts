import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioTrack } from '../../types/audio';
import {
  isPlaylistNameTaken,
  normalizePlaylistName,
  type ListeningPlaylist,
} from './playlistNames';

export type { ListeningPlaylist };

const playlistKey = (uid: string) => `lifemate-audio-playlists-v1-${uid}`;
const legacyPlaylistKey = (uid: string) => `lifemate-audio-playlist-${uid}`;
const defaultPlaylistId = 'default';
const emptyTrackIds: string[] = [];

type PlaylistState = {
  version: 1;
  selectedPlaylistId: string;
  playlists: ListeningPlaylist[];
};

function withTrackIds(
  state: PlaylistState,
  playlistId: string,
  change: (trackIds: string[]) => string[],
): PlaylistState {
  const list = state.playlists.find((item) => item.id === playlistId);
  if (!list) return state;
  const trackIds = change(list.trackIds);
  if (trackIds === list.trackIds) return state;
  return {
    ...state,
    playlists: state.playlists.map((item) =>
      item.id === playlistId ? { ...item, trackIds } : item,
    ),
  };
}

const defaultState = (): PlaylistState => ({
  version: 1,
  selectedPlaylistId: defaultPlaylistId,
  playlists: [{ id: defaultPlaylistId, name: 'Danh sách nghe', trackIds: [] }],
});

function uniqueTrackIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string')),
  ];
}

function parsePlaylistState(value: string | null): PlaylistState | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('playlists' in parsed) ||
      !Array.isArray(parsed.playlists)
    ) {
      return null;
    }

    const playlists: ListeningPlaylist[] = [];
    const usedIds = new Set<string>();
    for (const candidate of parsed.playlists) {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !('id' in candidate) ||
        typeof candidate.id !== 'string' ||
        !candidate.id ||
        usedIds.has(candidate.id) ||
        !('name' in candidate) ||
        typeof candidate.name !== 'string'
      ) {
        continue;
      }
      const name = normalizePlaylistName(candidate.name);
      if (!name) continue;
      usedIds.add(candidate.id);
      playlists.push({
        id: candidate.id,
        name,
        trackIds: uniqueTrackIds(
          'trackIds' in candidate ? candidate.trackIds : [],
        ),
      });
    }

    const safePlaylists =
      parsed.playlists.length === 0
        ? []
        : playlists.length > 0
          ? playlists
          : defaultState().playlists;
    const savedId =
      'selectedPlaylistId' in parsed &&
      typeof parsed.selectedPlaylistId === 'string'
        ? parsed.selectedPlaylistId
        : '';
    return {
      version: 1,
      selectedPlaylistId:
        safePlaylists.length === 0
          ? ''
          : safePlaylists.some((item) => item.id === savedId)
            ? savedId
            : safePlaylists[0].id,
      playlists: safePlaylists,
    };
  } catch {
    return null;
  }
}

function parseLegacyPlaylist(value: string | null): PlaylistState | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return {
      version: 1,
      selectedPlaylistId: defaultPlaylistId,
      playlists: [
        {
          id: defaultPlaylistId,
          name: 'Danh sách nghe',
          trackIds: uniqueTrackIds(parsed),
        },
      ],
    };
  } catch {
    return null;
  }
}

function createId() {
  return `playlist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Playlists and their memberships are private to this device account. Tracks
// remain in the shared audio library; each playlist stores only ordered IDs.
export function usePlaylist(uid: string | undefined, tracks: AudioTrack[]) {
  const [state, setState] = useState<PlaylistState>(defaultState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    let active = true;
    const empty = defaultState();
    stateRef.current = empty;
    setState(empty);
    setReady(false);
    if (!uid) {
      setReady(true);
      return;
    }

    Promise.all([
      AsyncStorage.getItem(playlistKey(uid)),
      AsyncStorage.getItem(legacyPlaylistKey(uid)),
    ])
      .then(([saved, legacy]) => {
        if (!active) return;
        const migrated = !saved ? parseLegacyPlaylist(legacy) : null;
        const next = parsePlaylistState(saved) ?? migrated ?? defaultState();
        stateRef.current = next;
        setState(next);
        if (migrated) {
          void AsyncStorage.setItem(
            playlistKey(uid),
            JSON.stringify(next),
          ).catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const update = useCallback(
    (change: (current: PlaylistState) => PlaylistState) => {
      const next = change(stateRef.current);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (uid) {
        void AsyncStorage.setItem(playlistKey(uid), JSON.stringify(next)).catch(
          () => undefined,
        );
      }
    },
    [uid],
  );

  const selectedPlaylist = useMemo(
    () =>
      state.playlists.find((item) => item.id === state.selectedPlaylistId) ??
      null,
    [state],
  );
  const selectedTrackIds = selectedPlaylist?.trackIds ?? emptyTrackIds;
  const items = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return selectedTrackIds.flatMap((id) => byId.get(id) ?? []);
  }, [selectedTrackIds, tracks]);

  const selectPlaylist = useCallback(
    (id: string) =>
      update((current) =>
        current.selectedPlaylistId === id ||
        !current.playlists.some((item) => item.id === id)
          ? current
          : { ...current, selectedPlaylistId: id },
      ),
    [update],
  );
  const createPlaylist = useCallback(
    (name: string) => {
      const normalized = normalizePlaylistName(name);
      if (
        !normalized ||
        isPlaylistNameTaken(stateRef.current.playlists, normalized)
      )
        return null;
      const id = createId();
      update((current) => ({
        ...current,
        selectedPlaylistId: id,
        playlists: [
          ...current.playlists,
          { id, name: normalized, trackIds: [] },
        ],
      }));
      return id;
    },
    [update],
  );
  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      const normalized = normalizePlaylistName(name);
      const { playlists } = stateRef.current;
      const target = playlists.find((item) => item.id === id);
      if (
        !normalized ||
        !target ||
        isPlaylistNameTaken(playlists, normalized, id)
      )
        return false;
      if (target.name !== normalized)
        update((latest) => ({
          ...latest,
          playlists: latest.playlists.map((item) =>
            item.id === id ? { ...item, name: normalized } : item,
          ),
        }));
      return true;
    },
    [update],
  );
  const deletePlaylist = useCallback(
    (id: string) => {
      if (!stateRef.current.playlists.some((item) => item.id === id))
        return false;
      update((current) => {
        const playlists = current.playlists.filter((item) => item.id !== id);
        return {
          ...current,
          playlists,
          selectedPlaylistId:
            current.selectedPlaylistId !== id
              ? current.selectedPlaylistId
              : (playlists[0]?.id ?? ''),
        };
      });
      return true;
    },
    [update],
  );
  const moveTrack = useCallback(
    (trackId: string, direction: 'up' | 'down') =>
      update((current) =>
        withTrackIds(current, current.selectedPlaylistId, (ids) => {
          const from = ids.indexOf(trackId);
          const to = from + (direction === 'up' ? -1 : 1);
          if (from < 0 || to < 0 || to >= ids.length) return ids;
          const next = [...ids];
          [next[from], next[to]] = [next[to], next[from]];
          return next;
        }),
      ),
    [update],
  );
  const toggleInPlaylist = useCallback(
    (trackId: string, playlistId: string) =>
      update((current) =>
        withTrackIds(current, playlistId, (ids) =>
          ids.includes(trackId)
            ? ids.filter((id) => id !== trackId)
            : [...ids, trackId],
        ),
      ),
    [update],
  );
  // Removes a track from the playlist currently shown on the MP3 tab.
  const remove = useCallback(
    (trackId: string) =>
      update((current) =>
        withTrackIds(current, current.selectedPlaylistId, (ids) =>
          ids.includes(trackId) ? ids.filter((id) => id !== trackId) : ids,
        ),
      ),
    [update],
  );
  // Used when the audio file itself is deleted from the library.
  const removeFromAll = useCallback(
    (trackId: string) =>
      update((current) =>
        current.playlists.reduce(
          (state, item) =>
            withTrackIds(state, item.id, (ids) =>
              ids.includes(trackId) ? ids.filter((id) => id !== trackId) : ids,
            ),
          current,
        ),
      ),
    [update],
  );
  const hasInPlaylist = useCallback(
    (trackId: string, playlistId: string) =>
      state.playlists
        .find((item) => item.id === playlistId)
        ?.trackIds.includes(trackId) ?? false,
    [state.playlists],
  );
  const membershipCount = useCallback(
    (trackId: string) =>
      state.playlists.filter((item) => item.trackIds.includes(trackId)).length,
    [state.playlists],
  );

  return {
    ready,
    playlists: state.playlists,
    selectedPlaylist,
    selectedPlaylistId: selectedPlaylist?.id ?? '',
    items,
    selectPlaylist,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    moveTrack,
    toggleInPlaylist,
    hasInPlaylist,
    membershipCount,
    remove,
    removeFromAll,
  };
}
