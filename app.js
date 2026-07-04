const startButton = document.querySelector("#startButton");
const mirrorToggle = document.querySelector("#mirrorToggle");
const video = document.querySelector("#video");
const overlay = document.querySelector("#overlay");
const dogEyes = document.querySelector("#dogEyes");
const pupilGroup = document.querySelector("#pupilGroup");
const loadingState = document.querySelector("#loadingState");
const offsetText = document.querySelector("#offsetText");
const directionText = document.querySelector("#directionText");
const xOffsetText = document.querySelector("#xOffsetText");
const yOffsetText = document.querySelector("#yOffsetText");
const xDirectionText = document.querySelector("#xDirectionText");
const yDirectionText = document.querySelector("#yDirectionText");
const personCountText = document.querySelector("#personCountText");
const confidenceText = document.querySelector("#confidenceText");
const ctx = overlay.getContext("2d");

const state = {
  model: null,
  stream: null,
  running: false,
  rafId: null,
  detecting: false,
  eyeX: 0,
  eyeY: 0,
};

const PERSON_SCORE_MIN = 0.45;
const EYE_RANGE_X = 18;
const EYE_RANGE_Y = 13;

startButton.addEventListener("click", start);
mirrorToggle.addEventListener("change", updateMirrorMode);
window.addEventListener("resize", resizeOverlay);

async function start() {
  startButton.disabled = true;
  startButton.innerHTML = '<span aria-hidden="true">&#8987;</span> カメラ起動中';
  loadingState.textContent = "内カメラを起動中";

  try {
    await startCamera();
    state.running = true;
    startButton.innerHTML = '<span aria-hidden="true">&#8987;</span> モデル読み込み中';
    loadingState.textContent = "人物検知モデルを読み込み中";
    await loadModel();
    startButton.innerHTML = '<span aria-hidden="true">&#10003;</span> 検知中';
    loadingState.textContent = "人物を探しています";
    detectLoop();
  } catch (error) {
    startButton.disabled = false;
    startButton.innerHTML = '<span aria-hidden="true">&#9654;</span> カメラ開始';
    loadingState.textContent = "開始できませんでした";
    directionText.textContent = error.message || "カメラの許可を確認してください";
  }
}

async function loadModel() {
  if (state.model) return;
  if (!window.cocoSsd) {
    throw new Error("人物検知モデルを読み込めませんでした。通信状態を確認してください。");
  }
  state.model = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
}

async function startCamera() {
  stopCamera();

  const constraints = {
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  state.stream = await navigator.mediaDevices.getUserMedia(constraints);

  video.srcObject = state.stream;
  await video.play();
  updateMirrorMode();
  resizeOverlay();
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
}

function updateMirrorMode() {
  video.classList.toggle("mirrored", mirrorToggle.checked);
  overlay.classList.toggle("mirrored", mirrorToggle.checked);
}

function resizeOverlay() {
  const rect = video.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  overlay.width = Math.max(1, Math.round(rect.width * scale));
  overlay.height = Math.max(1, Math.round(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

async function detectLoop() {
  if (!state.running || state.detecting) return;
  state.detecting = true;

  try {
    const predictions = await state.model.detect(video);
    renderDetections(predictions);
  } catch (error) {
    loadingState.textContent = "検知でエラーが発生しました";
  } finally {
    state.detecting = false;
    state.rafId = requestAnimationFrame(detectLoop);
  }
}

function renderDetections(predictions) {
  resizeOverlay();
  const rect = video.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const people = predictions
    .filter((item) => item.class === "person" && item.score >= PERSON_SCORE_MIN)
    .sort((a, b) => b.score - a.score);

  personCountText.textContent = String(people.length);

  if (people.length === 0) {
    updateEyeTracking(0, 0);
    loadingState.textContent = "人物を探しています";
    offsetText.textContent = "--%";
    xOffsetText.textContent = "--%";
    yOffsetText.textContent = "--%";
    directionText.textContent = "人物が画面に入るとズレを表示します";
    xDirectionText.textContent = "--";
    yDirectionText.textContent = "--";
    confidenceText.textContent = "信頼度 --";
    return;
  }

  loadingState.textContent = "";
  const mainPerson = people[0];
  const metrics = getOffsetMetrics(mainPerson.bbox, video.videoWidth, video.videoHeight);
  const displayBox = toDisplayBox(mainPerson.bbox, rect.width, rect.height);
  updateEyeTracking(metrics.x, metrics.y);

  drawCenter(rect.width, rect.height);
  people.slice(0, 5).forEach((person, index) => {
    drawDetection(toDisplayBox(person.bbox, rect.width, rect.height), person.score, index === 0);
  });

  offsetText.textContent = `${metrics.total}%`;
  xOffsetText.textContent = `${Math.abs(metrics.x)}%`;
  yOffsetText.textContent = `${Math.abs(metrics.y)}%`;
  xDirectionText.textContent = metrics.x === 0 ? "中央" : metrics.x > 0 ? "右にズレ" : "左にズレ";
  yDirectionText.textContent = metrics.y === 0 ? "中央" : metrics.y > 0 ? "下にズレ" : "上にズレ";
  directionText.textContent = getDirectionLabel(metrics);
  confidenceText.textContent = `信頼度 ${Math.round(mainPerson.score * 100)}%`;

  drawOffsetLine(displayBox.centerX, displayBox.centerY, rect.width / 2, rect.height / 2);
}

function getOffsetMetrics([x, y, width, height], sourceWidth, sourceHeight) {
  const personCenterX = x + width / 2;
  const personCenterY = y + height / 2;
  const rawX = ((personCenterX - sourceWidth / 2) / (sourceWidth / 2)) * 100;
  const normalizedX = mirrorToggle.checked ? -rawX : rawX;
  const normalizedY = ((personCenterY - sourceHeight / 2) / (sourceHeight / 2)) * 100;
  const total = Math.hypot(normalizedX, normalizedY);

  return {
    x: Math.round(clamp(normalizedX, -100, 100)),
    y: Math.round(clamp(normalizedY, -100, 100)),
    total: Math.round(clamp(total, 0, 100)),
  };
}

function getDirectionLabel(metrics) {
  if (metrics.total <= 5) return "ほぼ中央です";

  const horizontal = Math.abs(metrics.x) <= 5 ? "" : metrics.x > 0 ? "右" : "左";
  const vertical = Math.abs(metrics.y) <= 5 ? "" : metrics.y > 0 ? "下" : "上";
  return `${vertical}${horizontal}へ${metrics.total}%ズレています`;
}

function updateEyeTracking(xPercent, yPercent) {
  const targetX = clamp(xPercent / 100, -1, 1) * EYE_RANGE_X;
  const targetY = clamp(yPercent / 100, -1, 1) * EYE_RANGE_Y;
  state.eyeX = state.eyeX * 0.72 + targetX * 0.28;
  state.eyeY = state.eyeY * 0.72 + targetY * 0.28;

  dogEyes.style.setProperty("--look-x", `${state.eyeX.toFixed(1)}px`);
  dogEyes.style.setProperty("--look-y", `${state.eyeY.toFixed(1)}px`);
  pupilGroup.setAttribute("transform", `translate(${state.eyeX.toFixed(1)} ${state.eyeY.toFixed(1)})`);
}

function toDisplayBox([x, y, width, height], displayWidth, displayHeight) {
  const scaleX = displayWidth / video.videoWidth;
  const scaleY = displayHeight / video.videoHeight;
  const left = x * scaleX;
  const top = y * scaleY;
  const boxWidth = width * scaleX;
  const boxHeight = height * scaleY;

  return {
    left,
    top,
    width: boxWidth,
    height: boxHeight,
    centerX: left + boxWidth / 2,
    centerY: top + boxHeight / 2,
  };
}

function drawCenter(width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawDetection(box, score, isPrimary) {
  ctx.save();
  ctx.strokeStyle = isPrimary ? "#2dd4bf" : "rgba(255, 255, 255, 0.66)";
  ctx.fillStyle = isPrimary ? "rgba(45, 212, 191, 0.16)" : "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = isPrimary ? 4 : 2;
  ctx.beginPath();
  ctx.roundRect(box.left, box.top, box.width, box.height, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isPrimary ? "#2dd4bf" : "rgba(255, 255, 255, 0.86)";
  ctx.beginPath();
  ctx.arc(box.centerX, box.centerY, isPrimary ? 7 : 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText(`${Math.round(score * 100)}%`, box.left + 10, Math.max(20, box.top - 8));
  ctx.restore();
}

function drawOffsetLine(personX, personY, centerX, centerY) {
  ctx.save();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(personX, personY);
  ctx.stroke();
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
