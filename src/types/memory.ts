export type MemoryEntry = {
  id: string;
  ownerId: string;
  dateKey: string;
  text: string;
  photoFileName: string | null;
  visibility?: 'private' | 'friends';
  /** Device sync metadata; never grants friend visibility. */
  cloudRevision?: string;
  pendingRevision?: string;
  deletedAt?: number;
  photoSizeBytes?: number;
  /** Local-only proof of a confirmed immutable R2 original; never a permission. */
  r2Photo?: { fileName: string; sizeBytes: number };
  createdAt: number;
  updatedAt: number;
};

export type MemoryDraft = {
  dateKey: string;
  text: string;
  photoUri: string | null;
  photoMimeType?: string | null;
  photoChange: 'keep' | 'replace';
  visibility: 'private' | 'friends';
};
