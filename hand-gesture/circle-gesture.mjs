export function analyzeCircleGesture(points) {
  if (!Array.isArray(points) || points.length < 21) return { isCircle: false, score: 0 };
  const palmSize = (distance(points[0], points[9]) + distance(points[5], points[17])) / 2;
  if (palmSize < 12) return { isCircle: false, score: 0 };

  const tipGapRatio = distance(points[4], points[8]) / palmSize;
  const indexBendAngle = angleBetween(
    vector(points[5], points[6]),
    vector(points[7], points[8]),
  );
  const indexPathLength = distance(points[5], points[6])
    + distance(points[6], points[7])
    + distance(points[7], points[8]);
  const indexChordRatio = distance(points[5], points[8]) / Math.max(1, indexPathLength);
  const openingRatio = (distance(points[3], points[7]) + distance(points[2], points[6])) / (2 * palmSize);

  const tipsTouch = tipGapRatio <= 0.34;
  const indexIsCurved = indexBendAngle >= 24 || indexChordRatio <= 0.86;
  const circleHasOpening = openingRatio >= 0.16;
  const isCircle = tipsTouch && indexIsCurved && circleHasOpening;
  const score = clamp(
    (1 - tipGapRatio / 0.34) * 0.55
      + Math.min(1, indexBendAngle / 75) * 0.25
      + Math.min(1, openingRatio / 0.42) * 0.2,
    0,
    1,
  );

  return {
    isCircle,
    score,
    center: {
      x: (points[4].x + points[8].x) / 2,
      y: (points[4].y + points[8].y) / 2,
    },
  };
}

function vector(from, to) {
  return { x: to.x - from.x, y: to.y - from.y };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b) {
  const denominator = Math.max(0.0001, Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  const cosine = clamp((a.x * b.x + a.y * b.y) / denominator, -1, 1);
  return Math.acos(cosine) * (180 / Math.PI);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
