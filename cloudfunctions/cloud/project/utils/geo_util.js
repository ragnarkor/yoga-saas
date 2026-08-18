const EARTH_RADIUS_METERS = 6371000;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [a, b, c, d] = values.map((value) => (value * Math.PI) / 180);
  const x = c - a;
  const y = d - b;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a) * Math.cos(c) * Math.sin(y / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

module.exports = { distanceMeters };
