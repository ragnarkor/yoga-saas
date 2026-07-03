const VALID_IDS = [
  "",
  "sage_wave",
  "terracotta_arc",
  "lavender_flow",
  "ocean_peace",
  "cream_lotus",
];

function normalizeCover(coverId) {
  if (!coverId) return "";
  const id = String(coverId).trim();
  return VALID_IDS.includes(id) ? id : "";
}

module.exports = {
  normalizeCover,
};
