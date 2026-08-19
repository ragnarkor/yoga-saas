const HERO_SRC = "/images/achievement/hero_illustration.jpg?v=1";

const HERO_EMOJI_POS = [
  "top:22%;right:34%;",
  "top:46%;right:20%;",
  "top:30%;right:6%;",
];

const HERO_BADGE_FALLBACK = ["first_class", "streak_4", "streak_12"];

function getBadgeIcon(badgeId) {
  if (!badgeId) return "";
  return `/images/achievement/poster_badge_${badgeId}.png`;
}

// Canvas 对透明 WebP 的兼容性不稳定；海报使用尺寸更小的透明 PNG。
function getBadgePosterIcon(badgeId) {
  if (!badgeId) return "";
  return `/images/achievement/poster_badge_${badgeId}.png`;
}

function getHeroIllustration() {
  return HERO_SRC;
}

function buildHeroEmojis(badges) {
  const unlocked = (badges || []).filter((b) => b.unlocked).slice(0, 3);
  const badgeIds = unlocked.length
    ? unlocked.map((b) => b.id)
    : HERO_BADGE_FALLBACK;
  return badgeIds.map((id, index) => ({
    iconSrc: getBadgeIcon(id),
    style: HERO_EMOJI_POS[index] || HERO_EMOJI_POS[0],
  }));
}

function countUnlockedBadges(badges) {
  return (badges || []).filter((b) => b.unlocked).length;
}

module.exports = {
  getHeroIllustration,
  getBadgeIcon,
  getBadgePosterIcon,
  buildHeroEmojis,
  countUnlockedBadges,
};
