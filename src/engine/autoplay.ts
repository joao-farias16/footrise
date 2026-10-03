import { getClub } from '../data/clubs';
import type { Career, DraftMode, PlayerProfile } from '../types';
import {
  acceptOffer,
  announceRetirement,
  chooseEventOption,
  chooseInitialClub,
  continueAfterEvent,
  continueAfterReview,
  createCareer,
  draftPick,
  goToClubChoice,
  startSeason,
  stayAtClub,
} from './career';
import { optionGain } from './draft';
import { Rng } from './rng';

/**
 * Joga uma carreira inteira com decisões automáticas simples.
 * Usado em testes de ponta a ponta e para calibrar o balanceamento.
 */
export function autoplayCareer(profile: PlayerProfile, seed: number, opts: { retireAge?: number; mode?: DraftMode } = {}): Career {
  const bot = new Rng(seed ^ 0x9e3779b9);
  let c = createCareer(profile, opts.mode ?? 'analyst', seed);
  let guard = 0;
  while (c.phase !== 'retired' && guard++ < 2000) {
    switch (c.phase) {
      case 'draft': {
        const options = c.draft.current!.options;
        let best = 0;
        options.forEach((o, i) => {
          if (optionGain(c.draft.slots, c.profile.position, o) > optionGain(c.draft.slots, c.profile.position, options[best])) best = i;
        });
        c = draftPick(c, best);
        break;
      }
      case 'card':
        c = goToClubChoice(c);
        break;
      case 'club-choice':
        c = chooseInitialClub(c, c.offers[bot.int(0, c.offers.length - 1)].id);
        break;
      case 'hub':
        if (opts.retireAge && c.age >= opts.retireAge && !c.retireAnnounced) c = announceRetirement(c);
        c = startSeason(c);
        break;
      case 'event': {
        const ev = c.events[c.eventIndex];
        c = ev.resolved ? continueAfterEvent(c) : chooseEventOption(c, bot.int(0, 2));
        break;
      }
      case 'season-review':
        c = continueAfterReview(c);
        break;
      case 'offers': {
        const current = getClub(c.clubId)!;
        const better = c.offers
          .filter((o) => o.startShare >= 0.45 && (getClub(o.clubId)?.strength ?? 0) > current.strength)
          .sort((a, b) => (getClub(b.clubId)?.strength ?? 0) - (getClub(a.clubId)?.strength ?? 0))[0];
        c = better ? acceptOffer(c, better.id) : stayAtClub(c);
        break;
      }
    }
  }
  return c;
}
