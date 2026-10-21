// The reel (desktop): one pinned browser window that follows the scroll so it always shows
// the project being read, and plays through the products while none is centered.
(() => {
  const reel = document.querySelector(".reel");
  if (!reel) return;
  const stage = reel.querySelector(".reel-stage");
  const screen = stage.querySelector(".screen");
  const scan = screen.querySelector(".scan");
  const win = stage.querySelector(".window");
  const tabs = [...stage.querySelectorAll(".reel-index a")];
  const steps = [...reel.querySelectorAll(".step")];
  const first = screen.querySelector("img");

  // Only the first shot ships in the HTML. The others are copied from each project's own
  // screenshot after the page loads, so they never compete with the first paint.
  const shots = steps.map((s, k) => {
    if (k === 0) return first;
    const img = new Image(1440, 720);
    img.alt = "";
    img.decoding = "async";
    screen.insertBefore(img, scan);
    return img;
  });
  function load(k) {
    const img = shots[k];
    if (img.getAttribute("src")) return;
    const src = steps[k].querySelector(".step-shot img");
    img.sizes = first.sizes;
    img.srcset = src.getAttribute("srcset");
    img.src = src.getAttribute("src");
  }
  // Desktop only (phones hide the window): wait for the first painted frame, then an idle moment.
  const desktop = matchMedia("(min-width: 901px)");
  const loadAll = () => desktop.matches && requestAnimationFrame(() => requestAnimationFrame(() =>
    (window.requestIdleCallback || setTimeout)(() => shots.forEach((_, k) => load(k)))));
  if (document.readyState === "complete") loadAll();
  else addEventListener("load", loadAll, { once: true });
  desktop.addEventListener("change", loadAll);
  const urlText = stage.querySelector(".url-text");
  const pauseBtn = stage.querySelector(".reel-pause");
  const pauseLabel = pauseBtn.querySelector(".pause-label");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const DWELL = 3600;

  let active = 0, timer = 0, typer = 0, typeId = 0;
  let centered = -1, windowVisible = true, hovering = false, userPaused = false;

  steps.forEach((s) => s.style.setProperty("--c", s.dataset.glow));
  stage.style.setProperty("--dwell", `${DWELL}ms`);

  function typeUrl(text) {
    clearInterval(typer);
    const id = ++typeId;
    if (reduce.matches) { urlText.textContent = text; return; }
    let n = 0;
    urlText.textContent = "";
    stage.classList.add("typing");
    typer = setInterval(() => {
      urlText.textContent = text.slice(0, ++n);
      if (n < text.length) return;
      clearInterval(typer);
      setTimeout(() => id === typeId && stage.classList.remove("typing"), 700);
    }, 26);
  }

  function show(i) {
    if (i === active) return;
    load(i);
    stage.classList.add("ready"); // the wipe only runs on changes, never on the first paint
    // A light line rides the leading edge of the wipe.
    if (!reduce.matches && scan.animate) {
      // Movement follows the wipe's easing; the fade runs on real time so the line stays bright most of the way.
      scan.animate([{ transform: "translateY(0)" }, { transform: `translateY(${screen.clientHeight}px)` }], { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      scan.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 900 });
    }
    shots.forEach((img, k) => {
      img.classList.toggle("prev", k === active);
      img.classList.toggle("on", k === i);
    });
    tabs.forEach((t, k) => (k === i ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")));
    stage.style.setProperty("--glow", steps[i].dataset.glow);
    typeUrl(steps[i].dataset.url);
    active = i;
  }

  function update() {
    const scrollMode = desktop.matches && centered >= 0;
    if (scrollMode) show(centered);
    reel.classList.toggle("synced", scrollMode);
    steps.forEach((s, k) => s.classList.toggle("is-active", scrollMode && k === centered));

    stage.classList.toggle("auto", !scrollMode && !reduce.matches);
    clearInterval(timer);
    const run = !scrollMode && windowVisible && !userPaused && !hovering && !reduce.matches && !document.hidden;
    stage.classList.toggle("playing", run);
    if (run) timer = setInterval(() => show((active + 1) % shots.length), DWELL);
  }

  // A thin band across the middle of the viewport decides which project is being read.
  const band = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const i = steps.indexOf(e.target);
      if (e.isIntersecting) centered = i;
      else if (centered === i) centered = -1;
    }
    update();
  }, { rootMargin: "-48% 0px -48% 0px" });
  steps.forEach((s) => band.observe(s));

  new IntersectionObserver(([e]) => { windowVisible = e.isIntersecting; update(); })
    .observe(stage.querySelector(".window"));

  const stageIn = stage.querySelector(".stage-in");
  stageIn.addEventListener("mouseenter", () => { hovering = true; update(); });
  stageIn.addEventListener("mouseleave", () => { hovering = false; update(); });
  stageIn.addEventListener("focusin", () => { hovering = true; update(); });
  stageIn.addEventListener("focusout", (e) => { if (!stageIn.contains(e.relatedTarget)) { hovering = false; update(); } });

  // The window leans toward the pointer, with a soft glare. Mouse and trackpad only.
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let tiltFrame = 0;
  win.addEventListener("pointermove", (e) => {
    if (!fine.matches || reduce.matches) return;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      const r = win.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      win.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
      win.style.setProperty("--ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
      win.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      win.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      win.classList.add("tilt");
    });
  });
  win.addEventListener("pointerleave", () => {
    cancelAnimationFrame(tiltFrame);
    win.classList.remove("tilt");
    win.style.removeProperty("--rx");
    win.style.removeProperty("--ry");
  });

  pauseBtn.addEventListener("click", () => {
    userPaused = !userPaused;
    pauseBtn.toggleAttribute("data-paused", userPaused);
    pauseLabel.textContent = userPaused ? "Play" : "Pause";
    pauseBtn.setAttribute("aria-label", userPaused ? "Play the product reel" : "Pause the product reel");
    update();
  });

  document.addEventListener("visibilitychange", update);
  reduce.addEventListener("change", update);
  desktop.addEventListener("change", update);
  update();
})();

// Reveal later sections as they scroll into view (CSS only hides them when motion is allowed).
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 })
  : null;
document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

// The hero wall: columns of screenshots drift in a loop, a light follows the pointer.
(() => {
  const hero = document.querySelector(".hero");
  const wall = hero?.querySelector(".wall");
  if (!wall) return;
  const shade = wall.querySelector(".wall-shade");
  const btn = hero.querySelector(".wall-pause");
  const label = btn.querySelector(".pause-label");

  // Repeat each column's 4 shots twice more so it fills the screen and loops without a seam.
  wall.querySelectorAll(".wall-col").forEach((col) => {
    const tiles = [...col.children];
    col.append(...tiles.map((n) => n.cloneNode(true)), ...tiles.map((n) => n.cloneNode(true)));
  });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) wall.classList.add("loop");
  btn.addEventListener("click", () => {
    const paused = wall.classList.toggle("paused");
    btn.toggleAttribute("data-paused", paused);
    label.textContent = paused ? "Play" : "Pause";
    btn.setAttribute("aria-label", paused ? "Play the background animation" : "Pause the background animation");
  });
  // Stop drawing the drift while the hero is off screen.
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => wall.classList.toggle("off", !e.isIntersecting)).observe(hero);

  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let frame = 0;
  hero.addEventListener("pointermove", (e) => {
    if (!fine.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = wall.getBoundingClientRect();
      shade.style.setProperty("--mx", `${e.clientX - r.left}px`);
      shade.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
  hero.addEventListener("pointerleave", () => { cancelAnimationFrame(frame); shade.style.removeProperty("--mx"); shade.style.removeProperty("--my"); });
})();

// Highlight the header link for the section being read.
(() => {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map([...document.querySelectorAll(".nav a")].map((a) => [a.hash, a]));
  // Non-overlapping blocks in page order; the hero clears the highlight.
  const blocks = document.querySelectorAll(".work-title, .step, main > section:not(.reel)");
  const keyOf = (el) => (el.matches(".hero, #process") ? "" : el.matches(".work-title, .step, .more") ? "#work" : `#${el.id}`);
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const key = keyOf(e.target);
      links.forEach((a, hash) => (hash === key ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    }
  }, { rootMargin: "-45% 0px -54% 0px" });
  blocks.forEach((b) => spy.observe(b));
})();

// Skill cards light up under the pointer.
document.addEventListener("pointermove", (e) => {
  const card = e.pointerType === "mouse" && e.target.closest?.(".spot");
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty("--x", `${e.clientX - r.left}px`);
  card.style.setProperty("--y", `${e.clientY - r.top}px`);
}, { passive: true });

// Copy email with visible and screen-reader feedback.
const copyBtn = document.getElementById("copy-email");
const status = document.getElementById("copy-status");
copyBtn?.addEventListener("click", async () => {
  const label = copyBtn.querySelector(".copy-label");
  try {
    await navigator.clipboard.writeText(copyBtn.dataset.email);
    copyBtn.classList.add("done");
    label.textContent = "Copied";
    status.textContent = "Email address copied";
  } catch {
    label.textContent = "Copy failed, use Email me";
    status.textContent = "Could not copy. Use the Email me button instead.";
  }
  setTimeout(() => { copyBtn.classList.remove("done"); label.textContent = "Copy email"; }, 2200);
});
