const routes = ["settings", "product", "check", "running"];
const defaultSettings = {
  dogName: "ポチ",
  password: "",
};

const settings = loadSettings();
const elements = {
  tabs: document.querySelectorAll("[data-route]"),
  pages: document.querySelectorAll("[data-page]"),
  settingsForm: document.querySelector("#settingsForm"),
  settingDogName: document.querySelector("#settingDogName"),
  settingPassword: document.querySelector("#settingPassword"),
  resetSettingsButton: document.querySelector("#resetSettingsButton"),
  browserDot: document.querySelector("#browserDot"),
  cameraDot: document.querySelector("#cameraDot"),
  modelDot: document.querySelector("#modelDot"),
  micDot: document.querySelector("#micDot"),
  speechDot: document.querySelector("#speechDot"),
  barkDot: document.querySelector("#barkDot"),
  browserCheckText: document.querySelector("#browserCheckText"),
  cameraCheckText: document.querySelector("#cameraCheckText"),
  modelCheckText: document.querySelector("#modelCheckText"),
  micCheckText: document.querySelector("#micCheckText"),
  speechCheckText: document.querySelector("#speechCheckText"),
  barkCheckText: document.querySelector("#barkCheckText"),
  checkTranscriptText: document.querySelector("#checkTranscriptText"),
  volumeText: document.querySelector("#volumeText"),
  volumeBar: document.querySelector("#volumeBar"),
  browserCheckButton: document.querySelector("#browserCheckButton"),
  cameraCheckButton: document.querySelector("#cameraCheckButton"),
  modelCheckButton: document.querySelector("#modelCheckButton"),
  micCheckButton: document.querySelector("#micCheckButton"),
  speechCheckButton: document.querySelector("#speechCheckButton"),
  runAllChecksButton: document.querySelector("#runAllChecksButton"),
  barkCheckButton: document.querySelector("#barkCheckButton"),
  barkTriggerButtons: document.querySelectorAll("[data-bark-trigger]"),
  startRunButton: document.querySelector("#startRunButton"),
  stopRunButton: document.querySelector("#stopRunButton"),
  dogEyes: document.querySelector("#dogEyes"),
  pupilGroup: document.querySelector("#pupilGroup"),
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  runStatusText: document.querySelector("#runStatusText"),
  personCountText: document.querySelector("#personCountText"),
  directionText: document.querySelector("#directionText"),
  confidenceText: document.querySelector("#confidenceText"),
  speechPanel: document.querySelector("#speechPanel"),
  transcriptionStatus: document.querySelector("#transcriptionStatus"),
  transcribeButton: document.querySelector("#transcribeButton"),
  transcriptText: document.querySelector("#transcriptText"),
};

const runState = {
  model: null,
  stream: null,
  running: false,
  detecting: false,
  rafId: null,
  eyeX: 0,
  eyeY: 0,
  sleeping: false,
};

const speechState = {
  recognition: null,
  supported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  listening: false,
  shouldListen: false,
  finalText: "",
  interimText: "",
  lastCommandKey: "",
  lastCommandAt: 0,
  audioContext: null,
  volumeStream: null,
  volumeAudioContext: null,
  volumeAnalyser: null,
  volumeData: null,
  volumeRafId: null,
};

const ctx = elements.overlay.getContext("2d");
const EYE_RANGE_X = 30;
const EYE_RANGE_Y = 20;

window.addEventListener("hashchange", showRouteFromHash);
window.addEventListener("resize", resizeOverlay);
elements.settingsForm.addEventListener("submit", saveSettingsFromForm);
elements.resetSettingsButton.addEventListener("click", resetSettings);
elements.browserCheckButton.addEventListener("click", checkBrowser);
elements.cameraCheckButton.addEventListener("click", checkCamera);
elements.modelCheckButton.addEventListener("click", checkModel);
elements.micCheckButton.addEventListener("click", checkMic);
elements.speechCheckButton.addEventListener("click", checkSpeech);
elements.runAllChecksButton.addEventListener("click", runAllChecks);
elements.barkCheckButton.addEventListener("click", checkBark);
elements.barkTriggerButtons.forEach((button) => button.addEventListener("click", checkBark));
elements.startRunButton.addEventListener("click", startRun);
elements.stopRunButton.addEventListener("click", stopRun);
elements.transcribeButton.addEventListener("click", toggleTranscription);

applySettingsToForm();
setupTranscription();
checkBrowser();
showRouteFromHash();
scheduleBlink();

function showRouteFromHash() {
  const route = window.location.hash.replace("#", "") || "product";
  const currentRoute = routes.includes(route) ? route : "product";

  elements.pages.forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === currentRoute);
  });

  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === currentRoute);
  });

  document.body.classList.toggle("is-running-page", currentRoute === "running");

  if (currentRoute !== "running" && currentRoute !== "check") {
    stopHiddenTranscription();
  }

  if (currentRoute !== "check") {
    stopVolumeMeter();
  }
}

function applySettingsToForm() {
  elements.settingDogName.value = settings.dogName;
  elements.settingPassword.value = settings.password;
}

function saveSettingsFromForm(event) {
  event.preventDefault();
  settings.dogName = elements.settingDogName.value.trim() || defaultSettings.dogName;
  settings.password = elements.settingPassword.value;
  localStorage.setItem("watch-system-settings", JSON.stringify(settings));
  elements.runStatusText.textContent = "設定を保存しました";
}

function resetSettings() {
  Object.assign(settings, defaultSettings);
  localStorage.removeItem("watch-system-settings");
  applySettingsToForm();
  elements.runStatusText.textContent = "設定を初期化しました";
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("watch-system-settings")) || {};
    return {
      dogName: saved.dogName || defaultSettings.dogName,
      password: saved.password || defaultSettings.password,
    };
  } catch {
    return { ...defaultSettings };
  }
}

function setCheck(dot, textElement, status, message) {
  dot.classList.remove("is-ok", "is-warn", "is-bad");
  dot.classList.add(status);
  textElement.textContent = message;
}

function checkBrowser() {
  const secure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const media = Boolean(navigator.mediaDevices?.getUserMedia);

  if (secure && media) {
    setCheck(elements.browserDot, elements.browserCheckText, "is-ok", "カメラとマイクを使えるブラウザです");
  } else if (media) {
    setCheck(elements.browserDot, elements.browserCheckText, "is-warn", "HTTPSまたはlocalhostで開くと安定します");
  } else {
    setCheck(elements.browserDot, elements.browserCheckText, "is-bad", "このブラウザではカメラやマイクを使えません");
  }
}

async function checkCamera() {
  setCheck(elements.cameraDot, elements.cameraCheckText, "is-warn", "確認中です");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stopStream(stream);
    setCheck(elements.cameraDot, elements.cameraCheckText, "is-ok", "カメラを利用できます");
  } catch (error) {
    setCheck(elements.cameraDot, elements.cameraCheckText, "is-bad", getMediaErrorMessage(error, "カメラ"));
  }
}

async function checkModel() {
  setCheck(elements.modelDot, elements.modelCheckText, "is-warn", "人物検出モデルを読み込み中です");

  try {
    await loadModel();
    setCheck(elements.modelDot, elements.modelCheckText, "is-ok", "人物検出モデルを利用できます");
  } catch {
    setCheck(elements.modelDot, elements.modelCheckText, "is-bad", "人物検出モデルを読み込めません。通信状態を確認してください");
  }
}

async function checkMic() {
  setCheck(elements.micDot, elements.micCheckText, "is-warn", "確認中です");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stopStream(stream);
    setCheck(elements.micDot, elements.micCheckText, "is-ok", "マイクを利用できます");
  } catch (error) {
    setCheck(elements.micDot, elements.micCheckText, "is-bad", getMediaErrorMessage(error, "マイク"));
  }
}

function checkSpeech() {
  if (speechState.supported) {
    setCheck(elements.speechDot, elements.speechCheckText, "is-ok", "名前を呼ぶ確認を開始しました");
    elements.checkTranscriptText.textContent = "聞き取り中です";
    startHiddenTranscription();
    startVolumeMeter();
  } else {
    setCheck(elements.speechDot, elements.speechCheckText, "is-warn", "このブラウザは音声認識に未対応です");
  }
}

function checkBark() {
  const audioContext = ensureBarkAudio();
  if (!audioContext) {
    setCheck(elements.barkDot, elements.barkCheckText, "is-bad", "このブラウザでは音を再生できません");
    return;
  }

  bark(1);
  setCheck(elements.barkDot, elements.barkCheckText, "is-ok", "鳴き声を再生しました");
}

async function runAllChecks() {
  elements.runAllChecksButton.disabled = true;
  checkBrowser();
  await checkCamera();
  await checkModel();
  await checkMic();
  checkBark();
  checkSpeech();
  elements.runAllChecksButton.disabled = false;
}

function getMediaErrorMessage(error, label) {
  if (error?.name === "NotAllowedError") return `${label}の使用が許可されていません`;
  if (error?.name === "NotFoundError") return `${label}が見つかりません`;
  return `${label}を開始できませんでした`;
}

async function startRun() {
  elements.startRunButton.disabled = true;
  elements.runStatusText.textContent = "カメラを起動しています";
  ensureBarkAudio();

  try {
    stopRun();
    elements.startRunButton.disabled = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    runState.stream = stream;
    elements.video.srcObject = stream;
    await elements.video.play();
    runState.running = true;
    elements.stopRunButton.disabled = false;
    elements.runStatusText.textContent = "人物検出モデルを読み込んでいます";
    await loadModel();
    elements.runStatusText.textContent = "人物を探しています";
    startHiddenTranscription();
    detectLoop();
  } catch (error) {
    elements.runStatusText.textContent = getMediaErrorMessage(error, "カメラ");
    elements.startRunButton.disabled = false;
    elements.stopRunButton.disabled = true;
  }
}

function stopRun() {
  runState.running = false;
  runState.detecting = false;
  stopHiddenTranscription();
  if (runState.rafId) cancelAnimationFrame(runState.rafId);
  stopStream(runState.stream);
  runState.stream = null;
  elements.video.srcObject = null;
  elements.startRunButton.disabled = false;
  elements.stopRunButton.disabled = true;
  elements.personCountText.textContent = "0";
  elements.directionText.textContent = "停止中";
  elements.confidenceText.textContent = "--";
  elements.runStatusText.textContent = "停止しました";
  sleepEyes();
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function loadModel() {
  if (runState.model) return;
  if (!window.cocoSsd) {
    throw new Error("人物検出モデルを読み込めませんでした");
  }
  runState.model = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
}

function resizeOverlay() {
  const scale = window.devicePixelRatio || 1;
  const width = elements.video.videoWidth || elements.overlay.clientWidth || 1;
  const height = elements.video.videoHeight || elements.overlay.clientHeight || 1;
  elements.overlay.width = Math.max(1, Math.round(width * scale));
  elements.overlay.height = Math.max(1, Math.round(height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

async function detectLoop() {
  if (!runState.running || runState.detecting) return;
  runState.detecting = true;

  try {
    resizeOverlay();
    const predictions = await runState.model.detect(elements.video);
    renderDetections(predictions);
  } catch {
    elements.runStatusText.textContent = "検出中にエラーが発生しました";
  } finally {
    runState.detecting = false;
    if (runState.running) runState.rafId = requestAnimationFrame(detectLoop);
  }
}

function renderDetections(predictions) {
  const frameWidth = elements.video.videoWidth || elements.overlay.width;
  const frameHeight = elements.video.videoHeight || elements.overlay.height;
  const minScore = 0.45;
  const people = predictions
    .filter((item) => item.class === "person" && item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  elements.personCountText.textContent = String(people.length);

  if (!people.length) {
    sleepEyes();
    updateEyeTracking(0, 0);
    elements.runStatusText.textContent = "人物を探しています";
    elements.directionText.textContent = "未検出";
    elements.confidenceText.textContent = "--";
    return;
  }

  wakeEyes();
  const mainPerson = people[0];
  const metrics = getOffsetMetrics(mainPerson.bbox, frameWidth, frameHeight);
  updateEyeTracking(metrics.x, metrics.y);
  elements.runStatusText.textContent = "検出中";
  elements.directionText.textContent = getDirectionLabel(metrics);
  elements.confidenceText.textContent = `${Math.round(mainPerson.score * 100)}%`;
}

function getOffsetMetrics([x, y, width, height], sourceWidth, sourceHeight) {
  const personCenterX = x + width / 2;
  const personCenterY = y + height / 2;
  const rawX = ((personCenterX - sourceWidth / 2) / (sourceWidth / 2)) * 100;
  const normalizedX = -rawX;
  const normalizedY = ((personCenterY - sourceHeight / 2) / (sourceHeight / 2)) * 100;
  const total = Math.hypot(normalizedX, normalizedY);

  return {
    x: Math.round(clamp(normalizedX, -100, 100)),
    y: Math.round(clamp(normalizedY, -100, 100)),
    total: Math.round(clamp(total, 0, 100)),
  };
}

function getDirectionLabel(metrics) {
  if (metrics.total <= 5) return "ほぼ中央";
  const horizontal = Math.abs(metrics.x) <= 5 ? "" : metrics.x > 0 ? "右" : "左";
  const vertical = Math.abs(metrics.y) <= 5 ? "" : metrics.y > 0 ? "下" : "上";
  return `${vertical}${horizontal}へ${metrics.total}%`;
}

function updateEyeTracking(xPercent, yPercent) {
  const targetX = clamp(xPercent / 100, -1, 1) * EYE_RANGE_X;
  const targetY = clamp(yPercent / 100, -1, 1) * EYE_RANGE_Y;
  runState.eyeX = runState.eyeX * 0.72 + targetX * 0.28;
  runState.eyeY = runState.eyeY * 0.72 + targetY * 0.28;
  elements.pupilGroup.setAttribute("transform", `translate(${runState.eyeX.toFixed(1)} ${runState.eyeY.toFixed(1)})`);
}

function scheduleBlink() {
  const delay = 1800 + Math.random() * 3200;
  setTimeout(() => {
    blinkEyes();
    scheduleBlink();
  }, delay);
}

function blinkEyes() {
  if (runState.sleeping) return;
  elements.dogEyes.classList.add("is-blinking");
  setTimeout(() => elements.dogEyes.classList.remove("is-blinking"), 130);
}

function sleepEyes() {
  if (runState.sleeping) return;
  runState.sleeping = true;
  elements.dogEyes.classList.remove("is-blinking");
  elements.dogEyes.classList.add("is-sleeping");
}

function wakeEyes() {
  if (!runState.sleeping) return;
  runState.sleeping = false;
  elements.dogEyes.classList.remove("is-sleeping");
  blinkEyes();
}

function setupTranscription() {
  if (!speechState.supported) {
    elements.transcribeButton.disabled = true;
    elements.transcriptionStatus.textContent = "未対応";
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "ja-JP";

  recognition.addEventListener("start", () => {
    speechState.listening = true;
    elements.transcriptionStatus.textContent = "聞き取り中";
    elements.transcribeButton.textContent = "停止";
  });

  recognition.addEventListener("result", (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) {
        const finalPiece = piece.trim();
        speechState.finalText += `${finalPiece}\n`;
        handleVoiceCommand(finalPiece);
      } else {
        interim += piece;
      }
    }
    speechState.interimText = interim.trim();
    renderTranscript();
  });

  recognition.addEventListener("end", () => {
    speechState.listening = false;
    speechState.interimText = "";
    elements.transcriptionStatus.textContent = elements.transcriptText.value.trim() ? "停止中" : "待機中";
    elements.transcribeButton.textContent = "文字起こし開始";
    renderTranscript();
    if (speechState.shouldListen) {
      window.setTimeout(startHiddenTranscription, 450);
    }
  });

  recognition.addEventListener("error", (event) => {
    speechState.listening = false;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      speechState.shouldListen = false;
      setCheck(elements.speechDot, elements.speechCheckText, "is-bad", "マイクまたは音声認識が許可されていません");
      stopVolumeMeter();
    } else {
      setCheck(elements.speechDot, elements.speechCheckText, "is-warn", "音声認識を開始できませんでした");
    }
    elements.transcriptionStatus.textContent = event.error === "not-allowed" ? "権限なし" : "エラー";
    elements.transcribeButton.textContent = "文字起こし開始";
  });

  speechState.recognition = recognition;
}

function toggleTranscription() {
  if (!speechState.recognition) return;
  if (speechState.listening) {
    speechState.recognition.stop();
    return;
  }

  speechState.recognition.lang = "ja-JP";
  try {
    speechState.recognition.start();
  } catch {
    elements.transcriptionStatus.textContent = "起動待ち";
  }
}

function startHiddenTranscription() {
  if (!speechState.recognition || speechState.listening) return;
  speechState.shouldListen = true;
  speechState.recognition.lang = "ja-JP";
  ensureBarkAudio();
  setCheck(elements.speechDot, elements.speechCheckText, "is-ok", "聞き取り中です。名前を呼ぶと鳴きます");

  try {
    speechState.recognition.start();
  } catch {
    elements.transcriptionStatus.textContent = "起動待ち";
  }
}

function stopHiddenTranscription() {
  speechState.shouldListen = false;
  if (speechState.recognition && speechState.listening) {
    speechState.recognition.stop();
  }
}

async function startVolumeMeter() {
  if (speechState.volumeAnalyser) return;

  try {
    speechState.volumeStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    speechState.volumeAudioContext = new AudioContext();
    const source = speechState.volumeAudioContext.createMediaStreamSource(speechState.volumeStream);
    speechState.volumeAnalyser = speechState.volumeAudioContext.createAnalyser();
    speechState.volumeAnalyser.fftSize = 1024;
    speechState.volumeData = new Uint8Array(speechState.volumeAnalyser.fftSize);
    source.connect(speechState.volumeAnalyser);
    updateVolumeMeter();
  } catch {
    elements.volumeText.textContent = "--";
    elements.volumeBar.style.width = "0%";
    setCheck(elements.micDot, elements.micCheckText, "is-bad", "マイク音量を取得できません");
  }
}

function stopVolumeMeter() {
  if (speechState.volumeRafId) cancelAnimationFrame(speechState.volumeRafId);
  speechState.volumeRafId = null;
  speechState.volumeStream?.getTracks().forEach((track) => track.stop());
  speechState.volumeStream = null;
  speechState.volumeAudioContext?.close?.().catch(() => {});
  speechState.volumeAudioContext = null;
  speechState.volumeAnalyser = null;
  speechState.volumeData = null;
  elements.volumeText.textContent = "0%";
  elements.volumeBar.style.width = "0%";
}

function updateVolumeMeter() {
  if (!speechState.volumeAnalyser || !speechState.volumeData) return;

  speechState.volumeAnalyser.getByteTimeDomainData(speechState.volumeData);
  let sum = 0;
  for (const value of speechState.volumeData) {
    const normalized = (value - 128) / 128;
    sum += normalized * normalized;
  }

  const rms = Math.sqrt(sum / speechState.volumeData.length);
  const percent = Math.min(100, Math.round(rms * 260));
  elements.volumeText.textContent = `${percent}%`;
  elements.volumeBar.style.width = `${percent}%`;
  speechState.volumeRafId = requestAnimationFrame(updateVolumeMeter);
}

function handleVoiceCommand(text) {
  const dogName = normalizeSpeech(settings.dogName || defaultSettings.dogName);
  const heard = normalizeSpeech(text);
  if (!dogName || !heard.includes(dogName)) return;

  const barkCount = heard.includes("おいで") ? 2 : 1;
  const commandKey = `${barkCount}:${heard}`;
  const now = Date.now();
  if (speechState.lastCommandKey === commandKey && now - speechState.lastCommandAt < 1800) return;

  speechState.lastCommandKey = commandKey;
  speechState.lastCommandAt = now;
  bark(barkCount);
}

function normalizeSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\\s　、。,.!！?？「」『』"']/g, "");
}

function ensureBarkAudio() {
  if (!speechState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    speechState.audioContext = new AudioContext();
  }

  if (speechState.audioContext.state === "suspended") {
    speechState.audioContext.resume().catch(() => {});
  }

  return speechState.audioContext;
}

function bark(count) {
  const audioContext = ensureBarkAudio();
  if (!audioContext) return;

  for (let index = 0; index < count; index += 1) {
    window.setTimeout(() => playBark(audioContext), index * 260);
  }
}

function playBark(audioContext) {
  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  const tone = audioContext.createOscillator();
  const growl = audioContext.createOscillator();

  tone.type = "square";
  growl.type = "sawtooth";
  tone.frequency.setValueAtTime(720, now);
  tone.frequency.exponentialRampToValueAtTime(380, now + 0.16);
  growl.frequency.setValueAtTime(190, now);
  growl.frequency.exponentialRampToValueAtTime(120, now + 0.16);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  tone.connect(gain);
  growl.connect(gain);
  gain.connect(audioContext.destination);
  tone.start(now);
  growl.start(now);
  tone.stop(now + 0.19);
  growl.stop(now + 0.19);
}

function renderTranscript() {
  const divider = speechState.finalText && speechState.interimText ? "\n" : "";
  const transcript = `${speechState.finalText}${divider}${speechState.interimText}`.trimStart();
  elements.transcriptText.value = transcript;
  elements.transcriptText.scrollTop = elements.transcriptText.scrollHeight;
  elements.checkTranscriptText.textContent = transcript.trim() || "聞き取り中です";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistration("./").then((registration) => {
    if (registration) registration.unregister();
  });
}
