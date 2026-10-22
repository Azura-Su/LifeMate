import type { DirectoryUser } from '../types/models';

// Ships inside every build: never put real addresses here. Names come from
// Remote Config at runtime; unknown users fall back to their own profile.
export const DEFAULT_USERS: DirectoryUser[] = [];
export const REMOTE_CONFIG_USERS_KEY = 'users';
export const REMOTE_CONFIG_GAME_USERS_KEY = 'usergame';
export const REMOTE_CONFIG_REGISTRATION_KEY = 'registration_enabled';
