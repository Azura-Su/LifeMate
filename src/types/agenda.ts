export type AgendaItem = {
  id: string;
  ownerId: string;
  title: string;
  details: string;
  dueAt: number;
  completed: boolean;
  reminderAt: number | null;
  updatedAt: number;
};
