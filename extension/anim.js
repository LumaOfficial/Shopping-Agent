// Motion for the documents that ship inside the package — the Terms, the Privacy
// Policy and the Support page. Everything here is decoration: with this file
// absent the pages read exactly as before, because no block is hidden until this
// script says so. A reader whose system asks for reduced motion keeps the still
// page and this file returns before it touches anything.
//
// Nothing in this file reads, stores or sends anything.
(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // ---------- The reading rule ----------
  // A thin gradient along the top of the window showing how much of the document
  // is behind you. Painted at most once a frame.
  const rule = document.createElement("div");
  rule.className = "read-progress";
  rule.setAttribute("aria-hidden", "true");
  document.body.append(rule);

  let ruleFrame = 0;
  const paintRule = () => {
    ruleFrame = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const seen = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    rule.style.setProperty("--p", (seen * 100).toFixed(2) + "%");
  };
  const scheduleRule = () => {
    if (ruleFrame) return;
    ruleFrame = requestAnimationFrame(paintRule);
  };

  window.addEventListener("scroll", scheduleRule, { passive: true });
  window.addEventListener("resize", scheduleRule);
  paintRule();

  // ---------- Arrivals ----------
  // The contents list steps in a line at a time; everything below the fold comes
  // in as the reader reaches it, so a long document moves in beats.
  const contents = Array.from(document.querySelectorAll(".terms-toc li"));
  contents.forEach((item, index) => {
    item.classList.add("js-reveal");
    item.style.setProperty("--i", String(Math.min(index, 10)));
  });

  const blocks = Array.from(
    document.querySelectorAll(".terms-doc section, .terms-doc > p, .terms-doc > ul, .terms-foot p")
  );
  blocks.forEach((block) => block.classList.add("js-reveal"));

  const arrivals = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        arrivals.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
  );
  blocks.forEach((block) => arrivals.observe(block));

  // Two frames, so the still state is on screen before the list starts moving.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => contents.forEach((item) => item.classList.add("is-in")))
  );

  // ---------- A section the reader jumped to ----------
  const flash = (target) => {
    const block = target.closest("section") || target;
    block.classList.remove("is-flash");
    void block.offsetWidth;
    block.classList.add("is-flash");
    window.setTimeout(() => block.classList.remove("is-flash"), 1700);
  };

  const flashFromHash = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (target) flash(target);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    const target = id && document.getElementById(id);
    if (target) flash(target);
  });
  window.addEventListener("hashchange", flashFromHash);

  // ---------- The pointer light ----------
  // A soft light follows the pointer across the paper, and the two cards it
  // passes over light their own inner edge where the pointer is.
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  glow.setAttribute("aria-hidden", "true");
  document.body.append(glow);

  let point = null;
  let lightFrame = 0;
  const moveLight = () => {
    lightFrame = 0;
    const last = point;
    point = null;
    if (!last) return;

    glow.style.setProperty("--x", last.clientX + "px");
    glow.style.setProperty("--y", last.clientY + "px");
    glow.classList.add("is-live");

    const card =
      last.target && last.target.closest
        ? last.target.closest(".terms-toc, .terms-summary")
        : null;
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", last.clientX - box.left + "px");
    card.style.setProperty("--my", last.clientY - box.top + "px");
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      point = event;
      if (lightFrame) return;
      lightFrame = requestAnimationFrame(moveLight);
    },
    { passive: true }
  );

  document.addEventListener("pointerleave", () => glow.classList.remove("is-live"));
})();
