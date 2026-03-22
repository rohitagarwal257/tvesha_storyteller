(function () {
  const TOPIC_LABELS = {
    unicorn: "Unicorn",
    fantasy: "Fantasy",
    magic: "Magic",
    fairies: "Fairies",
  };

  const contentEl = document.getElementById("storyContent");
  const topicChosen = document.getElementById("topicChosen");
  const topicChosenLabel = document.getElementById("topicChosenLabel");
  const btnTonightStory = document.getElementById("btnTonightStory");
  const btnAnotherStory = document.getElementById("btnAnotherStory");
  const btnRead = document.getElementById("btnRead");
  const btnRestart = document.getElementById("btnRestart");
  const btnReadBegin = document.getElementById("btnReadBegin");
  const btnReadMiddle = document.getElementById("btnReadMiddle");
  const btnReadEnd = document.getElementById("btnReadEnd");
  const btnPause = document.getElementById("btnPause");
  const btnResume = document.getElementById("btnResume");
  const btnStop = document.getElementById("btnStop");

  /** @type {string | null} */
  let selectedTopic = null;
  /** @type {number | null} */
  let lastIndexForTopic = null;
  /** @type {{ title: string, paragraphs: string[] } | null} */
  let currentStory = null;
  let utteranceQueue = [];
  let queueIndex = 0;
  let speaking = false;

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function getStoryBank() {
    return window.PRELOADED_STORIES_BY_TOPIC || null;
  }

  function setStoryPlaybackEnabled(on) {
    btnRead.disabled = !on;
    if (btnRestart) btnRestart.disabled = !on;
    if (btnReadBegin) btnReadBegin.disabled = !on;
    if (btnReadMiddle) btnReadMiddle.disabled = !on;
    if (btnReadEnd) btnReadEnd.disabled = !on;
  }

  function setSpeakingUi(active) {
    speaking = active;
    if (active) {
      btnRead.disabled = true;
      if (btnRestart) btnRestart.disabled = false;
      if (btnReadBegin) btnReadBegin.disabled = false;
      if (btnReadMiddle) btnReadMiddle.disabled = false;
      if (btnReadEnd) btnReadEnd.disabled = false;
      btnPause.disabled = false;
      btnResume.disabled = true;
      btnStop.disabled = false;
    } else {
      if (currentStory) {
        setStoryPlaybackEnabled(true);
      }
      btnPause.disabled = true;
      btnResume.disabled = true;
      btnStop.disabled = true;
    }
  }

  function getParagraphSliceRange(part) {
    const n = currentStory?.paragraphs.length ?? 0;
    if (n === 0) return [0, 0];
    if (part === "full" || part === "restart") return [0, n];
    if (n === 1) return [0, 1];
    if (n === 2) {
      if (part === "begin") return [0, 1];
      if (part === "middle") return [1, 2];
      return [0, 2];
    }
    const b = Math.floor(n / 3);
    const m = Math.floor((2 * n) / 3);
    const i1 = Math.max(1, b);
    const i2 = Math.max(i1 + 1, m);
    if (part === "begin") return [0, i1];
    if (part === "middle") return [i1, i2];
    if (part === "end") return [i2, n];
    return [0, n];
  }

  function scrollToStoryParagraph(index) {
    const el = document.getElementById("story-p-" + index);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function scrollToStoryTitle() {
    const el = document.getElementById("storyTitle");
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function renderPlaceholder(message) {
    currentStory = null;
    contentEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "placeholder";
    p.innerHTML = message;
    contentEl.appendChild(p);
    stopSpeechInternal();
    setStoryPlaybackEnabled(false);
    btnPause.disabled = true;
    btnResume.disabled = true;
    btnStop.disabled = true;
  }

  function renderStoryData(story) {
    if (!story || !story.paragraphs || !story.paragraphs.length) return;

    currentStory = story;
    const title = document.createElement("h3");
    title.id = "storyTitle";
    title.textContent = story.title;

    contentEl.innerHTML = "";
    contentEl.appendChild(title);

    story.paragraphs.forEach((paraText, i) => {
      const para = document.createElement("p");
      para.id = "story-p-" + i;
      para.textContent = paraText;
      contentEl.appendChild(para);
    });

    stopSpeechInternal();
    setStoryPlaybackEnabled(true);
    btnPause.disabled = true;
    btnResume.disabled = true;
    btnStop.disabled = true;
  }

  function pickStoryIndex(topic, avoidIndex) {
    const bank = getStoryBank();
    const list = bank && bank[topic];
    if (!list || !list.length) return null;
    if (list.length === 1) return 0;
    let idx = Math.floor(Math.random() * list.length);
    let guard = 0;
    while (avoidIndex !== null && avoidIndex !== undefined && idx === avoidIndex && guard < 24) {
      idx = Math.floor(Math.random() * list.length);
      guard += 1;
    }
    return idx;
  }

  function showStoryForTopic(topic, avoidIndex) {
    const bank = getStoryBank();
    if (!bank) {
      renderPlaceholder(
        "Stories didn’t load. Make sure <strong>preloaded-stories.js</strong> is in the same folder and refresh the page."
      );
      return;
    }
    const list = bank[topic];
    if (!list || !list.length) {
      renderPlaceholder("No stories for that topic yet.");
      return;
    }

    const idx = pickStoryIndex(topic, avoidIndex);
    if (idx === null) return;
    lastIndexForTopic = idx;
    renderStoryData(list[idx]);
  }

  function updateTopicUi() {
    document.querySelectorAll(".topic-card").forEach((btn) => {
      const t = btn.getAttribute("data-topic");
      btn.classList.toggle("selected", t === selectedTopic);
    });

    if (selectedTopic && TOPIC_LABELS[selectedTopic]) {
      topicChosen.hidden = false;
      topicChosenLabel.textContent = TOPIC_LABELS[selectedTopic];
      btnTonightStory.disabled = false;
      btnAnotherStory.disabled = false;
    } else {
      topicChosen.hidden = true;
      topicChosenLabel.textContent = "";
      btnTonightStory.disabled = true;
      btnAnotherStory.disabled = true;
    }
  }

  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /female/i.test(v.name) && v.lang.startsWith("en")) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0] ||
      null
    );
  }

  function buildUtterance(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.05;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    return u;
  }

  function finishSpeaking() {
    setSpeakingUi(false);
  }

  function speakNext() {
    if (!speaking) return;
    if (queueIndex >= utteranceQueue.length) {
      finishSpeaking();
      return;
    }
    const u = utteranceQueue[queueIndex];
    queueIndex += 1;
    u.onend = () => speakNext();
    u.onerror = () => finishSpeaking();
    window.speechSynthesis.speak(u);
  }

  function startSpeech(part) {
    if (!currentStory || !currentStory.paragraphs.length) return;
    window.speechSynthesis.cancel();

    const [start, end] = getParagraphSliceRange(part === "restart" ? "full" : part);
    const slice = currentStory.paragraphs.slice(start, end);
    if (!slice.length) return;

    const titleLine = "The story is called " + currentStory.title + ".";
    const texts = [titleLine].concat(slice);

    utteranceQueue = [];
    texts.forEach(function (text, i) {
      const u = buildUtterance(text);
      u.onstart = function () {
        if (i === 0) {
          scrollToStoryTitle();
        } else {
          scrollToStoryParagraph(start + i - 1);
        }
      };
      utteranceQueue.push(u);
    });
    queueIndex = 0;
    setSpeakingUi(true);
    speakNext();
  }

  function stopSpeechInternal() {
    window.speechSynthesis.cancel();
    speaking = false;
    utteranceQueue = [];
    queueIndex = 0;
  }

  function stopSpeech() {
    stopSpeechInternal();
    if (currentStory) {
      setStoryPlaybackEnabled(true);
    }
    btnPause.disabled = true;
    btnResume.disabled = true;
    btnStop.disabled = true;
  }

  document.querySelectorAll(".topic-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const topic = btn.getAttribute("data-topic");
      if (!topic) return;
      selectedTopic = topic;
      updateTopicUi();
    });
  });

  if (btnTonightStory) {
    btnTonightStory.addEventListener("click", () => {
      if (!selectedTopic) {
        renderPlaceholder("Choose a world first—<strong>Unicorn</strong>, <strong>Fantasy</strong>, <strong>Magic</strong>, or <strong>Fairies</strong>.");
        return;
      }
      showStoryForTopic(selectedTopic, null);
    });
  }

  if (btnAnotherStory) {
    btnAnotherStory.addEventListener("click", () => {
      if (!selectedTopic) return;
      showStoryForTopic(selectedTopic, lastIndexForTopic);
    });
  }

  btnRead.addEventListener("click", () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      btnPause.disabled = false;
      btnResume.disabled = true;
      return;
    }
    startSpeech("full");
  });

  if (btnRestart) {
    btnRestart.addEventListener("click", () => startSpeech("restart"));
  }
  if (btnReadBegin) {
    btnReadBegin.addEventListener("click", () => startSpeech("begin"));
  }
  if (btnReadMiddle) {
    btnReadMiddle.addEventListener("click", () => startSpeech("middle"));
  }
  if (btnReadEnd) {
    btnReadEnd.addEventListener("click", () => startSpeech("end"));
  }

  btnPause.addEventListener("click", () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      btnPause.disabled = true;
      btnResume.disabled = false;
    }
  });

  btnResume.addEventListener("click", () => {
    window.speechSynthesis.resume();
    btnPause.disabled = false;
    btnResume.disabled = true;
  });

  btnStop.addEventListener("click", () => {
    stopSpeech();
  });

  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
})();
