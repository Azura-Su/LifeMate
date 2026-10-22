import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CardGameRoom } from '../../types/cardGame';
import { claimCardPresentation } from './cardTableMotion';

export function useCardRoundPresentation(
  room: CardGameRoom,
  active: boolean,
  viewport: string,
  resultAnimationKey?: string | null,
) {
  const matchKey = `${room.id}:${room.matchId ?? ''}`;
  const previous = useRef({ room, viewport, active });
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [collection, setCollection] = useState<{
    key: string;
    hand: number[];
  } | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { room, viewport, active };
    const sameMatch =
      before.room.id === room.id && before.room.matchId === room.matchId;
    const sameViewport = before.viewport === viewport;
    if (!active || !sameViewport || !sameMatch) setCollection(null);
    if (!active || !sameMatch) setResultKey(null);
    if (!active || !room.game || room.game.status === 'playing') return;

    const finishedLiveMatch =
      sameMatch &&
      before.active &&
      sameViewport &&
      before.room.game?.status === 'playing';
    const immediateNewResult =
      before.room.id === room.id &&
      !sameMatch &&
      before.room.phase === 'finished';
    const announcedResult = resultAnimationKey === matchKey;
    if (
      (finishedLiveMatch || immediateNewResult || announcedResult) &&
      claimCardPresentation(`round:${matchKey}`)
    ) {
      setResultKey(matchKey);
      if (finishedLiveMatch)
        setCollection({ key: matchKey, hand: [...room.game.hand] });
    }
  }, [room, active, viewport, resultAnimationKey, matchKey]);

  const finishCollection = useCallback((key: string) => {
    setCollection((current) => (current?.key === key ? null : current));
  }, []);

  return {
    matchKey,
    animateResult: resultKey === matchKey && room.game?.status === 'finished',
    collection: collection?.key === matchKey ? collection : null,
    finishCollection,
  };
}
