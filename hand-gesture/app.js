const elements = {
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  cameraMessage: document.querySelector("#cameraMessage"),
  modelStatus: document.querySelector("#modelStatus"),
  handStatus: document.querySelector("#handStatus"),
  gestureStatus: document.querySelector("#gestureStatus"),
  gestureCard: document.querySelector("#gestureCard"),
  heartReaction: document.querySelector("#heartReaction"),
  heartParticles: document.querySelector("#heartParticles"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
};

const state = {
  stream: null,
  detector: null,
  running: false,
  detecting: false,
  rafId: null,
  heartFrames: 0,
  heartActive: false,
  reactionTimer: null,
  audioContext: null,
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];
const HEART_CONFIRM_FRAMES = 6;
const HEART_RELEASE_FRAMES = 8;
const ctx = elements.overlay.getContext("2d");

document.body.classList.toggle("is-embedded", new URLSearchParams(window.location.search).has("embed"));
elements.startButton.addEventListener("click", startCamera);
elements.stopButton.addEventListener("click", stopCamera);
window.addEventListener("resize", resizeOverlay);
window.addEventListener("pagehide", stopCamera);

async function startCamera() {
  elements.startButton.disabled = true;
  elements.cameraMessage.textContent = "内カメラと手検出モデルを準備しています";
  elements.cameraMessage.classList.remove("is-hidden");
  elements.modelStatus.textContent = "読み込み中";
  primeReactionSound();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
    });
    elements.video.srcObject = state.stream;
    await elements.video.play();
    await loadDetector();
    state.running = true;
    elements.stopButton.disabled = false;
    elements.modelStatus.textContent = "利用できます";
    elements.cameraMessage.classList.add("is-hidden");
    resizeOverlay();
    detectLoop();
  } catch (error) {
    elements.modelStatus.textContent = "開始できません";
    elements.cameraMessage.textContent = getCameraErrorMessage(error);
    elements.startButton.disabled = false;
    stopStream();
  }
}

async function loadDetector() {
  if (state.detector) return;
  if (!window.handPoseDetection) throw new Error("手検出ライブラリを読み込めませんでした");
  const model = window.handPoseDetection.SupportedModels.MediaPipeHands;
  state.detector = await window.handPoseDetection.createDetector(model, {
    runtime: "mediapipe",
    solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240",
    modelType: "lite",
    maxHands: 2,
  });
}

async function detectLoop() {
  if (!state.running || state.detecting) return;
  state.detecting = true;
  try {
    const hands = await state.detector.estimateHands(elements.video, { flipHorizontal: true });
    renderHands(hands);
  } catch {
    elements.handStatus.textContent = "検出エラー";
  } finally {
    state.detecting = false;
    if (state.running) state.rafId = requestAnimationFrame(detectLoop);
  }
}

function renderHands(hands) {
  resizeOverlay();
  clearOverlay();
  const visibleHands = hands.filter((hand) => hand.score == null || hand.score >= 0.65);
  elements.handStatus.textContent = visibleHands.length ? `${visibleHands.length}手を検出` : "未検出";

  let heartCandidate = false;
  let bestHeart = null;
  for (const hand of visibleHands) {
    const result = analyzeFingerHeart(hand.keypoints);
    drawHand(hand.keypoints, result.isHeart);
    if (result.isHeart && (!bestHeart || result.score > bestHeart.score)) {
      heartCandidate = true;
      bestHeart = result;
    }
  }

  updateHeartState(heartCandidate, bestHeart);
}

function analyzeFingerHeart(points) {
  if (!Array.isArray(points) || points.length < 21) return { isHeart: false, score: 0 };
  const palmSize = (distance(points[0], points[9]) + distance(points[5], points[17])) / 2;
  if (palmSize < 12) return { isHeart: false, score: 0 };

  const tipGapRatio = distance(points[4], points[8]) / palmSize;
  const distalAngle = angleBetween(
    vector(points[3], points[4]),
    vector(points[7], points[8]),
  );
  const foldedFingers = [
    isFingerFolded(points, 10, 12),
    isFingerFolded(points, 14, 16),
    isFingerFolded(points, 18, 20),
  ].filter(Boolean).length;
  const crossedDistance = Math.min(
    pointToSegmentDistance(points[4], points[6], points[8]),
    pointToSegmentDistance(points[8], points[2], points[4]),
  ) / palmSize;

  const tipsClose = tipGapRatio <= 0.42;
  const fingersCross = distalAngle >= 28 || crossedDistance <= 0.24;
  const handShapeMatches = foldedFingers >= 2;
  const isHeart = tipsClose && fingersCross && handShapeMatches;
  const score = clamp(
    (1 - tipGapRatio / 0.42) * 0.55
      + Math.min(1, distalAngle / 70) * 0.25
      + (foldedFingers / 3) * 0.2,
    0,
    1,
  );

  return {
    isHeart,
    score,
    center: {
      x: (points[4].x + points[8].x) / 2,
      y: (points[4].y + points[8].y) / 2,
    },
  };
}

function isFingerFolded(points, pipIndex, tipIndex) {
  const wrist = points[0];
  return distance(points[tipIndex], wrist) <= distance(points[pipIndex], wrist) * 1.18;
}

function updateHeartState(candidate, result) {
  if (candidate) {
    state.heartFrames = Math.min(HEART_CONFIRM_FRAMES, state.heartFrames + 1);
  } else {
    state.heartFrames = Math.max(-HEART_RELEASE_FRAMES, state.heartFrames - 1);
  }

  if (state.heartFrames >= HEART_CONFIRM_FRAMES) {
    elements.gestureStatus.textContent = "指ハートを認識 ♡";
    elements.gestureCard.classList.add("is-heart");
    if (!state.heartActive) {
      state.heartActive = true;
      triggerHeartReaction(result?.center);
    }
    return;
  }

  if (state.heartFrames <= -HEART_RELEASE_FRAMES) state.heartActive = false;
  elements.gestureCard.classList.remove("is-heart");
  elements.gestureStatus.textContent = candidate ? "指ハート候補…" : "手の形を確認中";
}

function triggerHeartReaction(center) {
  elements.heartReaction.classList.add("is-active");
  createHeartParticles(center);
  playReactionSound();
  if (state.reactionTimer) clearTimeout(state.reactionTimer);
  state.reactionTimer = window.setTimeout(() => {
    elements.heartReaction.classList.remove("is-active");
    state.reactionTimer = null;
  }, 1500);
}

function createHeartParticles(center) {
  const basePercent = center ? clamp((center.x / Math.max(1, elements.video.videoWidth)) * 100, 12, 88) : 50;
  for (let index = 0; index < 9; index += 1) {
    const particle = document.createElement("span");
    particle.className = "heart-particle";
    particle.textContent = index % 2 ? "♥" : "♡";
    particle.style.setProperty("--x", `${clamp(basePercent + (Math.random() - 0.5) * 42, 5, 95)}%`);
    particle.style.setProperty("--size", `${20 + Math.round(Math.random() * 24)}px`);
    particle.style.animationDelay = `${index * 55}ms`;
    elements.heartParticles.appendChild(particle);
    window.setTimeout(() => particle.remove(), 1900);
  }
}

function drawHand(points, isHeart) {
  const scaleX = elements.overlay.clientWidth / Math.max(1, elements.video.videoWidth);
  const scaleY = elements.overlay.clientHeight / Math.max(1, elements.video.videoHeight);
  ctx.lineWidth = 3;
  ctx.strokeStyle = isHeart ? "#ff4b91" : "#66d4ff";
  ctx.fillStyle = isHeart ? "#ff89b8" : "#d9f6ff";

  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    const from = points[fromIndex];
    const to = points[toIndex];
    ctx.beginPath();
    ctx.moveTo(from.x * scaleX, from.y * scaleY);
    ctx.lineTo(to.x * scaleX, to.y * scaleY);
    ctx.stroke();
  }

  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x * scaleX, point.y * scaleY, [4, 8].includes(index) ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (isHeart) {
    const centerX = ((points[4].x + points[8].x) / 2) * scaleX;
    const centerY = ((points[4].y + points[8].y) / 2) * scaleY;
    ctx.font = "900 44px sans-serif";
    ctx.fillStyle = "#ff4b91";
    ctx.fillText("♡", centerX - 22, centerY - 14);
  }
}

function resizeOverlay() {
  const width = elements.video.clientWidth || 1;
  const height = elements.video.clientHeight || 1;
  const scale = window.devicePixelRatio || 1;
  if (elements.overlay.width === Math.round(width * scale) && elements.overlay.height === Math.round(height * scale)) return;
  elements.overlay.width = Math.round(width * scale);
  elements.overlay.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function clearOverlay() {
  ctx.clearRect(0, 0, elements.overlay.clientWidth, elements.overlay.clientHeight);
}

function stopCamera() {
  state.running = false;
  state.detecting = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  stopStream();
  elements.video.srcObject = null;
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  elements.handStatus.textContent = "未検出";
  elements.gestureStatus.textContent = "待機中";
  elements.gestureCard.classList.remove("is-heart");
  elements.cameraMessage.textContent = "「内カメラを開始」を押してください";
  elements.cameraMessage.classList.remove("is-hidden");
  elements.heartReaction.classList.remove("is-active");
  state.heartFrames = 0;
  state.heartActive = false;
  clearOverlay();
}

function stopStream() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

function primeReactionSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audioContext ||= new AudioContext();
  if (state.audioContext.state === "suspended") state.audioContext.resume().catch(() => {});
}

function playReactionSound() {
  primeReactionSound();
  const audioContext = state.audioContext;
  if (!audioContext) return;
  const now = audioContext.currentTime;
  [659.25, 783.99, 1046.5].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.09;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  });
}

function getCameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "内カメラの使用を許可してください";
  if (error?.name === "NotFoundError") return "内カメラが見つかりません";
  if (String(error?.message || "").includes("手検出")) return error.message;
  return "カメラまたは手検出モデルを開始できませんでした";
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

function pointToSegmentDistance(point, start, end) {
  const segment = vector(start, end);
  const lengthSquared = segment.x ** 2 + segment.y ** 2;
  if (!lengthSquared) return distance(point, start);
  const projection = clamp(((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / lengthSquared, 0, 1);
  return distance(point, {
    x: start.x + segment.x * projection,
    y: start.y + segment.y * projection,
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
