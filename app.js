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
const transcribeButton = document.querySelector("#transcribeButton");
const languageSelect = document.querySelector("#languageSelect");
const copyTranscriptButton = document.querySelector("#copyTranscriptButton");
const downloadTranscriptButton = document.querySelector("#downloadTranscriptButton");
const clearTranscriptButton = document.querySelector("#clearTranscriptButton");
const transcriptText = document.querySelector("#transcriptText");
const transcriptionStatus = document.querySelector("#transcriptionStatus");
const transcriptionHelp = document.querySelector("#transcriptionHelp");

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

const transcriptionState = {
  recognition: null,
  supported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  listening: false,
  finalText: "",
  interimText: "",
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
transcribeButton.addEventListener("click", toggleTranscription);
copyTranscriptButton.addEventListener("click", copyTranscript);
downloadTranscriptButton.addEventListener("click", downloadTranscript);
clearTranscriptButton.addEventListener("click", clearTranscript);
languageSelect.addEventListener("change", () => {
  if (transcriptionState.recognition) {
    transcriptionState.recognition.lang = languageSelect.value;
  }
});

setupTranscription();

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

  // Mono microphones can appear as left = signal, right = silence after splitting.
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

function setupTranscription() {
  if (!transcriptionState.supported) {
    transcribeButton.disabled = true;
    transcriptionStatus.textContent = "非対応";
    transcriptionHelp.textContent = "このブラウザは音声認識に対応していません。AndroidのChromeなどで開いてください。";
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelect.value;

  recognition.addEventListener("start", () => {
    transcriptionState.listening = true;
    transcriptionStatus.textContent = "聞き取り中";
    transcribeButton.innerHTML = '<span aria-hidden="true">&#9632;</span> 停止';
  });

  recognition.addEventListener("result", (event) => {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) {
        transcriptionState.finalText += `${piece.trim()}\n`;
      } else {
        interim += piece;
      }
    }

    transcriptionState.interimText = interim.trim();
    renderTranscript();
  });

  recognition.addEventListener("end", () => {
    transcriptionState.listening = false;
    transcriptionState.interimText = "";
    transcriptionStatus.textContent = transcriptText.value.trim() ? "停止中" : "待機中";
    transcribeButton.innerHTML = '<span aria-hidden="true">&#9679;</span> 文字起こし開始';
    renderTranscript();
  });

  recognition.addEventListener("error", (event) => {
    transcriptionState.listening = false;
    transcriptionStatus.textContent = "エラー";
    transcriptionHelp.textContent = getRecognitionErrorMessage(event.error);
  });

  transcriptionState.recognition = recognition;
}

function toggleTranscription() {
  if (!transcriptionState.recognition) return;

  if (transcriptionState.listening) {
    transcriptionState.recognition.stop();
    return;
  }

  transcriptionHelp.textContent = "話した内容が下に表示されます。必要に応じてコピーまたは保存できます。";
  transcriptionState.recognition.lang = languageSelect.value;

  try {
    transcriptionState.recognition.start();
  } catch (error) {
    transcriptionStatus.textContent = "起動待ち";
  }
}

function renderTranscript() {
  const divider = transcriptionState.finalText && transcriptionState.interimText ? "\n" : "";
  transcriptText.value = `${transcriptionState.finalText}${divider}${transcriptionState.interimText}`.trimStart();
  transcriptText.scrollTop = transcriptText.scrollHeight;
}

async function copyTranscript() {
  const text = transcriptText.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    transcriptionStatus.textContent = "コピー済み";
  } catch (error) {
    transcriptText.select();
    document.execCommand("copy");
    transcriptionStatus.textContent = "コピー済み";
  }
}

function downloadTranscript() {
  const text = transcriptText.value.trim();
  if (!text) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcript-${timestamp}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  transcriptionStatus.textContent = "保存しました";
}

function clearTranscript() {
  transcriptionState.finalText = "";
  transcriptionState.interimText = "";
  transcriptText.value = "";
  transcriptionStatus.textContent = transcriptionState.listening ? "聞き取り中" : "待機中";
}

function getRecognitionErrorMessage(errorCode) {
  const messages = {
    "audio-capture": "マイクが見つかりません。端末のマイク設定を確認してください。",
    "not-allowed": "マイクの使用が許可されていません。ブラウザの権限設定を確認してください。",
    network: "音声認識サービスに接続できません。通信状態を確認してください。",
    "no-speech": "音声を検出できませんでした。もう一度話してください。",
  };

  return messages[errorCode] || "文字起こしを開始できませんでした。ブラウザや権限設定を確認してください。";
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
