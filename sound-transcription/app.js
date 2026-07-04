const transcribeButton = document.querySelector("#transcribeButton");
const languageSelect = document.querySelector("#languageSelect");
const copyTranscriptButton = document.querySelector("#copyTranscriptButton");
const downloadTranscriptButton = document.querySelector("#downloadTranscriptButton");
const clearTranscriptButton = document.querySelector("#clearTranscriptButton");
const transcriptText = document.querySelector("#transcriptText");
const transcriptionStatus = document.querySelector("#transcriptionStatus");
const transcriptionHelp = document.querySelector("#transcriptionHelp");

const state = {
  recognition: null,
  supported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  listening: false,
  finalText: "",
  interimText: "",
  nativeDictation: false,
};

transcribeButton.addEventListener("click", toggleTranscription);
copyTranscriptButton.addEventListener("click", copyTranscript);
downloadTranscriptButton.addEventListener("click", downloadTranscript);
clearTranscriptButton.addEventListener("click", clearTranscript);
languageSelect.addEventListener("change", () => {
  if (state.recognition) {
    state.recognition.lang = languageSelect.value;
  }
});

setupTranscription();

function setupTranscription() {
  if (!window.isSecureContext) {
    transcribeButton.disabled = true;
    transcriptionStatus.textContent = "利用不可";
    transcriptionHelp.textContent = "マイクを使うにはHTTPSのURLで開いてください。GitHub Pagesの公開URLから開くと利用できます。";
    return;
  }

  if (isAppleMobileBrowser()) {
    enableNativeDictationMode();
    return;
  }

  if (!state.supported) {
    enableNativeDictationMode();
    return;
  }
}

function isAppleMobileBrowser() {
  const ua = navigator.userAgent || "";
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isiOS;
}

function enableNativeDictationMode() {
  state.nativeDictation = true;
  transcriptionStatus.textContent = "端末入力";
  transcribeButton.innerHTML = '<span aria-hidden="true"></span> 入力欄を開く';
  transcriptionHelp.textContent = "iPhoneではSafariから直接文字起こしを開始できない場合があります。入力欄をタップし、キーボードのマイクボタンで音声入力してください。";
}

function createRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = languageSelect.value;

  return recognition;
}

function attachRecognitionEvents(recognition) {
  recognition.addEventListener("audiostart", () => {
    transcriptionHelp.textContent = "マイク入力を確認しました。話した内容が下に表示されます。";
  });

  recognition.addEventListener("start", () => {
    state.listening = true;
    transcriptionStatus.textContent = "聞き取り中";
    transcribeButton.classList.add("is-recording");
    transcribeButton.innerHTML = '<span aria-hidden="true"></span> 停止';
  });

  recognition.addEventListener("result", (event) => {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) {
        state.finalText += `${piece.trim()}\n`;
      } else {
        interim += piece;
      }
    }

    state.interimText = interim.trim();
    renderTranscript();
  });

  recognition.addEventListener("end", () => {
    state.listening = false;
    state.interimText = "";
    transcriptionStatus.textContent = transcriptText.value.trim() ? "停止中" : "待機中";
    transcribeButton.classList.remove("is-recording");
    transcribeButton.innerHTML = '<span aria-hidden="true"></span> 文字起こし開始';
    renderTranscript();
  });

  recognition.addEventListener("error", (event) => {
    state.listening = false;
    transcriptionStatus.textContent = "エラー";
    transcribeButton.classList.remove("is-recording");
    transcribeButton.innerHTML = '<span aria-hidden="true"></span> 文字起こし開始';
    transcriptionHelp.textContent = getRecognitionErrorMessage(event.error);
  });
}

async function toggleTranscription() {
  if (state.nativeDictation) {
    focusManualDictation();
    return;
  }

  if (state.listening) {
    state.recognition?.stop();
    return;
  }

  transcriptionStatus.textContent = "準備中";
  transcriptionHelp.textContent = "マイクの使用許可を確認しています。";

  try {
    await ensureMicrophonePermission();
    state.recognition = createRecognition();
    attachRecognitionEvents(state.recognition);
    state.recognition.start();
  } catch (error) {
    state.listening = false;
    transcriptionStatus.textContent = "エラー";
    transcribeButton.classList.remove("is-recording");
    transcribeButton.innerHTML = '<span aria-hidden="true"></span> 文字起こし開始';
    transcriptionHelp.textContent = getStartErrorMessage(error);
  }
}

function focusManualDictation() {
  transcriptionStatus.textContent = "入力できます";
  transcriptionHelp.textContent = "キーボードが開いたら、マイクボタンを押して話してください。入力された文章はコピーや保存ができます。";
  transcriptText.removeAttribute("readonly");
  transcriptText.focus();
  transcriptText.setSelectionRange(transcriptText.value.length, transcriptText.value.length);
}

async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) return;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function renderTranscript() {
  const divider = state.finalText && state.interimText ? "\n" : "";
  transcriptText.value = `${state.finalText}${divider}${state.interimText}`.trimStart();
  transcriptText.scrollTop = transcriptText.scrollHeight;
}

async function copyTranscript() {
  const text = transcriptText.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    transcriptText.select();
    document.execCommand("copy");
  }

  transcriptionStatus.textContent = "コピー済み";
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
  state.finalText = "";
  state.interimText = "";
  transcriptText.value = "";
  transcriptionStatus.textContent = state.nativeDictation ? "端末入力" : state.listening ? "聞き取り中" : "待機中";
}

function getRecognitionErrorMessage(errorCode) {
  const messages = {
    "audio-capture": "マイクが見つかりません。端末のマイク設定を確認してください。",
    "not-allowed": "マイクの使用が許可されていません。ブラウザの権限設定を確認してください。",
    aborted: "音声認識が中断されました。もう一度「文字起こし開始」を押してください。",
    "bad-grammar": "音声認識の設定を読み込めませんでした。ページを再読み込みしてください。",
    "language-not-supported": "選択した言語はこのブラウザで使えません。日本語またはEnglishを切り替えて試してください。",
    network: "音声認識サービスに接続できません。通信状態を確認してください。",
    "no-speech": "音声を検出できませんでした。もう一度話してください。",
    "service-not-allowed": "このブラウザでは音声認識サービスを利用できません。AndroidのChromeで開いてください。",
  };

  return messages[errorCode] || `文字起こしを開始できませんでした。エラー: ${errorCode || "不明"}。AndroidのChrome、HTTPSの公開URL、マイク許可を確認してください。`;
}

function getStartErrorMessage(error) {
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "マイクの使用が許可されていません。ブラウザの権限設定でマイクを許可してください。";
  }

  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "マイクが見つかりません。端末のマイク設定を確認してください。";
  }

  if (error?.name === "InvalidStateError") {
    return "音声認識がまだ停止処理中です。少し待ってからもう一度押してください。";
  }

  return `文字起こしを開始できませんでした。エラー: ${error?.name || error?.message || "不明"}。AndroidのChrome、HTTPSの公開URL、マイク許可を確認してください。`;
}

if ("serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("./service-worker.js").then((registration) => {
    registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  }).catch(() => {});
}
