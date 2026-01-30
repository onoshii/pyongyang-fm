(() => {
  "use strict";

  // Kuasark widget API (station info)
  const API = "https://kuasark.com/ja/api/widget/stations/pyongyang-radio-fm/";

  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("playBtn");
  const btnIcon = document.getElementById("btnIcon");
  const btnLabel = document.getElementById("btnLabel");
  const btnSpinner = document.getElementById("btnSpinner");
  const statusText = document.getElementById("statusText");
  const hintText = document.getElementById("hintText");
  const volume = document.getElementById("volume");

  /** @type {string|null} */
  let streamUrl = null;

  /** 状態管理 */
  const State = {
    INIT: "準備中…",
    FETCHING: "ストリーム情報取得中…",
    READY: "待機中",
    CONNECTING: "接続中…",
    PLAYING: "再生中",
    PAUSED: "停止中",
    BUFFERING: "バッファ中…",
    ENDED: "終了",
    ERROR: "エラー",
  };

  function setStatus(text, hint = "") {
    statusText.textContent = text;
    hintText.textContent = hint || "";
  }

  function setLoading(isLoading) {
    playBtn.dataset.loading = isLoading ? "true" : "false";
  }

  function setButtonEnabled(enabled) {
    playBtn.disabled = !enabled;
  }

  function setButtonPlaying(isPlaying) {
    btnIcon.textContent = isPlaying ? "⏸" : "▶";
    btnLabel.textContent = isPlaying ? "停止" : "再生";
  }

  async function fetchStreamUrl() {
    setStatus(State.FETCHING, "APIから放送URLを取得しています。");
    setButtonEnabled(false);

    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);

    const data = await res.json();
    if (!data?.station?.stream_url) throw new Error("station.stream_url not found");

    return data.station.stream_url;
  }

  async function startPlayback() {
    if (!streamUrl) {
      setStatus(State.ERROR, "放送URLが未取得です。リロードしてください。");
      return;
    }

    setLoading(true);
    setStatus(State.CONNECTING, "ブラウザの制限により、最初の再生はクリックが必要です。");

    try {
      // 初回は src を入れてから play()
      if (audio.src !== streamUrl) audio.src = streamUrl;

      await audio.play();
      setButtonPlaying(true);
      setStatus(State.PLAYING, "");
    } catch (e) {
      console.error(e);
      setButtonPlaying(false);

      // よくある原因：自動再生ブロック / フォーマット非対応 / ネットワーク遮断
      setStatus(State.ERROR, "再生に失敗しました。別ブラウザ/ネットワークで試してください。");
    } finally {
      setLoading(false);
    }
  }

  function stopPlayback() {
    audio.pause();
    setButtonPlaying(false);
    setStatus(State.PAUSED, "");
  }

  /** ---- 初期化 ---- */
  (async () => {
    setStatus(State.INIT, "起動中…");
    setButtonPlaying(false);
    setLoading(false);
    setButtonEnabled(false);

    // 音量
    audio.volume = Number(volume.value);
    volume.addEventListener("input", () => {
      audio.volume = Number(volume.value);
    });

    // Audioイベント：表示だけきれいにする
    audio.addEventListener("playing", () => {
      setButtonPlaying(true);
      setStatus(State.PLAYING, "");
    });
    audio.addEventListener("pause", () => {
      // "pause"は停止・バッファ終了などでも来るので、厳密には isPlaying を見る
      if (audio.ended) return;
      if (!audio.paused) return;
      setButtonPlaying(false);
      // クリック停止か、外部要因かはここでは区別しない
      setStatus(State.PAUSED, "");
    });
    audio.addEventListener("waiting", () => {
      // ネットワークが詰まっている時など
      if (!audio.paused) setStatus(State.BUFFERING, "回線状況により一時的に待機しています。");
    });
    audio.addEventListener("stalled", () => {
      if (!audio.paused) setStatus(State.BUFFERING, "通信が一時停止しました。");
    });
    audio.addEventListener("ended", () => {
      setButtonPlaying(false);
      setStatus(State.ENDED, "");
    });
    audio.addEventListener("error", () => {
      const err = audio.error;
      console.error("audio error:", err);
      setButtonPlaying(false);
      setLoading(false);
      setStatus(State.ERROR, "音声の読み込みでエラーが発生しました。");
    });

    // API取得
    try {
      streamUrl = await fetchStreamUrl();
      console.log("stream_url:", streamUrl);
      setStatus(State.READY, "再生ボタンを押すと開始します。");
      setButtonEnabled(true);
    } catch (e) {
      console.error(e);
      setStatus(State.ERROR, "ストリーム情報の取得に失敗しました（ブロック/回線/制限の可能性）。");
      setButtonEnabled(false);
    }

    // ボタン操作
    playBtn.addEventListener("click", async () => {
      // 連打防止：接続中は無視
      if (playBtn.dataset.loading === "true") return;

      if (audio.paused) {
        await startPlayback();
      } else {
        stopPlayback();
      }
    });
  })();
})();
