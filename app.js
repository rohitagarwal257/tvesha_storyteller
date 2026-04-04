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
  const btnAnotherStory = document.getElementById("btnAnotherStory");
  const btnRead = document.getElementById("btnRead");
  const btnRestart = document.getElementById("btnRestart");
  const btnPause = document.getElementById("btnPause");
  const btnResume = document.getElementById("btnResume");
  const btnStop = document.getElementById("btnStop");

  /** @type {string | null} */
  let selectedTopic = null;
  /** @type {Record<string, number | null>} */
  let lastIndexByTopic = {};
  /** @type {{ title: string, paragraphs: string[], moral?: string } | null} */
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
  }

  function setSpeakingUi(active) {
    speaking = active;
    if (active) {
      btnRead.disabled = true;
      if (btnRestart) btnRestart.disabled = false;
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

  function scrollToStoryMoral() {
    const el = document.getElementById("storyMoral");
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

    if (story.moral && String(story.moral).trim()) {
      const moralEl = document.createElement("p");
      moralEl.id = "storyMoral";
      moralEl.className = "story-moral";
      moralEl.textContent = String(story.moral).trim();
      contentEl.appendChild(moralEl);
    }

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
    lastIndexByTopic[topic] = idx;
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
      if (btnAnotherStory) btnAnotherStory.disabled = false;
    } else {
      topicChosen.hidden = true;
      topicChosenLabel.textContent = "";
      if (btnAnotherStory) btnAnotherStory.disabled = true;
    }
  }

  /** Prefer natural-sounding English voices when the OS exposes them. */
  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;

    const en = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
    const pool = en.length ? en : voices;

    function scoreVoice(v) {
      const n = (v.name || "").toLowerCase();
      let score = 0;
      if (/google|natural|neural|premium|enhanced/.test(n)) score += 5;
      if (
        /female|zira|samantha|karen|victoria|hazel|moira|serena|susan|linda|tessa|fiona|flo|google uk english female/.test(n)
      )
        score += 3;
      if (/male|david|daniel|fred|mark/.test(n)) score -= 2;
      return score;
    }

    let best = pool[0];
    let bestScore = scoreVoice(best);
    for (let i = 1; i < pool.length; i++) {
      const s = scoreVoice(pool[i]);
      if (s > bestScore) {
        bestScore = s;
        best = pool[i];
      }
    }
    return best;
  }

  function buildUtterance(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.75;
    u.pitch = 0.97;
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

  function startSpeech() {
    if (!currentStory || !currentStory.paragraphs.length) return;
    window.speechSynthesis.cancel();

    const slice = currentStory.paragraphs;
    const titleLine = "The story is called " + currentStory.title + ".";
    const texts = [titleLine].concat(slice);
    const moralText = currentStory.moral && String(currentStory.moral).trim();
    if (moralText) {
      texts.push("The moral of the story is: " + moralText);
    }

    utteranceQueue = [];
    texts.forEach(function (text, i) {
      const u = buildUtterance(text);
      u.onstart = function () {
        if (i === 0) {
          scrollToStoryTitle();
        } else if (i <= slice.length) {
          scrollToStoryParagraph(i - 1);
        } else {
          scrollToStoryMoral();
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
      const avoid = lastIndexByTopic[topic] != null ? lastIndexByTopic[topic] : null;
      showStoryForTopic(topic, avoid);
      if (currentStory) startSpeech();
    });
  });

  if (btnAnotherStory) {
    btnAnotherStory.addEventListener("click", () => {
      if (!selectedTopic) return;
      showStoryForTopic(selectedTopic, lastIndexByTopic[selectedTopic] ?? null);
    });
  }

  btnRead.addEventListener("click", () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      btnPause.disabled = false;
      btnResume.disabled = true;
      return;
    }
    startSpeech();
  });

  if (btnRestart) {
    btnRestart.addEventListener("click", () => startSpeech());
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
  window.speechSynthesis.getVoices();
})();
