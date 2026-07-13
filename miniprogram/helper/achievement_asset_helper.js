const HERO_SRC = "/images/achievement/hero_illustration.jpg?v=1";

const HERO_EMOJI_POS = [
  "top:22%;right:34%;",
  "top:46%;right:20%;",
  "top:30%;right:6%;",
];

const HERO_EMOJI_FALLBACK = ["🌱", "🔥", "⭐"];

function getHeroIllustration() {
  return HERO_SRC;
}

function buildHeroEmojis(badges) {
  const unlocked = (badges || []).filter((b) => b.unlocked).slice(0, 3);
  const emojis = unlocked.length
    ? unlocked.map((b) => b.emoji)
    : HERO_EMOJI_FALLBACK;
  return emojis.map((emoji, index) => ({
    emoji,
    style: HERO_EMOJI_POS[index] || HERO_EMOJI_POS[0],
  }));
}

function countUnlockedBadges(badges) {
  return (badges || []).filter((b) => b.unlocked).length;
}

module.exports = {
  getHeroIllustration,
  buildHeroEmojis,
  countUnlockedBadges,
};
