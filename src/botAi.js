import { randomAngle } from './core.js';

export const BOT_AIM_TOWARD_PLAYER_CHANCE = 0.4;

export function chooseBotAngle(bot, playerCell, random = Math.random) {
  if (playerCell && random() < BOT_AIM_TOWARD_PLAYER_CHANCE) {
    return Math.atan2(playerCell.y - bot.y, playerCell.x - bot.x);
  }
  return randomAngle();
}
