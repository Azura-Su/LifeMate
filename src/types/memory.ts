export type MemoryEntry = {
  id: string;
  ownerId: string;
  dateKey: string;
  text: string;
  photoFileName: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MemoryDraft = {
  dateKey: string;
  text: string;
  photoUri: string | null;
  photoMimeType?: string | null;
  photoChange: 'keep' | 'replace' | 'remove';
};
