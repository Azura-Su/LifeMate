import { cardGamesEnabled } from '../cardGames';

jest.mock('../audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'publishable-key',
}));

const original = process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED;
  else process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED = original;
});

it('shows the online game entry when cloud config is present', () => {
  delete process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED;
  expect(cardGamesEnabled()).toBe(true);
});

it('keeps an explicit client kill switch', () => {
  process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED = 'false';
  expect(cardGamesEnabled()).toBe(false);
});
