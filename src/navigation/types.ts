export type MainTabParams = {
  Profile: undefined;
  UserManagement: undefined;
  Home: undefined;
  Finance: undefined;
  Memories: undefined;
  MP3: undefined;
  Notes: undefined;
  Agenda: undefined;
  CardScore: undefined;
  CardGames:
    | {
        roomCode?: string;
        gameKind?: 'north' | 'sam' | 'tan';
      }
    | undefined;
  Checklists: { checklistId?: string } | undefined;
  Pets: undefined;
};
