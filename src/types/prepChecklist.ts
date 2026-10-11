export type PrepChecklistItem = {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
};

export type PrepChecklist = {
  id: string;
  title: string;
  items: PrepChecklistItem[];
  scheduledDateKey?: string;
  createdAt: number;
  updatedAt: number;
};
