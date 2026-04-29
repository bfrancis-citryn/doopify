const dot = document.getElementById("cursor-dot");
const ring = document.getElementById("cursor-ring");
let rx = 0,
  ry = 0,
  mx = 0,
  my = 0;

document.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
  dot.style.left = mx + "px";
  dot.style.top = my + "px";
});

(function lerpRing() {
  rx += (mx - rx) * 0.14;
  ry += (my - ry) * 0.14;
  ring.style.left = rx + "px";
  ring.style.top = ry + "px";
  requestAnimationFrame(lerpRing);
})();

/* ── MARQUEE ─────────────────────────────────────────── */
const items = [
  "Glitch",
  "Aurora",
  "Glassmorphism",
  "Scramble",
  "Spotlight",
  "Conic Border",
  "3D Tilt",
  "Noise",
  "Counter"
];
const track = document.getElementById("marquee");
const make = () =>
  items
    .map(
      (t) =>
        `<span class="marquee-item">${t}</span><span class="marquee-sep">✦</span>`
    )
    .join("");
track.innerHTML = make() + make(); // duplicate for seamless loop

/* ── 3D TILT ─────────────────────────────────────────── */
document.querySelectorAll("[data-tilt]").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${
      -y * 14
    }deg) scale(1.03)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transition =
      "transform .6s cubic-bezier(.23,1,.32,1), box-shadow .4s";
    card.style.transform = "";
    setTimeout(() => (card.style.transition = ""), 600);
  });
  card.addEventListener("mouseenter", () => {
    card.style.transition = "transform .12s ease, box-shadow .4s";
  });
});

/* ── TEXT SCRAMBLE ───────────────────────────────────── */
const CHARS = "!<>-_\\/[]{}—=+*^?#░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌";
const scrambleEl = document.getElementById("scramble-text");
const PHRASES = [
  "no libraries. no mercy.",
  "your cursor > their framework.",
  "ship it. no deps. no regrets.",
  "the browser is enough.",
  "pure css goes hard. ✦"
];
let phraseIdx = 0;
let scrambleTimer = null;

function scramble(el, newText) {
  clearInterval(scrambleTimer);
  const len = Math.max(el.innerText.length, newText.length);
  let iter = 0;
  scrambleTimer = setInterval(() => {
    el.innerText = newText
      .split("")
      .map((ch, i) => {
        if (i < iter) return newText[i];
        if (ch === " ") return " ";
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      })
      .join("");
    if (iter >= len + 4) clearInterval(scrambleTimer);
    iter += 0.6;
  }, 38);
}

scrambleEl.addEventListener("mouseenter", () => {
  phraseIdx = (phraseIdx + 1) % PHRASES.length;
  scramble(scrambleEl, PHRASES[phraseIdx]);
});

scramble(scrambleEl, PHRASES[0]); // init

/* ── SPOTLIGHT CANVAS ────────────────────────────────── */
const spotSection = document.querySelector(".spotlight-section");
const canvas = document.getElementById("spotlight-canvas");
const ctx = canvas.getContext("2d");
let slx = -999,
  sly = -999;

function resizeCanvas() {
  const r = spotSection.getBoundingClientRect();
  canvas.width = r.width;
  canvas.height = r.height;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

spotSection.addEventListener("mousemove", (e) => {
  const r = spotSection.getBoundingClientRect();
  slx = e.clientX - r.left;
  sly = e.clientY - r.top;
});

spotSection.addEventListener("mouseleave", () => {
  slx = -999;
  sly = -999;
});

(function drawSpotlight() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (slx !== -999) {
    const g = ctx.createRadialGradient(slx, sly, 0, slx, sly, 260);
    g.addColorStop(0, "rgba(179,255,200,.12)");
    g.addColorStop(0.5, "rgba(94,173,255,.06)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(drawSpotlight);
})();

/* ── SCROLL REVEAL ───────────────────────────────────── */
const reveals = document.querySelectorAll(".reveal");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("in-view");
    });
  },
  { threshold: 0.12 }
);
reveals.forEach((el) => io.observe(el));

/* ── ANIMATED COUNTERS ───────────────────────────────── */
const counters = document.querySelectorAll(".stat-num");
const cio = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.target;
      const dur = 1800;
      let start = null;
      const ease = (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      (function tick(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        el.textContent = Math.floor(ease(p) * target).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString();
      })(performance.now());
      cio.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
counters.forEach((el) => cio.observe(el));
