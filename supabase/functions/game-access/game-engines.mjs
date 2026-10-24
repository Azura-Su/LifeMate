import {
  newTienLenGame,
  playTienLen,
  viewTienLen,
  forfeitTienLenPlayers,
  timeoutTienLen,
} from './tienlen.mjs';
import {
  newPhomGame,
  playPhom,
  viewPhom,
  forfeitPhomPlayers,
  timeoutPhom,
} from './phom.mjs';

const engines = {
  south: {
    start: newTienLenGame,
    play: playTienLen,
    view: viewTienLen,
    forfeit: forfeitTienLenPlayers,
    timeout: timeoutTienLen,
  },
  phom: {
    start: (uids, deck, now, winner, config) =>
      newPhomGame(uids, deck, now, config, winner),
    play: playPhom,
    view: viewPhom,
    forfeit: forfeitPhomPlayers,
    timeout: timeoutPhom,
  },
};
export function gameEngine(state) {
  const kind = state.gameKind ?? 'south';
  if (!Object.hasOwn(engines, kind)) throw Error('invalid-input');
  return engines[kind];
}
