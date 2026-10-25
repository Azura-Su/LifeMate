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
import {
  newTienLenNorthGame,
  playTienLenNorth,
  viewTienLenNorth,
  forfeitTienLenNorthPlayers,
  timeoutTienLenNorth,
} from './tienlen-north.mjs';
import {
  newSamGame,
  actSam,
  viewSam,
  forfeitSamPlayers,
  timeoutSam,
} from './sam.mjs';
import {
  newTanGame,
  actTan,
  viewTan,
  forfeitTanPlayers,
  timeoutTan,
} from './tan.mjs';

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
  north: {
    start: newTienLenNorthGame,
    play: playTienLenNorth,
    view: viewTienLenNorth,
    forfeit: forfeitTienLenNorthPlayers,
    timeout: timeoutTienLenNorth,
  },
  sam: {
    start: newSamGame,
    play: (state, uid, action, now) => actSam(state, uid, action.gameAction, now),
    view: viewSam,
    forfeit: forfeitSamPlayers,
    timeout: timeoutSam,
  },
  tan: {
    start: newTanGame,
    play: (state, uid, action, now) => actTan(state, uid, action.gameAction, now),
    view: viewTan,
    forfeit: forfeitTanPlayers,
    timeout: timeoutTan,
  },
};
export function gameEngine(state) {
  const kind = state.gameKind ?? 'south';
  if (!Object.hasOwn(engines, kind)) throw Error('invalid-input');
  return engines[kind];
}
