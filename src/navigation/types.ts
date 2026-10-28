export type MainTabParams = {
  Profile: undefined;
  UserManagement: undefined;
  PetManagement: undefined;
  Home: undefined;
  Finance: undefined;
  Memories: undefined;
  MP3: undefined;
  Notes: undefined;
  Agenda: undefined;
  CardScore: undefined;
  PixelPet: undefined;
  CardGames:
    | {
        roomCode?: string;
        gameKind?: 'north' | 'sam' | 'tan';
      }
    | undefined;
  Checklists: { checklistId?: string } | undefined;
};
