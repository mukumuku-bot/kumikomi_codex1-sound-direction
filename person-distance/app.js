const elements = {
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  cameraMessage: document.querySelector("#cameraMessage"),
  readout: document.querySelector("#readout"),
  distanceText: document.querySelector("#distanceText"),
  methodText: document.querySelector("#methodText"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
};

const state = {
  stream: null,
  personModel: null,
  faceDetector: null,
  running: false,
  detecting: false,
  rafId: null,
  distanceMeters: null,
  inTargetRange: false,
  signalAudioContext: null,
};

const PERSON_HEIGHT_METERS = 1.65;
const FACE_HEIGHT_METERS = 0.22;
const CAMERA_VERTICAL_FOV_DEGREES = 58;
const TARGET_DISTANCE_METERS = 2;
const TARGET_DISTANCE_EXIT_METERS = 2.15;
const ctx = elements.overlay.getContext("2d");

elements.startButton.addEventListener("click", startCamera);
elements.stopButton.addEventListener("click", stopCamera);
window.addEventListener("resize", resizeOverlay);

async function startCamera() {
  elements.startButton.disabled = true;
  elements.cameraMessage.textContent = "カメラと検出モデルを準備しています";
  elements.cameraMessage.classList.remove("is-hidden");
  primeSignalSound();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    elements.video.srcObject = state.stream;
    await elements.video.play();
    await loadModels();
    state.running = true;
    elements.stopButton.disabled = false;
    elements.cameraMessage.classList.add("is-hidden");
    resizeOverlay();
    detectLoop();
  } catch (error) {
    elements.cameraMessage.textContent = getCameraErrorMessage(error);
    elements.startButton.disabled = false;
  }
}

function stopCamera() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  elements.video.srcObject = null;
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  elements.distanceText.textContent = "--";
  elements.methodText.textContent = "人物を検出すると表示されます";
  setTargetRangeState(false, false);
  elements.cameraMessage.textContent = "カメラを開始してください";
  elements.cameraMessage.classList.remove("is-hidden");
  ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
}

async function loadModels() {
  if (!state.personModel) {
    state.personModel = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
  }

  if (!state.faceDetector && window.faceDetection) {
    try {
      const model = window.faceDetection.SupportedModels.MediaPipeFaceDetector;
      state.faceDetector = await window.faceDetection.createDetector(model, {
        runtime: "tfjs",
        maxFaces: 6,
      });
    } catch {
      state.faceDetector = null;
    }
  }
}

async function detectLoop() {
  if (!state.running || state.detecting) return;
  state.detecting = true;

  try {
    const predictions = await state.personModel.detect(elements.video);
    const faces = state.faceDetector
      ? await state.faceDetector.estimateFaces(elements.video, { flipHorizontal: false })
      : [];
    renderDetection(predictions, faces);
  } catch {
    elements.methodText.textContent = "検出中にエラーが発生しました";
  } finally {
    state.detecting = false;
    if (state.running) state.rafId = requestAnimationFrame(detectLoop);
  }
}

function renderDetection(predictions, faces) {
  resizeOverlay();
  const frameWidth = elements.video.videoWidth;
  const frameHeight = elements.video.videoHeight;
  const people = predictions
    .filter((item) => item.class === "person" && item.score >= 0.45)
    .sort((a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3]);
  const mainPerson = people[0] || null;
  const faceBboxes = faces.map(getFaceBbox).filter((bbox) => bbox[2] > 0 && bbox[3] > 0);
  const mainFace = mainPerson ? findFaceInPerson(mainPerson.bbox, faceBboxes) : largestBox(faceBboxes);
  const sourceBox = mainFace || mainPerson?.bbox || null;
  const referenceHeight = mainFace ? FACE_HEIGHT_METERS : PERSON_HEIGHT_METERS;

  clearOverlay();
  if (!sourceBox || !frameWidth || !frameHeight) {
    state.distanceMeters = null;
    setTargetRangeState(false, false);
    elements.distanceText.textContent = "--";
    elements.methodText.textContent = "人物を検出できません";
    return;
  }

  const measured = estimateDistanceMeters(sourceBox, frameHeight, referenceHeight);
  const distance = smoothDistance(measured);
  setTargetRangeState(isInTargetRange(distance), true);
  drawBox(sourceBox, mainFace ? "顔" : "人物");
  elements.distanceText.textContent = `${distance.toFixed(1)} m`;
  elements.methodText.textContent = state.inTargetRange
    ? `2m以内を検知しました / ${mainFace ? "顔" : "人物"}の大きさから推定`
    : `${mainFace ? "顔" : "人物"}の大きさから推定`;
}

function getFaceBbox(face) {
  const box = face.box || {};
  const x = box.xMin ?? box.x ?? 0;
  const y = box.yMin ?? box.y ?? 0;
  const width = box.width ?? Math.max(0, (box.xMax ?? 0) - x);
  const height = box.height ?? Math.max(0, (box.yMax ?? 0) - y);
  return [x, y, width, height];
}

function findFaceInPerson(personBbox, faces) {
  const [personX, personY, personWidth, personHeight] = personBbox;
  return faces
    .filter(([x, y, width, height]) => {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      return centerX >= personX
        && centerX <= personX + personWidth
        && centerY >= personY
        && centerY <= personY + personHeight;
    })
    .sort((a, b) => b[2] * b[3] - a[2] * a[3])[0] || null;
}

function largestBox(boxes) {
  return [...boxes].sort((a, b) => b[2] * b[3] - a[2] * a[3])[0] || null;
}

function estimateDistanceMeters(bbox, frameHeight, referenceHeightMeters) {
  const pixelHeight = bbox[3];
  const heightRatio = pixelHeight / frameHeight;
  const halfFovRadians = (CAMERA_VERTICAL_FOV_DEGREES * Math.PI) / 360;
  const estimated = referenceHeightMeters / (2 * heightRatio * Math.tan(halfFovRadians));
  return Math.min(12, Math.max(0.25, estimated));
}

function smoothDistance(measured) {
  state.distanceMeters = Number.isFinite(state.distanceMeters)
    ? state.distanceMeters * 0.72 + measured * 0.28
    : measured;
  return state.distanceMeters;
}

function isInTargetRange(distance) {
  return state.inTargetRange ? distance <= TARGET_DISTANCE_EXIT_METERS : distance <= TARGET_DISTANCE_METERS;
}

function setTargetRangeState(isInRange, playSignal) {
  const enteredRange = isInRange && !state.inTargetRange;
  state.inTargetRange = isInRange;
  elements.readout.classList.toggle("is-in-range", isInRange);
  if (enteredRange && playSignal) playRangeSignal();
}

function primeSignalSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.signalAudioContext ||= new AudioContext();
  if (state.signalAudioContext.state === "suspended") {
    state.signalAudioContext.resume().catch(() => {});
  }
}

function playRangeSignal() {
  primeSignalSound();
  const audioContext = state.signalAudioContext;
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [0, 0.15].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(index ? 880 : 660, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.11);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.12);
  });
}

function resizeOverlay() {
  const width = elements.video.clientWidth || 1;
  const height = elements.video.clientHeight || 1;
  const scale = window.devicePixelRatio || 1;
  elements.overlay.width = Math.round(width * scale);
  elements.overlay.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function clearOverlay() {
  ctx.clearRect(0, 0, elements.overlay.clientWidth, elements.overlay.clientHeight);
}

function drawBox(bbox, label) {
  const scaleX = elements.overlay.clientWidth / elements.video.videoWidth;
  const scaleY = elements.overlay.clientHeight / elements.video.videoHeight;
  const [x, y, width, height] = bbox;
  ctx.strokeStyle = "#61b4ff";
  ctx.fillStyle = "#61b4ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);
  ctx.font = "700 15px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(label, x * scaleX + 6, Math.max(20, y * scaleY - 8));
}

function getCameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "カメラの使用を許可してください";
  if (error?.name === "NotFoundError") return "カメラが見つかりません";
  return "カメラを開始できませんでした";
}
