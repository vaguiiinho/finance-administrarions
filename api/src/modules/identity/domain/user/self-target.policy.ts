import { CannotTargetSelfError } from './errors/user-errors.js';
import type { UserId } from './value-objects/user-id.js';

export const SelfTargetPolicy = {
  /** Inativar e redefinir senha de si mesmo -> CannotTargetSelfError. */
  assertNotSelf(actorId: UserId, targetId: UserId): void {
    if (actorId.equals(targetId)) throw new CannotTargetSelfError();
  },
};
