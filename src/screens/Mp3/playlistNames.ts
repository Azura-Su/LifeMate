// Pure playlist helpers, kept apart from the storage hook so UI code and
// tests can use them without loading AsyncStorage.
export type ListeningPlaylist = {
  id: string;
  name: string;
  trackIds: string[];
};

export const MAX_PLAYLIST_NAME_LENGTH = 40;
export const normalizePlaylistName = (name: string) =>
  name.trim().slice(0, MAX_PLAYLIST_NAME_LENGTH);

// Names are unique per account, compared without case.
export function isPlaylistNameTaken(
  playlists: ListeningPlaylist[],
  name: string,
  exceptId?: string,
) {
  const lower = normalizePlaylistName(name).toLocaleLowerCase();
  return playlists.some(
    (item) => item.id !== exceptId && item.name.toLocaleLowerCase() === lower,
  );
}
