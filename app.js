const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const holdToggle = document.querySelector("#holdToggle");
const bearingText = document.querySelector("#bearingText");
const confidenceText = document.querySelector("#confidenceText");
const levelText = document.querySelector("#levelText");
const levelBar = document.querySelector("#levelBar");
const balanceText = document.querySelector("#balanceText");
const inputState = document.querySelector("#inputState");
const needle = document.querySelector("#needle");
const sweep = document.querySelector("#sweep");

const state = {
  audioContext: null,
  leftAnalyser: null,
  rightAnalyser: null,
  leftData: null,
  rightData: null,
  stream: null,
  channelCount: null,
  running: false,
  lastEstimate: null,
  smoothedScore: 0,
  smoothedConfidence: 0,
  stableDirection: "center",
  pendingDirection: null,
  pendingSince: 0,
};

const MIN_ACTIVE_DB = -58;
const CENTER_THRESHOLD = 0.08;
const DIRECTION_THRESHOLD = 0.22;
const MIN_CHANNEL_RATIO = 0.18;
const MAX_LAG = 24;
const LAG_WEIGHT = 0.06;
const SWITCH_HOLD_MS = 650;

startButton.addEventListener("click", start);
resetButton.addEventListener("click", resetMeasurements);

async function start() {
  startButton.disabled = true;
  startButton.innerHTML = '<span aria-hidden="true">&#9654;</span> 測定中';

  try {
    await startAudio();
    state.running = true;
    requestAnimationFrame(tick);
  } catch (error) {
    startButton.disabled = false;
    startButton.innerHTML = '<span aria-hidden="true">&#9654;</span> 測定開始';
    bearingText.textContent = "開始失敗";
    confidenceText.textContent = error.message || "マイクの許可を確認してください";
  }
}

async function startAudio() {
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: { ideal: 2 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  state.audioContext = new AudioContext();
  const source = state.audioContext.createMediaStreamSource(state.stream);
  const splitter = state.audioContext.createChannelSplitter(2);

  state.leftAnalyser = state.audioContext.createAnalyser();
  state.rightAnalyser = state.audioContext.createAnalyser();
  state.leftAnalyser.fftSize = 2048;
  state.rightAnalyser.fftSize = 2048;
  state.leftData = new Float32Array(state.leftAnalyser.fftSize);
  state.rightData = new Float32Array(state.rightAnalyser.fftSize);

  source.connect(splitter);
  splitter.connect(state.leftAnalyser, 0);
  splitter.connect(state.rightAnalyser, 1);

  const [track] = state.stream.getAudioTracks();
  const settings = track?.getSettings?.() || {};
  state.channelCount = settings.channelCount || null;
  inputState.textContent = state.channelCount >= 2
    ? `2ch入力を確認 (${state.channelCount}ch)`
    : "入力チャンネルを確認中";
}

function tick(now) {
  if (!state.running || !state.leftAnalyser || !state.rightAnalyser) return;

  state.leftAnalyser.getFloatTimeDomainData(state.leftData);
  state.rightAnalyser.getFloatTimeDomainData(state.rightData);

  const leftRms = getRms(state.leftData);
  const rightRms = getRms(state.rightData);
  const totalRms = (leftRms + rightRms) / 2;
  const db = 20 * Math.log10(Math.max(totalRms, 0.00001));
  const levelPercent = clamp((db + 70) / 45, 0, 1);

  levelText.textContent = `${Math.round(db)} dB`;
  levelBar.style.width = `${Math.round(levelPercent * 100)}%`;

  if (!holdToggle.checked) {
    state.lastEstimate = estimateDirection(leftRms, rightRms, db, now);
  }

  renderEstimate(state.lastEstimate);
  requestAnimationFrame(tick);
}

function estimateDirection(leftRms, rightRms, db, now) {
  if (db < MIN_ACTIVE_DB) {
    balanceText.textContent = "--";
    inputState.textContent = "音が小さすぎます";
    return { label: "音が小さい", angle: 0, confidence: 0, directional: false };
  }

  const loud = Math.max(leftRms, rightRms);
  const quiet = Math.min(leftRms, rightRms);
  const channelRatio = quiet / Math.max(loud, 0.000001);

  // Mono microphones often appear as left = signal, right = silence after splitting.
  // Treat that as unsupported instead of falsely saying "left".
  if (channelRatio < MIN_CHANNEL_RATIO) {
    balanceText.textContent = "単一";
    inputState.textContent = "単一入力のため左右判定不可";
    return { label: "方向不明", angle: 0, confidence: 0, directional: false };
  }

  const balance = (rightRms - leftRms) / Math.max(rightRms + leftRms, 0.000001);
  const lagScore = estimateLagScore(state.leftData, state.rightData);
  const score = clamp(balance * (1 - LAG_WEIGHT) + lagScore * LAG_WEIGHT, -1, 1);
  const rawConfidence = clamp((Math.abs(score) - DIRECTION_THRESHOLD) / 0.35, 0, 1);

  state.smoothedScore = state.smoothedScore * 0.88 + score * 0.12;
  state.smoothedConfidence = state.smoothedConfidence * 0.75 + rawConfidence * 0.25;

  const shownScore = state.smoothedScore;
  const direction = stabilizeDirection(shownScore, now);
  const confidence = direction === "center" ? 0.35 : state.smoothedConfidence;
  balanceText.textContent = `${shownScore > 0 ? "+" : ""}${shownScore.toFixed(2)}`;

  if (direction === "center") {
    inputState.textContent = "左右差は小さめ";
    return { label: "正面付近", angle: 0, confidence: 0.35, directional: true };
  }

  inputState.textContent = "左右差を検出";
  return direction === "right"
    ? { label: "右方向", angle: 90, confidence, directional: true }
    : { label: "左方向", angle: 270, confidence, directional: true };
}

function stabilizeDirection(score, now) {
  let nextDirection = state.stableDirection;

  if (Math.abs(score) <= CENTER_THRESHOLD) {
    nextDirection = "center";
  } else if (Math.abs(score) >= DIRECTION_THRESHOLD) {
    nextDirection = score > 0 ? "right" : "left";
  }

  if (nextDirection === state.stableDirection) {
    state.pendingDirection = null;
    state.pendingSince = 0;
    return state.stableDirection;
  }

  if (state.pendingDirection !== nextDirection) {
    state.pendingDirection = nextDirection;
    state.pendingSince = now;
    return state.stableDirection;
  }

  if (now - state.pendingSince >= SWITCH_HOLD_MS) {
    state.stableDirection = nextDirection;
    state.pendingDirection = null;
    state.pendingSince = 0;
  }

  return state.stableDirection;
}

function estimateLagScore(left, right) {
  let bestLag = 0;
  let bestCorrelation = -Infinity;

  for (let lag = -MAX_LAG; lag <= MAX_LAG; lag += 1) {
    let sum = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;

    for (let i = MAX_LAG; i < left.length - MAX_LAG; i += 1) {
      const leftValue = left[i];
      const rightValue = right[i + lag];
      sum += leftValue * rightValue;
      leftEnergy += leftValue * leftValue;
      rightEnergy += rightValue * rightValue;
    }

    const correlation = sum / Math.sqrt(Math.max(leftEnergy * rightEnergy, 0.000001));
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  // Positive lag means the right channel lines up later, so the sound likely came from the left.
  return clamp(-bestLag / MAX_LAG, -1, 1);
}

function renderEstimate(estimate) {
  if (!estimate) {
    bearingText.textContent = "--";
    confidenceText.textContent = "マイク入力待機中";
    needle.style.opacity = "0.3";
    sweep.style.opacity = "0.16";
    return;
  }

  const confidencePercent = Math.round(estimate.confidence * 100);

  bearingText.textContent = estimate.label;
  confidenceText.textContent = estimate.directional
    ? `信頼度 ${confidencePercent}%`
    : "この端末では静止したままの方向推定ができません";
  needle.style.transform = `rotate(${estimate.angle}deg)`;
  sweep.style.transform = `rotate(${estimate.angle}deg)`;
  needle.style.opacity = String(0.28 + estimate.confidence * 0.72);
  sweep.style.opacity = String(0.14 + estimate.confidence * 0.54);
}

function resetMeasurements() {
  state.lastEstimate = null;
  state.smoothedScore = 0;
  state.smoothedConfidence = 0;
  state.stableDirection = "center";
  state.pendingDirection = null;
  state.pendingSince = 0;
  balanceText.textContent = "--";
  inputState.textContent = "マイク待機中";
  renderEstimate(null);
}

function getRms(buffer) {
  let sum = 0;
  for (const value of buffer) {
    sum += value * value;
  }
  return Math.sqrt(sum / buffer.length);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
