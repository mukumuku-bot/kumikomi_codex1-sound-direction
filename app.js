import { analyzeCircleGesture } from "./hand-gesture/circle-gesture.mjs";

const routes = ["account", "settings", "product", "check", "running"];
const protectedRoutes = ["settings", "check", "running"];
const defaultSettings = {
  dogName: "ポチ",
};

const settings = loadSettings();
const elements = {
  tabs: document.querySelectorAll("[data-route]"),
  authModeLinks: document.querySelectorAll("[data-auth-mode]"),
  headerLogoutButton: document.querySelector("#headerLogoutButton"),
  pages: document.querySelectorAll("[data-page]"),
  accountStatus: document.querySelector("#accountStatus"),
  signUpForm: document.querySelector("#signUpForm"),
  signUpEmail: document.querySelector("#signUpEmail"),
  signUpPassword: document.querySelector("#signUpPassword"),
  signUpDogName: document.querySelector("#signUpDogName"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  resendConfirmationButton: document.querySelector("#resendConfirmationButton"),
  logoutButton: document.querySelector("#logoutButton"),
  currentAccountText: document.querySelector("#currentAccountText"),
  currentDogNameText: document.querySelector("#currentDogNameText"),
  settingsForm: document.querySelector("#settingsForm"),
  settingDogName: document.querySelector("#settingDogName"),
  settingsSaveMessage: document.querySelector("#settingsSaveMessage"),
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
  replyText: document.querySelector("#replyText"),
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
  runScreen: document.querySelector(".person-run-screen"),
  dogEyes: document.querySelector("#dogEyes"),
  pupilGroup: document.querySelector("#pupilGroup"),
  runStage: document.querySelector(".run-stage"),
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
  diagnosticFrames: document.querySelectorAll("[data-src].diagnostic-frame"),
};

const runState = {
  model: null,
  faceDetector: null,
  handDetector: null,
  stream: null,
  running: false,
  detecting: false,
  rafId: null,
  eyeX: 0,
  eyeY: 0,
  sleeping: false,
  emotion: "normal",
  emotionTimer: null,
  emotionFadeTimer: null,
  command: "待機",
  pulseCommand: "",
  pulseTimer: null,
  followRequested: false,
  personVisible: false,
  absenceActive: false,
  absenceSadnessTimer: null,
  absenceSleepTimer: null,
  trackedCenter: null,
  coveredFrames: 0,
  circleFrames: 0,
  circleActive: false,
  lastHandDetectionAt: 0,
};

const speechState = {
  recognition: null,
  supported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  listening: false,
  shouldListen: false,
  mode: null,
  serverListening: false,
  serverStream: null,
  serverOwnsStream: false,
  serverTimer: null,
  serverStopTimer: null,
  serverRecorder: null,
  serverSending: false,
  finalText: "",
  interimText: "",
  lastCommandKey: "",
  lastCommandAt: 0,
  speakingUntil: 0,
  discardUntil: 0,
  chatHistory: [],
  chatSending: false,
  audioContext: null,
  volumeStream: null,
  volumeAudioContext: null,
  volumeAnalyser: null,
  volumeData: null,
  volumeRafId: null,
  volumeOwnsStream: false,
  barkSampleBuffer: null,
  barkSampleLoading: null,
  barkNoiseBuffer: null,
};

const supabaseConfig = window.SMARTPHONE_DOG_SUPABASE || {};
const supabaseClient = createSupabaseClient();
const authState = {
  user: null,
  session: null,
  initialized: false,
};
const AUTH_REDIRECT_URL = new URL("index.html#product", window.location.href).href;

const ctx = elements.overlay.getContext("2d");
const BARK_AUDIO_SRC = "./assets/dog-bark.mp3?v=real-bark-1";
const SERVER_TRANSCRIBE_URL = "https://uakzkwotrawatfpwcfbi.supabase.co/functions/v1/transcribe";
const SERVER_CHAT_URL = "https://uakzkwotrawatfpwcfbi.supabase.co/functions/v1/chat";
const SERVER_TRANSCRIBE_CHUNK_MS = 3000;
const EYE_RANGE_X = 20;
const EYE_RANGE_Y = 12;
const EYE_TRACKING_RESPONSE = 0.34;
const FACE_COVER_SWITCH_FRAMES = 8;
const ABSENCE_SADNESS_DELAY_MS = 30000;
const ABSENCE_SLEEP_DELAY_MS = 180000;
const TWO_METERS_PERSON_HEIGHT_RATIO = 0.42;
const TWO_METERS_FACE_HEIGHT_RATIO = 0.11;
const MIN_VISIBLE_PERSON_SCORE = 0.62;
const MIN_VISIBLE_FACE_SCORE = 0.65;
const MIN_VISIBLE_FACE_HEIGHT_RATIO = 0.045;
const MIN_EMOTION_HOLD_MS = 3000;
const EMOTION_FADE_MS = 900;
const CIRCLE_CONFIRM_FRAMES = 6;
const CIRCLE_RELEASE_FRAMES = 8;
const HAND_DETECTION_INTERVAL_MS = 120;
const PULSE_COMMAND_DURATION_MS = 450;

window.addEventListener("hashchange", showRouteFromHash);
window.addEventListener("resize", resizeOverlay);
elements.signUpForm.addEventListener("submit", createAccount);
elements.loginForm.addEventListener("submit", loginAccount);
elements.resendConfirmationButton.addEventListener("click", resendConfirmationEmail);
elements.logoutButton.addEventListener("click", logoutAccount);
elements.headerLogoutButton.addEventListener("click", logoutAccount);
elements.authModeLinks.forEach((link) => {
  link.addEventListener("click", () => setAccountMode(link.dataset.authMode || "signin"));
});
elements.settingsForm.addEventListener("submit", saveSettingsFromForm);
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
elements.runScreen.addEventListener("click", (event) => {
  if (!event.target.closest(".run-stage")) return;
  if (runState.running) stopRun();
});
elements.transcribeButton.addEventListener("click", toggleTranscription);

applySettingsToForm();
initializeAuth();
setupTranscription();
checkBrowser();
setAccountMode("signin");
updateAuthNavigation();
showRouteFromHash();
scheduleBlink();

function showRouteFromHash() {
  const route = window.location.hash.replace("#", "") || "product";
  let currentRoute = routes.includes(route) ? route : "product";
  const loggedIn = Boolean(authState.user);

  if (authState.initialized && protectedRoutes.includes(currentRoute) && !loggedIn && !runState.running) {
    setAccountMode("signin");
    currentRoute = "account";
    if (window.location.hash !== "#account") window.location.hash = "#account";
  }

  elements.pages.forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === currentRoute);
  });

  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === currentRoute);
  });

  updateRunningViewMode();

  if (currentRoute !== "running" && currentRoute !== "check") {
    stopHiddenTranscription();
  }

  if (currentRoute !== "running" && runState.running) {
    stopRun();
  }

  if (currentRoute !== "check") {
    stopVolumeMeter();
    unloadDiagnosticFrames();
  } else {
    loadDiagnosticFrames();
  }

  updateAuthNavigation();
}

function loadDiagnosticFrames() {
  elements.diagnosticFrames.forEach((frame) => {
    if (frame.getAttribute("src") === frame.dataset.src) return;
    frame.setAttribute("src", frame.dataset.src);
  });
}

function unloadDiagnosticFrames() {
  elements.diagnosticFrames.forEach((frame) => {
    if (frame.getAttribute("src") === "about:blank") return;
    frame.setAttribute("src", "about:blank");
  });
}

function updateRunningViewMode() {
  const route = window.location.hash.replace("#", "") || "product";
  const live = route === "running" && runState.running;
  document.body.classList.toggle("is-running-page", live);
  elements.runScreen.classList.toggle("is-live", live);
}

function setAccountMode(mode) {
  const nextMode = mode === "signup" ? "signup" : "signin";
  document.body.dataset.accountMode = nextMode;
  elements.loginForm.classList.toggle("is-primary-flow", nextMode === "signin");
  elements.signUpForm.classList.toggle("is-primary-flow", nextMode === "signup");
}

function updateAuthNavigation() {
  const loggedIn = Boolean(authState.user);
  document.body.classList.toggle("is-authenticated", loggedIn);
  elements.authModeLinks.forEach((link) => {
    link.hidden = loggedIn;
  });
  elements.headerLogoutButton.hidden = !loggedIn;
}

function createSupabaseClient() {
  const url = String(supabaseConfig.url || "").trim();
  const anonKey = String(supabaseConfig.anonKey || "").trim();
  const configured = url.startsWith("https://") && anonKey.length > 20 && window.supabase?.createClient;
  if (!configured) return null;
  return window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

async function initializeAuth() {
  if (!supabaseClient) {
    updateAccountUi("Supabaseが未設定です。supabase-config.jsにURLと公開anon keyを設定してください。", "is-warn");
    return;
  }

  updateAccountUi("Supabaseに接続しています", "");
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    updateAccountUi(`ログイン状態を確認できません: ${error.message}`, "is-bad");
    return;
  }

  authState.session = data.session;
  authState.user = data.session?.user || null;
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    authState.session = session;
    authState.user = session?.user || null;
    await syncAccountSettings();
    showRouteFromHash();
  });
  await syncAccountSettings();
  showRouteFromHash();
}

async function createAccount(event) {
  event.preventDefault();
  if (!supabaseClient) {
    updateAccountUi("Supabaseが未設定のため、アカウントを作成できません。", "is-bad");
    return;
  }

  const email = elements.signUpEmail.value.trim();
  const password = elements.signUpPassword.value;
  const dogName = elements.signUpDogName.value.trim() || defaultSettings.dogName;
  updateAccountUi("アカウントを作成しています", "");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: AUTH_REDIRECT_URL,
      data: { dog_name: dogName },
    },
  });

  if (error) {
    updateAccountUi(`アカウントを作成できません: ${error.message}`, "is-bad");
    return;
  }

  settings.dogName = dogName;
  saveLocalSettings();
  applySettingsToForm();

  if (data.session) {
    authState.session = data.session;
    authState.user = data.user;
    await saveDogProfile(dogName, true);
    authState.initialized = true;
    window.location.hash = "#product";
    showRouteFromHash();
    updateAccountUi("アカウントを作成してログインしました", "is-ok");
  } else {
    updateAccountUi("確認メールを送信しました。メール確認後にログインしてください。", "is-ok");
  }
}

async function loginAccount(event) {
  event.preventDefault();
  if (!supabaseClient) {
    updateAccountUi("Supabaseが未設定のため、ログインできません。", "is-bad");
    return;
  }

  updateAccountUi("ログインしています", "");
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: elements.loginEmail.value.trim(),
    password: elements.loginPassword.value,
  });

  if (error) {
    updateAccountUi(`ログインできません: ${error.message}`, "is-bad");
    return;
  }

  authState.session = data.session;
  authState.user = data.user;
  await syncAccountSettings();
  authState.initialized = true;
  window.location.hash = "#running";
  showRouteFromHash();
}

async function resendConfirmationEmail() {
  if (!supabaseClient) {
    updateAccountUi("Supabaseが未設定のため、確認メールを再送できません。", "is-bad");
    return;
  }

  const email = elements.loginEmail.value.trim() || elements.signUpEmail.value.trim();
  if (!email) {
    updateAccountUi("確認メールを再送するメールアドレスを入力してください。", "is-warn");
    elements.loginEmail.focus();
    return;
  }

  updateAccountUi("確認メールを再送しています", "");
  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: AUTH_REDIRECT_URL,
    },
  });

  if (error) {
    updateAccountUi(`確認メールを再送できません: ${error.message}`, "is-bad");
    return;
  }

  updateAccountUi("確認メールを再送しました。迷惑メールフォルダも確認してください。", "is-ok");
}

async function logoutAccount() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    updateAccountUi(`ログアウトできません: ${error.message}`, "is-bad");
    return;
  }
  authState.session = null;
  authState.user = null;
  authState.initialized = true;
  window.location.hash = "#product";
  showRouteFromHash();
  updateAccountUi("ログアウトしました。犬の名前はこの端末の一時設定を使います。", "is-warn");
}

async function syncAccountSettings() {
  authState.initialized = true;
  if (!supabaseClient || !authState.user) {
    updateAccountUi("未ログインです。ログインすると犬の名前をアカウントごとに保存できます。", supabaseClient ? "is-warn" : "is-bad");
    return;
  }

  const { data, error } = await supabaseClient
    .from("dog_profiles")
    .select("dog_name")
    .eq("user_id", authState.user.id)
    .maybeSingle();

  if (error) {
    updateAccountUi(`犬の名前を読み込めません: ${error.message}`, "is-bad");
    return;
  }

  if (data?.dog_name) {
    settings.dogName = data.dog_name;
  } else {
    await saveDogProfile(settings.dogName || defaultSettings.dogName, true);
  }

  saveLocalSettings();
  applySettingsToForm();
  updateAccountUi("ログイン中です。犬の名前はSupabaseに保存されます。", "is-ok");
}

async function saveDogProfile(dogName, silent = false) {
  if (!supabaseClient || !authState.user) return false;
  const { error } = await supabaseClient.from("dog_profiles").upsert(
    {
      user_id: authState.user.id,
      dog_name: dogName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (!silent) updateAccountUi(`犬の名前を保存できません: ${error.message}`, "is-bad");
    return false;
  }
  if (!silent) updateAccountUi("犬の名前をSupabaseに保存しました。", "is-ok");
  return true;
}

function updateAccountUi(message, statusClass = "") {
  elements.accountStatus.textContent = message;
  elements.accountStatus.classList.remove("is-ok", "is-warn", "is-bad");
  if (statusClass) elements.accountStatus.classList.add(statusClass);

  const configured = Boolean(supabaseClient);
  const loggedIn = Boolean(authState.user);
  elements.signUpForm.querySelectorAll("input, button").forEach((node) => {
    node.disabled = !configured;
  });
  elements.loginForm.querySelectorAll("input, button").forEach((node) => {
    node.disabled = !configured;
  });
  elements.resendConfirmationButton.disabled = !configured;
  elements.logoutButton.disabled = !loggedIn;
  elements.currentAccountText.textContent = loggedIn ? `ログイン中: ${authState.user.email}` : "未ログイン";
  elements.currentDogNameText.textContent = `犬の名前: ${settings.dogName || defaultSettings.dogName}`;
}

function applySettingsToForm() {
  elements.settingDogName.value = settings.dogName;
  elements.currentDogNameText.textContent = `犬の名前: ${settings.dogName || defaultSettings.dogName}`;
}

async function saveSettingsFromForm(event) {
  event.preventDefault();
  settings.dogName = elements.settingDogName.value.trim() || defaultSettings.dogName;
  saveLocalSettings();
  if (authState.user) {
    const saved = await saveDogProfile(settings.dogName);
    elements.runStatusText.textContent = saved ? "犬の名前を保存しました" : "犬の名前を端末に一時保存しました";
    elements.settingsSaveMessage.textContent = saved ? "保存できました" : "端末に一時保存しました";
  } else {
    updateAccountUi("未ログインのため、犬の名前はこの端末に一時保存しました。", "is-warn");
    elements.runStatusText.textContent = "犬の名前を端末に一時保存しました";
    elements.settingsSaveMessage.textContent = "保存できました";
  }
  applySettingsToForm();
}

function saveLocalSettings() {
  localStorage.setItem("watch-system-settings", JSON.stringify({ dogName: settings.dogName }));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("watch-system-settings")) || {};
    return {
      dogName: saved.dogName || defaultSettings.dogName,
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
  if (!speechState.supported) {
    startHiddenTranscription();
    return;
  }

  if (speechState.supported) {
    setCheck(elements.speechDot, elements.speechCheckText, "is-ok", "名前を呼ぶ確認を開始しました");
    elements.checkTranscriptText.textContent = "聞き取り中です";
    startHiddenTranscription();
  } else {
    setCheck(elements.speechDot, elements.speechCheckText, "is-warn", "このブラウザは音声認識に未対応です");
  }
}

function checkBark() {
  if (!ensureBarkAudio()) {
    setCheck(elements.barkDot, elements.barkCheckText, "is-bad", "このブラウザでは音を再生できません");
    return;
  }

  preloadBarkSample();
  bark(1);
  setCheck(elements.barkDot, elements.barkCheckText, "is-ok", "犬の鳴き声音声を再生しました");
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
  preloadBarkSample();

  try {
    if (runState.running) stopRun();
    runState.running = true;
    updateRunningViewMode();
    resetEyeTracking();
    wakeEyes();
    resetRunningBehavior();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    runState.stream = stream;
    elements.video.srcObject = stream;
    await elements.video.play();
    elements.runStatusText.textContent = "人物検出モデルを読み込んでいます";
    const detectionReady = await prepareDetection();
    updateRunningViewMode();
    elements.stopRunButton.disabled = false;
    elements.runStatusText.textContent = detectionReady ? "人物を探しています" : "目だけを表示しています";
    startHiddenTranscription();
    markPersonAbsent();
    if (detectionReady) {
      detectLoop();
    } else {
      wakeEyes();
    }
  } catch (error) {
    stopStream(runState.stream);
    runState.stream = null;
    elements.video.srcObject = null;
    updateRunningViewMode();
    elements.runStatusText.textContent = getMediaErrorMessage(error, "カメラ");
    elements.stopRunButton.disabled = false;
    markPersonAbsent();
    wakeEyes();
  }
}

function stopRun() {
  runState.running = false;
  runState.detecting = false;
  clearAbsenceTimers();
  clearEmotionTimer();
  runState.followRequested = false;
  clearPulseCommand();
  setRobotCommand("待機");
  stopHiddenTranscription();
  stopVolumeMeter();
  if (runState.rafId) cancelAnimationFrame(runState.rafId);
  stopStream(runState.stream);
  runState.stream = null;
  elements.video.srcObject = null;
  updateRunningViewMode();
  runState.trackedCenter = null;
  runState.coveredFrames = 0;
  runState.circleFrames = 0;
  runState.circleActive = false;
  runState.lastHandDetectionAt = 0;
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

async function prepareDetection() {
  try {
    await loadModel();
  } catch (error) {
    console.warn(error);
    runState.model = null;
  }

  try {
    await loadFaceDetector();
  } catch (error) {
    console.warn(error);
    runState.faceDetector = null;
  }

  try {
    await loadHandDetector();
  } catch (error) {
    console.warn(error);
    runState.handDetector = null;
  }

  return Boolean(runState.model || runState.faceDetector || runState.handDetector);
}

async function loadFaceDetector() {
  if (runState.faceDetector) return;
  if (!window.faceDetection) return;

  const model = window.faceDetection.SupportedModels.MediaPipeFaceDetector;
  runState.faceDetector = await window.faceDetection.createDetector(model, {
    runtime: "tfjs",
    maxFaces: 8,
  });
}

async function loadHandDetector() {
  if (runState.handDetector) return;
  if (!window.handPoseDetection) return;

  const model = window.handPoseDetection.SupportedModels.MediaPipeHands;
  runState.handDetector = await window.handPoseDetection.createDetector(model, {
    runtime: "mediapipe",
    solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240",
    modelType: "lite",
    maxHands: 2,
  });
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
    const predictions = runState.model ? await runState.model.detect(elements.video) : [];
    const faces = runState.faceDetector
      ? await runState.faceDetector.estimateFaces(elements.video, { flipHorizontal: false })
      : [];
    let hands = null;
    const now = Date.now();
    if (runState.handDetector && now - runState.lastHandDetectionAt >= HAND_DETECTION_INTERVAL_MS) {
      hands = await runState.handDetector.estimateHands(elements.video, { flipHorizontal: false });
      runState.lastHandDetectionAt = now;
    }
    renderDetections(predictions, faces);
    if (hands) updateCircleGesture(hands);
    updateTrickStatus();
  } catch {
    elements.runStatusText.textContent = "検出中にエラーが発生しました";
  } finally {
    runState.detecting = false;
    if (runState.running) runState.rafId = requestAnimationFrame(detectLoop);
  }
}

function updateCircleGesture(hands) {
  const candidate = hands
    .filter((hand) => hand.score == null || hand.score >= 0.65)
    .some((hand) => analyzeCircleGesture(hand.keypoints).isCircle);

  if (candidate) {
    runState.circleFrames = Math.min(CIRCLE_CONFIRM_FRAMES, runState.circleFrames + 1);
  } else {
    runState.circleFrames = Math.max(-CIRCLE_RELEASE_FRAMES, runState.circleFrames - 1);
  }

  if (runState.circleFrames >= CIRCLE_CONFIRM_FRAMES && !runState.circleActive) {
    runState.circleActive = true;
    enterTrickMode();
  }

  if (runState.circleFrames <= -CIRCLE_RELEASE_FRAMES) runState.circleActive = false;
}

function enterTrickMode() {
  runState.followRequested = false;
  clearAbsenceTimers();
  clearEmotionTimer();
  runState.command = "芸";
  runState.emotion = "normal";
  elements.dogEyes.classList.remove("is-emotion-happy", "is-emotion-very-happy", "is-emotion-sad", "is-emotion-fading");
  elements.dogEyes.setAttribute("data-expression", "neutral");
  wakeEyes();
  elements.runStatusText.textContent = "芸を見ています";
  publishRunningBehavior();
}

function updateTrickStatus() {
  if (runState.command !== "芸") return;
  elements.runStatusText.textContent = runState.pulseCommand === "芸記憶"
    ? "芸を記憶しました"
    : "芸を見ています";
}

function renderDetections(predictions, faces = []) {
  const frameWidth = elements.video.videoWidth || elements.overlay.width;
  const frameHeight = elements.video.videoHeight || elements.overlay.height;
  const people = predictions
    .filter((item) => item.class === "person" && item.score >= MIN_VISIBLE_PERSON_SCORE)
    .sort((a, b) => b.score - a.score);
  const visibleFaces = faces.filter((face) => isVisibleFace(face, frameHeight));

  elements.personCountText.textContent = String(people.length);

  if (!people.length) {
    if (visibleFaces.length) {
      wakeEyes();
      const mainFace = chooseTrackedFace(visibleFaces, frameWidth, frameHeight);
      if (!mainFace) {
        updateEyeTracking(0, 0);
        return;
      }
      const metrics = getOffsetMetrics(mainFace.bbox, frameWidth, frameHeight);
      updateEyeTracking(metrics.x, metrics.y);
      markPersonPresent(mainFace.bbox, frameHeight, "face");
      elements.personCountText.textContent = String(visibleFaces.length);
      elements.runStatusText.textContent = "顔を追従中";
      elements.directionText.textContent = getDirectionLabel(metrics);
      elements.confidenceText.textContent = "--";
      return;
    }

    runState.trackedCenter = null;
    runState.coveredFrames = 0;
    markPersonAbsent();
    if (runState.emotion !== "sleepy") wakeEyes();
    updateEyeTracking(0, 0);
    elements.runStatusText.textContent = "人物を探しています";
    elements.directionText.textContent = "未検出";
    elements.confidenceText.textContent = "--";
    return;
  }

  wakeEyes();
  const mainPerson = chooseTrackedPerson(people, visibleFaces, frameWidth, frameHeight);
  const metrics = getOffsetMetrics(mainPerson.bbox, frameWidth, frameHeight);
  updateEyeTracking(metrics.x, metrics.y);
  markPersonPresent(mainPerson.bbox, frameHeight, "person");
  elements.runStatusText.textContent = "検出中";
  elements.directionText.textContent = getDirectionLabel(metrics);
  elements.confidenceText.textContent = `${Math.round(mainPerson.score * 100)}%`;
}

function chooseTrackedFace(faces, frameWidth, frameHeight) {
  const candidates = faces
    .map((face) => {
      const bbox = getFaceBbox(face);
      return {
        bbox,
        center: getBoxCenter(bbox),
      };
    })
    .filter((item) => item.bbox[2] > 0 && item.bbox[3] > 0);

  if (!candidates.length) return null;

  const current = findCurrentTrackedFace(candidates);
  const next = current || chooseBestFaceCandidate(candidates, frameWidth, frameHeight);
  runState.trackedCenter = next.center;
  runState.coveredFrames = 0;
  return next;
}

function findCurrentTrackedFace(candidates) {
  if (!runState.trackedCenter || !candidates.length) return null;

  return candidates
    .map((item) => ({
      ...item,
      distance: Math.hypot(item.center.x - runState.trackedCenter.x, item.center.y - runState.trackedCenter.y),
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function chooseBestFaceCandidate(candidates, frameWidth, frameHeight) {
  const frameCenter = { x: frameWidth / 2, y: frameHeight / 2 };
  return candidates
    .map((item) => {
      const centerDistance = Math.hypot(item.center.x - frameCenter.x, item.center.y - frameCenter.y);
      const normalizedDistance = centerDistance / Math.hypot(frameCenter.x, frameCenter.y);
      const area = item.bbox[2] * item.bbox[3];
      return { ...item, score: area - normalizedDistance * area * 0.18 };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function getFaceBbox(face) {
  const box = face.box || {};
  const x = box.xMin ?? box.x ?? 0;
  const y = box.yMin ?? box.y ?? 0;
  const width = box.width ?? Math.max(0, (box.xMax ?? 0) - x);
  const height = box.height ?? Math.max(0, (box.yMax ?? 0) - y);
  return [x, y, width, height];
}

function isVisibleFace(face, frameHeight) {
  const bbox = getFaceBbox(face);
  const score = Array.isArray(face.score) ? face.score[0] : face.score;
  const confidence = Number.isFinite(score) ? score : 1;
  return confidence >= MIN_VISIBLE_FACE_SCORE && bbox[3] / Math.max(1, frameHeight) >= MIN_VISIBLE_FACE_HEIGHT_RATIO;
}

function chooseTrackedPerson(people, faces, frameWidth, frameHeight) {
  const enrichedPeople = people.map((person) => ({
    person,
    center: getBoxCenter(person.bbox),
    hasFace: personHasVisibleFace(person.bbox, faces),
  }));

  const current = findCurrentTrackedPerson(enrichedPeople);
  if (current) {
    runState.coveredFrames = current.hasFace ? 0 : runState.coveredFrames + 1;
    if (runState.coveredFrames < FACE_COVER_SWITCH_FRAMES || enrichedPeople.length === 1) {
      runState.trackedCenter = current.center;
      return current.person;
    }
  }

  const candidates = enrichedPeople.filter((item) => item.hasFace);
  const next = chooseBestCandidate(candidates.length ? candidates : enrichedPeople, frameWidth, frameHeight);
  runState.trackedCenter = next.center;
  runState.coveredFrames = 0;
  return next.person;
}

function findCurrentTrackedPerson(enrichedPeople) {
  if (!runState.trackedCenter) return null;

  return enrichedPeople
    .map((item) => ({
      ...item,
      distance: Math.hypot(item.center.x - runState.trackedCenter.x, item.center.y - runState.trackedCenter.y),
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function chooseBestCandidate(candidates, frameWidth, frameHeight) {
  const frameCenter = { x: frameWidth / 2, y: frameHeight / 2 };
  return candidates
    .map((item) => {
      const centerDistance = Math.hypot(item.center.x - frameCenter.x, item.center.y - frameCenter.y);
      const normalizedDistance = centerDistance / Math.hypot(frameCenter.x, frameCenter.y);
      const faceBonus = item.hasFace ? 0.28 : 0;
      const score = item.person.score + faceBonus - normalizedDistance * 0.18;
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function personHasVisibleFace([personX, personY, personWidth, personHeight], faces) {
  const headArea = {
    x: personX,
    y: personY,
    width: personWidth,
    height: personHeight * 0.45,
  };

  return faces.some((face) => {
    const box = face.box || {};
    const faceBox = {
      x: box.xMin ?? box.x ?? 0,
      y: box.yMin ?? box.y ?? 0,
      width: box.width ?? Math.max(0, (box.xMax ?? 0) - (box.xMin ?? 0)),
      height: box.height ?? Math.max(0, (box.yMax ?? 0) - (box.yMin ?? 0)),
    };
    return getIntersectionRatio(headArea, faceBox) > 0.12;
  });
}

function getBoxCenter([x, y, width, height]) {
  return {
    x: x + width / 2,
    y: y + height / 2,
  };
}

function getIntersectionRatio(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const intersection = width * height;
  const bArea = Math.max(1, b.width * b.height);
  return intersection / bArea;
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
  runState.eyeX = runState.eyeX * (1 - EYE_TRACKING_RESPONSE) + targetX * EYE_TRACKING_RESPONSE;
  runState.eyeY = runState.eyeY * (1 - EYE_TRACKING_RESPONSE) + targetY * EYE_TRACKING_RESPONSE;
  elements.pupilGroup.setAttribute("transform", `translate(${runState.eyeX.toFixed(1)} ${runState.eyeY.toFixed(1)})`);
}

function resetEyeTracking() {
  runState.eyeX = 0;
  runState.eyeY = 0;
  elements.pupilGroup.setAttribute("transform", "translate(0 0)");
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
  setTimeout(() => elements.dogEyes.classList.remove("is-blinking"), 190);
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
    elements.transcribeButton.disabled = false;
    elements.transcriptionStatus.textContent = "サーバー待機中";
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "ja-JP";

  recognition.addEventListener("start", () => {
    speechState.listening = true;
    speechState.mode = "native";
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
    if (speechState.shouldListen && speechState.mode === "native") {
      window.setTimeout(startHiddenTranscription, 450);
    }
  });

  recognition.addEventListener("error", (event) => {
    speechState.listening = false;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      speechState.shouldListen = false;
      setCheck(elements.speechDot, elements.speechCheckText, "is-bad", "マイクまたは音声認識が許可されていません");
      stopVolumeMeter();
      speechState.mode = "server";
      speechState.shouldListen = true;
      startServerTranscription();
    } else {
      setCheck(elements.speechDot, elements.speechCheckText, "is-warn", "音声認識を開始できませんでした");
    }
    elements.transcriptionStatus.textContent = event.error === "not-allowed" ? "権限なし" : "エラー";
    elements.transcribeButton.textContent = "文字起こし開始";
  });

  speechState.recognition = recognition;
}

function toggleTranscription() {
  if (speechState.listening || speechState.serverListening) {
    stopHiddenTranscription();
    return;
  }

  startHiddenTranscription();
}

function startHiddenTranscription() {
  if (speechState.serverListening) return;
  speechState.shouldListen = true;
  ensureBarkAudio();
  preloadBarkSample();
  startServerTranscription();
}

function startNativeTranscription() {
  if (!speechState.recognition) {
    speechState.shouldListen = true;
    ensureBarkAudio();
    startServerTranscription();
    return;
  }
  if (!speechState.recognition || speechState.listening) return;
  speechState.shouldListen = true;
  speechState.mode = "native";
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
  speechState.mode = null;
  stopServerTranscription();
  if (speechState.recognition && speechState.listening) {
    speechState.recognition.stop();
  }
}

async function startServerTranscription() {
  if (speechState.serverListening) return;
  if (!window.MediaRecorder) {
    elements.transcriptionStatus.textContent = "録音に未対応";
    setCheck(elements.speechDot, elements.speechCheckText, "is-bad", "このブラウザではサーバー文字起こしを使えません");
    return;
  }

  speechState.mode = "server";
  speechState.serverListening = true;
  ensureBarkAudio();

  try {
    speechState.serverStream = getServerAudioStream(runState.stream);
    speechState.serverOwnsStream = !speechState.serverStream;
    if (!speechState.serverStream) {
      speechState.serverStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    }

    elements.transcriptionStatus.textContent = "サーバー聞き取り中";
    elements.transcribeButton.textContent = "停止";
    setCheck(elements.speechDot, elements.speechCheckText, "is-ok", "サーバー文字起こしで聞き取り中です");
    startVolumeMeter(speechState.serverStream);
    runServerTranscriptionLoop();
  } catch (error) {
    speechState.serverListening = false;
    speechState.mode = null;
    elements.transcriptionStatus.textContent = "マイクエラー";
    setCheck(elements.speechDot, elements.speechCheckText, "is-bad", getMediaErrorMessage(error, "マイク"));
  }
}

function getServerAudioStream(sourceStream) {
  const audioTracks = sourceStream?.getAudioTracks?.().filter((track) => track.readyState === "live") || [];
  return audioTracks.length ? new MediaStream(audioTracks) : null;
}

async function runServerTranscriptionLoop() {
  if (!speechState.serverListening || speechState.serverSending) return;
  speechState.serverSending = true;

  try {
    const blob = await recordServerAudioChunk(speechState.serverStream, SERVER_TRANSCRIBE_CHUNK_MS);
    if (speechState.serverListening && blob.size) {
      await sendServerAudioChunk(blob);
    }
  } catch (error) {
    if (speechState.serverListening) {
      elements.transcriptionStatus.textContent = "サーバー再接続中";
      setCheck(elements.speechDot, elements.speechCheckText, "is-warn", "文字起こしサーバーとの通信を再試行しています");
    }
  } finally {
    speechState.serverSending = false;
    if (speechState.serverListening) {
      speechState.serverTimer = window.setTimeout(runServerTranscriptionLoop, 120);
    }
  }
}

function recordServerAudioChunk(stream, durationMs) {
  return new Promise((resolve, reject) => {
    if (!stream?.getAudioTracks?.().some((track) => track.readyState === "live")) {
      reject(new Error("Microphone track is unavailable"));
      return;
    }

    const chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    let recorder;

    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      reject(error);
      return;
    }

    speechState.serverRecorder = recorder;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("error", (event) => reject(event.error || event));
    recorder.addEventListener("stop", () => {
      if (speechState.serverStopTimer) {
        window.clearTimeout(speechState.serverStopTimer);
        speechState.serverStopTimer = null;
      }
      if (speechState.serverRecorder === recorder) speechState.serverRecorder = null;
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    });

    recorder.start();
    speechState.serverStopTimer = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationMs);
  });
}

async function sendServerAudioChunk(blob) {
  const formData = new FormData();
  const dogName = settings.dogName || defaultSettings.dogName;
  formData.append("audio", blob, "dog-command.webm");
  formData.append("language", "ja");
  formData.append("dog_name", dogName);

  const response = await fetch(SERVER_TRANSCRIBE_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription server returned ${response.status}`);
  }

  const data = await response.json();
  const text = String(data.text || "").trim();
  if (!text || data.ignored || Date.now() < speechState.discardUntil || isLikelyTranscriptionNoise(text)) return;

  speechState.finalText += `${text}\n`;
  renderTranscript();
  handleVoiceCommand(text);
}

function isLikelyTranscriptionNoise(text) {
  const noisePhrases = new Set([
    "ありがとうございました",
    "ご視聴ありがとうございました",
    "はい",
    "はいはい",
  ]);
  return noisePhrases.has(normalizeSpeech(text));
}

function stopServerTranscription() {
  speechState.serverListening = false;
  if (speechState.serverTimer) {
    window.clearTimeout(speechState.serverTimer);
    speechState.serverTimer = null;
  }
  if (speechState.serverStopTimer) {
    window.clearTimeout(speechState.serverStopTimer);
    speechState.serverStopTimer = null;
  }
  if (speechState.serverRecorder?.state === "recording") {
    speechState.serverRecorder.stop();
  }
  speechState.serverRecorder = null;
  if (speechState.serverOwnsStream) {
    stopStream(speechState.serverStream);
  }
  speechState.serverStream = null;
  speechState.serverOwnsStream = false;
  speechState.serverSending = false;
}

async function startVolumeMeter(sourceStream = null) {
  if (speechState.volumeAnalyser) return;

  try {
    const canUseSourceStream = sourceStream?.getAudioTracks?.().some((track) => track.readyState === "live");
    speechState.volumeOwnsStream = !canUseSourceStream;
    speechState.volumeStream = canUseSourceStream
      ? sourceStream
      : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
  if (speechState.volumeOwnsStream) {
    speechState.volumeStream?.getTracks().forEach((track) => track.stop());
  }
  speechState.volumeOwnsStream = false;
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

async function handleVoiceCommand(text) {
  if (Date.now() < speechState.speakingUntil) return;
  if (speechState.chatSending) return;

  const dogName = normalizeSpeech(settings.dogName || defaultSettings.dogName);
  const heard = normalizeSpeech(text);
  if (!heard || heard.length < 2) return;
  if (confirmTrickMemory(heard)) return;
  if (!dogName || !heard.includes(dogName)) return;

  const behavior = getVoiceBehavior(heard);
  const commandKey = `ai:${heard}`;
  const now = Date.now();
  if (speechState.lastCommandKey === commandKey && now - speechState.lastCommandAt < 4200) return;

  speechState.lastCommandKey = commandKey;
  speechState.lastCommandAt = now;
  runState.followRequested = behavior.follow;
  setRobotCommand(behavior.command);
  setEmotion(behavior.emotion, behavior.duration);
  speechState.chatSending = true;
  elements.replyText.textContent = "考え中ワン";

  try {
    const reply = await requestAiReply(text);
    bark(behavior.barkCount);
    window.setTimeout(() => speakKyokoReply(reply), behavior.barkCount * 360 + 100);
  } catch {
    const fallbackReply = buildDogReply(text, heard, dogName);
    bark(behavior.barkCount);
    window.setTimeout(() => speakKyokoReply(fallbackReply), behavior.barkCount * 360 + 100);
  } finally {
    speechState.chatSending = false;
  }
}

function confirmTrickMemory(heard) {
  if (runState.command !== "芸" || !heard.includes("よし")) return false;

  const commandKey = `trick-memory:${heard}`;
  const now = Date.now();
  if (speechState.lastCommandKey === commandKey && now - speechState.lastCommandAt < 1800) return true;
  speechState.lastCommandKey = commandKey;
  speechState.lastCommandAt = now;
  pulseRobotCommand("芸記憶");
  elements.replyText.textContent = "芸を記憶します";
  elements.runStatusText.textContent = "芸を記憶しました";
  return true;
}

async function requestAiReply(text) {
  const dogName = settings.dogName || defaultSettings.dogName;
  const response = await fetch(SERVER_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      dog_name: dogName,
      history: speechState.chatHistory,
    }),
  });

  if (!response.ok) throw new Error(`Chat server returned ${response.status}`);

  const data = await response.json();
  const reply = ensureWanEnding(data.reply);
  rememberChat("user", text);
  rememberChat("assistant", reply);
  return reply;
}

function rememberChat(role, content) {
  speechState.chatHistory.push({
    role,
    content: String(content || "").trim().slice(0, 360),
  });
  speechState.chatHistory = speechState.chatHistory
    .filter((message) => message.content)
    .slice(-8);
}

function buildDogReply(_originalText, heard, dogName) {
  if (heard.includes("おいで")) return "いま行くワン";
  if (heard.includes("ありがとう") || heard.includes("ありがと")) return "どういたしましてワン";
  if (heard.includes("好き") || heard.includes("すき")) return "ぼくも好きだワン";
  if (heard.includes("悲しい") || heard.includes("かなしい") || heard.includes("寂しい") || heard.includes("さみしい")) return "そばにいるワン";
  if (heard.includes("困") || heard.includes("こま")) return "一緒に考えるワン";
  if (heard.includes("名前") || heard.includes("なまえ")) return `ぼくは${settings.dogName || defaultSettings.dogName}だワン`;
  if (dogName && heard.includes(dogName)) return "呼んだワン";
  return "聞こえたワン";
}

function getVoiceBehavior(heard) {
  if (includesCommandWord(heard, ["おいで"])) {
    return { command: "移動", barkCount: 1, emotion: "very-happy", duration: 4000, follow: true };
  }

  if (includesCommandWord(heard, ["おて", "お手"])) {
    return { command: "お手", barkCount: 1, emotion: "happy", duration: 2400, follow: false };
  }

  if (includesCommandWord(heard, ["おすわり", "お座り"])) {
    return { command: "お座り", barkCount: 1, emotion: "happy", duration: 2400, follow: false };
  }

  if (includesCommandWord(heard, ["まて", "待て"])) {
    return { command: "待て", barkCount: 1, emotion: "normal", duration: 0, follow: false };
  }

  return { command: "待機", barkCount: 1, emotion: "happy", duration: 1800, follow: false };
}

function includesCommandWord(heard, words) {
  return words.some((word) => heard.includes(word));
}

function resetRunningBehavior() {
  runState.followRequested = false;
  runState.personVisible = false;
  runState.absenceActive = false;
  clearAbsenceTimers();
  clearEmotionTimer();
  setRobotCommand("待機");
  setEmotion("normal");
}

function markPersonPresent(bbox, frameHeight, targetType) {
  runState.personVisible = true;
  runState.absenceActive = false;
  clearAbsenceTimers();
  if (!runState.emotionTimer && ["sad", "sleepy"].includes(runState.emotion)) setEmotion("normal");

  if (runState.followRequested) {
    const near = isWithinTwoMeters(bbox, frameHeight, targetType);
    setRobotCommand(near ? "移動停止" : "移動");
  }
}

function markPersonAbsent() {
  if (runState.command === "芸") {
    runState.personVisible = false;
    runState.absenceActive = true;
    clearAbsenceTimers();
    if (runState.emotion !== "normal") setEmotion("normal");
    return;
  }
  if (runState.absenceActive) return;

  runState.personVisible = false;
  runState.absenceActive = true;
  setRobotCommand("待機");
  if (!runState.emotionTimer) setEmotion("normal");
  startAbsenceTimers();
}

function startAbsenceTimers() {
  if (!runState.running) return;

  runState.absenceSadnessTimer = window.setTimeout(() => {
    if (!runState.running || runState.personVisible) return;
    setRobotCommand("待機");
    setEmotion("sad");
  }, ABSENCE_SADNESS_DELAY_MS);

  runState.absenceSleepTimer = window.setTimeout(() => {
    if (!runState.running || runState.personVisible) return;
    runState.followRequested = false;
    setRobotCommand("眠る");
    setEmotion("sleepy");
  }, ABSENCE_SLEEP_DELAY_MS);
}

function clearAbsenceTimers() {
  if (runState.absenceSadnessTimer) window.clearTimeout(runState.absenceSadnessTimer);
  if (runState.absenceSleepTimer) window.clearTimeout(runState.absenceSleepTimer);
  runState.absenceSadnessTimer = null;
  runState.absenceSleepTimer = null;
}

function setRobotCommand(command) {
  if (runState.command === command) return;
  runState.command = command;
  publishRunningBehavior();
}

function pulseRobotCommand(command) {
  if (runState.pulseTimer) window.clearTimeout(runState.pulseTimer);
  runState.pulseCommand = command;
  publishRunningBehavior();
  runState.pulseTimer = window.setTimeout(() => {
    runState.pulseTimer = null;
    runState.pulseCommand = "";
    publishRunningBehavior();
  }, PULSE_COMMAND_DURATION_MS);
}

function clearPulseCommand() {
  if (runState.pulseTimer) window.clearTimeout(runState.pulseTimer);
  runState.pulseTimer = null;
  if (!runState.pulseCommand) return;
  runState.pulseCommand = "";
  publishRunningBehavior();
}

function setEmotion(emotion, duration = 0) {
  clearEmotionTimer();
  runState.emotion = emotion;
  const classes = ["is-emotion-happy", "is-emotion-very-happy", "is-emotion-sad"];
  elements.dogEyes.classList.remove(...classes, "is-emotion-fading");
  elements.dogEyes.setAttribute("data-expression", getEyeExpressionName(emotion));
  applyDirectEmotionOverlay(emotion);

  if (emotion === "sleepy") {
    sleepEyes();
  } else {
    wakeEyes();
    if (emotion !== "normal") elements.dogEyes.classList.add(`is-emotion-${emotion}`);
    if (emotion !== "normal") blinkEyes();
  }

  publishRunningBehavior();

  if (duration > 0) {
    runState.emotionTimer = window.setTimeout(() => {
      runState.emotionTimer = null;
      if (!runState.running) return;
      fadeEmotionToNormal(classes);
    }, Math.max(duration, MIN_EMOTION_HOLD_MS));
  }
}

function clearEmotionTimer() {
  if (runState.emotionTimer) window.clearTimeout(runState.emotionTimer);
  if (runState.emotionFadeTimer) window.clearTimeout(runState.emotionFadeTimer);
  runState.emotionTimer = null;
  runState.emotionFadeTimer = null;
}

function fadeEmotionToNormal(classes) {
  elements.dogEyes.classList.add("is-emotion-fading");
  fadeDirectEmotionOverlay();
  runState.emotionFadeTimer = window.setTimeout(() => {
    elements.dogEyes.classList.remove(...classes, "is-emotion-fading");
    elements.dogEyes.setAttribute("data-expression", "neutral");
    clearDirectEmotionOverlay();
    runState.emotion = "normal";
    runState.emotionFadeTimer = null;
    publishRunningBehavior();
  }, EMOTION_FADE_MS);
}

function getEyeExpressionName(emotion) {
  if (emotion === "very-happy") return "very_happy";
  if (["happy", "sad", "sleepy"].includes(emotion)) return emotion;
  return "neutral";
}

function applyDirectEmotionOverlay(emotion) {
  const happy = emotion === "happy" || emotion === "very-happy";
  const veryHappy = emotion === "very-happy";
  const sad = emotion === "sad";
  const joy = elements.dogEyes.querySelector(".emotion-joy");
  const sadness = elements.dogEyes.querySelector(".emotion-sad");
  const sadBrows = elements.dogEyes.querySelector(".sad-brows");
  const sparkles = elements.dogEyes.querySelectorAll(".sparkle");
  const brows = elements.dogEyes.querySelectorAll(".eye-brow");
  const irises = elements.dogEyes.querySelectorAll(".iris");
  const auras = elements.dogEyes.querySelectorAll(".eye-aura");

  setSvgPresentation(joy, happy ? "1" : "0", veryHappy ? "translateY(-6px) scale(1.08)" : "none");
  setSvgPresentation(sadness, sad ? "1" : "0");
  setSvgPresentation(sadBrows, sad ? "1" : "0");
  sparkles.forEach((sparkle) => {
    setSvgPresentation(sparkle, happy ? "1" : "0");
    sparkle.style.animation = "none";
  });
  brows.forEach((brow) => setSvgPresentation(brow, sad ? "0" : "1"));
  irises.forEach((iris) => setSvgPresentation(iris, sad ? "0.52" : "1"));
  auras.forEach((aura) => setSvgPresentation(aura, sad ? "0.16" : "1"));
}

function fadeDirectEmotionOverlay() {
  const hidden = [
    elements.dogEyes.querySelector(".emotion-joy"),
    elements.dogEyes.querySelector(".emotion-sad"),
    elements.dogEyes.querySelector(".sad-brows"),
    ...elements.dogEyes.querySelectorAll(".sparkle"),
  ];
  const visible = [
    ...elements.dogEyes.querySelectorAll(".eye-brow"),
    ...elements.dogEyes.querySelectorAll(".iris"),
    ...elements.dogEyes.querySelectorAll(".eye-aura"),
  ];
  hidden.forEach((node) => setSvgPresentation(node, "0", "none", "900ms"));
  visible.forEach((node) => setSvgPresentation(node, "1", "none", "900ms"));
}

function clearDirectEmotionOverlay() {
  const nodes = elements.dogEyes.querySelectorAll(
    ".emotion-joy, .emotion-sad, .sad-brows, .sparkle, .eye-brow, .iris, .eye-aura",
  );
  nodes.forEach((node) => {
    node.style.removeProperty("opacity");
    node.style.removeProperty("transform");
    node.style.removeProperty("transition");
    node.style.removeProperty("animation");
  });
}

function setSvgPresentation(node, opacity, transform = "none", duration = "180ms") {
  if (!node) return;
  node.style.transition = `opacity ${duration} ease-out, transform ${duration} ease-out`;
  node.style.opacity = opacity;
  node.style.transform = transform;
}

function isWithinTwoMeters(bbox, frameHeight, targetType) {
  const heightRatio = bbox[3] / Math.max(1, frameHeight);
  const threshold = targetType === "face" ? TWO_METERS_FACE_HEIGHT_RATIO : TWO_METERS_PERSON_HEIGHT_RATIO;
  return heightRatio >= threshold;
}

function publishRunningBehavior() {
  const detail = {
    command: runState.command,
    emotion: runState.emotion,
    pulseCommand: runState.pulseCommand,
    following: runState.followRequested,
  };
  window.smartphoneDogBehavior = detail;
  window.dispatchEvent(new CustomEvent("smartphone-dog-behavior", { detail }));
}

function speakKyokoReply(reply) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  const responseText = ensureWanEnding(reply);
  elements.replyText.textContent = responseText;
  speechState.speakingUntil = Date.now() + Math.max(2400, (responseText.length + 4) * 160);
  speechState.discardUntil = Math.max(speechState.discardUntil, speechState.speakingUntil);

  const voice = getKyokoVoice();
  const greeting = new SpeechSynthesisUtterance("はいワン");
  const response = new SpeechSynthesisUtterance(responseText);
  [greeting, response].forEach((utterance) => {
    utterance.lang = "ja-JP";
    utterance.rate = 1.04;
    utterance.pitch = 0.82;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
  });

  greeting.addEventListener("end", () => {
    window.setTimeout(() => window.speechSynthesis.speak(response), 320);
  });

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(greeting);
}

function getKyokoVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name.toLowerCase().includes("kyoko"))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("ja"))
    || null;
}

function ensureWanEnding(reply) {
  const trimmed = String(reply || "").trim().replace(/[。.!！?？]+$/g, "");
  if (!trimmed) return "聞こえたワン";
  return trimmed.endsWith("ワン") ? trimmed : `${trimmed}ワン`;
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
  speechState.discardUntil = Math.max(speechState.discardUntil, Date.now() + count * 360 + 1600);
  for (let index = 0; index < count; index += 1) {
    window.setTimeout(playBarkSample, index * 360);
  }
}

function playBarkSample() {
  const audioContext = ensureBarkAudio();
  const buffer = speechState.barkSampleBuffer;
  if (!audioContext) return;

  if (!buffer) {
    preloadBarkSample().then((loaded) => {
      if (loaded) playBarkSample();
    });
    return;
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(0.95, audioContext.currentTime);
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
}

async function preloadBarkSample() {
  if (speechState.barkSampleBuffer) return true;
  if (speechState.barkSampleLoading) return speechState.barkSampleLoading;

  const audioContext = ensureBarkAudio();
  if (!audioContext) return false;

  speechState.barkSampleLoading = fetch(BARK_AUDIO_SRC)
    .then((response) => {
      if (!response.ok) throw new Error(`Bark sound request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => audioContext.decodeAudioData(data))
    .then((buffer) => {
      speechState.barkSampleBuffer = buffer;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      speechState.barkSampleLoading = null;
    });

  return speechState.barkSampleLoading;
}

function playSyntheticBark() {
  const audioContext = ensureBarkAudio();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const duration = 0.32;
  const output = audioContext.createGain();
  const compressor = audioContext.createDynamicsCompressor();

  compressor.threshold.setValueAtTime(-22, now);
  compressor.knee.setValueAtTime(14, now);
  compressor.ratio.setValueAtTime(8, now);
  compressor.attack.setValueAtTime(0.006, now);
  compressor.release.setValueAtTime(0.13, now);

  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.78, now + 0.018);
  output.gain.exponentialRampToValueAtTime(0.42, now + 0.105);
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  output.connect(compressor);
  compressor.connect(audioContext.destination);

  playBarkNoise(audioContext, output, now, duration);
  playBarkVoice(audioContext, output, now, duration);
}

function playBarkVoice(audioContext, destination, startTime, duration) {
  const voiceGain = audioContext.createGain();
  const growlGain = audioContext.createGain();
  const chest = audioContext.createOscillator();
  const voice = audioContext.createOscillator();
  const bite = audioContext.createOscillator();
  const throat = audioContext.createBiquadFilter();
  const mouth = audioContext.createBiquadFilter();

  throat.type = "bandpass";
  throat.frequency.setValueAtTime(360, startTime);
  throat.frequency.exponentialRampToValueAtTime(220, startTime + duration);
  throat.Q.setValueAtTime(3.2, startTime);

  mouth.type = "bandpass";
  mouth.frequency.setValueAtTime(920, startTime);
  mouth.frequency.exponentialRampToValueAtTime(610, startTime + duration);
  mouth.Q.setValueAtTime(2.2, startTime);

  chest.type = "sawtooth";
  chest.frequency.setValueAtTime(155, startTime);
  chest.frequency.exponentialRampToValueAtTime(82, startTime + duration);

  voice.type = "triangle";
  voice.frequency.setValueAtTime(540, startTime);
  voice.frequency.exponentialRampToValueAtTime(260, startTime + duration);

  bite.type = "square";
  bite.frequency.setValueAtTime(980, startTime);
  bite.frequency.exponentialRampToValueAtTime(430, startTime + 0.15);

  growlGain.gain.setValueAtTime(0.0001, startTime);
  growlGain.gain.exponentialRampToValueAtTime(0.24, startTime + 0.018);
  growlGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.exponentialRampToValueAtTime(0.36, startTime + 0.026);
  voiceGain.gain.exponentialRampToValueAtTime(0.14, startTime + 0.13);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  chest.connect(throat);
  throat.connect(growlGain);
  growlGain.connect(destination);

  voice.connect(mouth);
  bite.connect(mouth);
  mouth.connect(voiceGain);
  voiceGain.connect(destination);

  [chest, voice, bite].forEach((oscillator) => {
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  });
}

function playBarkNoise(audioContext, destination, startTime, duration) {
  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const lowpass = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();

  noise.buffer = getBarkNoiseBuffer(audioContext);
  noise.playbackRate.setValueAtTime(0.92 + Math.random() * 0.14, startTime);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(760, startTime);
  filter.frequency.exponentialRampToValueAtTime(430, startTime + duration);
  filter.Q.setValueAtTime(1.4, startTime);

  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(1650, startTime);
  lowpass.frequency.exponentialRampToValueAtTime(880, startTime + duration);
  lowpass.Q.setValueAtTime(0.8, startTime);

  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.012);
  noiseGain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.11);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  noise.connect(filter);
  filter.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(destination);
  noise.start(startTime);
  noise.stop(startTime + duration + 0.04);
}

function getBarkNoiseBuffer(audioContext) {
  if (speechState.barkNoiseBuffer) return speechState.barkNoiseBuffer;

  const length = Math.floor(audioContext.sampleRate * 0.38);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.74 + white * 0.26;
    const envelope = 1 - index / length;
    data[index] = previous * envelope;
  }

  speechState.barkNoiseBuffer = buffer;
  return buffer;
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
