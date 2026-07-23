/* =========================================================
   Respect reduced-motion preference globally
   ========================================================= */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   0. Hero headline rotator
   ========================================================= */
(function heroHeadlineRotator() {
  const phraseEl = document.getElementById('headline-phrase');
  if (!phraseEl) return;

  const phrases = [
    "don't fall over",
    'are fast & reliable',
    'scale in production',
    'are maintainable',
  ];
  const typeSpeed = 55;
  const backspaceSpeed = 32;
  const holdSpeed = 1400;
  let stop = false;

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function setPhrase(text) {
    phraseEl.textContent = text;
  }

  async function typeText(text) {
    for (let i = 1; i <= text.length && !stop; i++) {
      setPhrase(text.slice(0, i));
      await sleep(typeSpeed);
    }
  }

  async function backspaceText(text) {
    for (let i = text.length; i >= 0 && !stop; i--) {
      setPhrase(text.slice(0, i));
      await sleep(backspaceSpeed);
    }
  }

  async function run() {
    let current = phrases[0];
    setPhrase(current);
    while (!stop) {
      await sleep(holdSpeed);
      const next = phrases[(phrases.indexOf(current) + 1) % phrases.length];
      await backspaceText(current);
      if (stop) return;
      await sleep(120);
      await typeText(next);
      current = next;
    }
  }

  if (REDUCE_MOTION) return;

  run();

  window.addEventListener('pagehide', () => { stop = true; }, { once: true });
})();

/* =========================================================
   1. Uptime clock — ticks up from page load
   ========================================================= */
(function uptime() {
  const el = document.getElementById('uptime');
  if (!el) return;
  const start = Date.now();
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    const diff = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  tick();
  setInterval(tick, 1000);
})();

/* =========================================================
   1.5. open_to_work click easter egg
   ========================================================= */
(function openToWorkEasterEgg() {
  const statusEl = document.getElementById('open-to-work');
  if (!statusEl) return;

  const statusPill = statusEl.closest('.status-pill');
  const messages = [
    'open_to_work',
    'open_to_debugging_at_2am',
    'open_to_coffee-powered_commits',
    'open_to_fixing_production_before_it_panics',
    'open_to_turning_it_off_and_on_again',
  ];
  let index = 0;
  let resetTimer = null;

  function setMessage(nextIndex) {
    statusEl.textContent = messages[nextIndex];
  }

  function poke() {
    index = (index + 1) % messages.length;
    setMessage(index);

    if (statusPill && !REDUCE_MOTION) {
      statusPill.classList.remove('is-jiggling');
      void statusPill.offsetWidth;
      statusPill.classList.add('is-jiggling');
    }

    clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      index = 0;
      setMessage(index);
    }, 3200);
  }

  statusEl.addEventListener('click', poke);
  statusEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      poke();
    }
  });

  window.addEventListener('pagehide', () => clearTimeout(resetTimer), { once: true });
})();

/* =========================================================
   2. Animated metric counters
   ========================================================= */
function animateCount(el, target, opts = {}) {
  if (!el) return;
  const duration = opts.duration || 1800;
  const suffix = opts.suffix || '';
  const format = opts.format || (n => Math.round(n).toLocaleString('en-US'));
  const start = performance.now();

  if (REDUCE_MOTION) {
    el.textContent = format(target) + suffix;
    return;
  }

  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = easeOutExpo(t);
    el.textContent = format(target * eased) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const cpCard = document.querySelector('.cp-card');
if (cpCard) {
  const cpObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(document.getElementById('metric-solved'), 1100, { duration: 1400, suffix: '+' });
        cpObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });
  cpObserver.observe(cpCard);
}

/* =========================================================
   3. Hero canvas — tabbed multi-project live demo panel
   Each project owns: init(w,h) -> state, draw(ctx,w,h,state,dt)
   Metrics: type 'count' (animated number, real/benchmarked) or
   'live' (running tally driven by the animation's own events —
   framed as a demo counter, never a real production stat) or
   'text' (static/cycling label, e.g. a classification result).
   ========================================================= */
(function heroPanelController() {
  const canvas = document.getElementById('stream-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const titleEl = document.getElementById('panel-title');
  const tagEl = document.getElementById('panel-tag');
  const footEl = document.getElementById('panel-foot');
  const tabsEl = document.getElementById('panel-tabs');
  const labelA = document.getElementById('metric-a-label');
  const valueA = document.getElementById('metric-a-value');
  const unitA = document.getElementById('metric-a-unit');
  const labelB = document.getElementById('metric-b-label');
  const valueB = document.getElementById('metric-b-value');
  const unitB = document.getElementById('metric-b-unit');

  let width = canvas.clientWidth;
  let height = 220;

  function resize() {
    width = canvas.clientWidth;
    height = 220;
    canvas.width = width * DPR;
    canvas.height = height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', () => { resize(); if (active) active.state = active.project.init(width, height); });

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < width; gx += 28) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
  }

  function label(x, y, text, color) {
    ctx.fillStyle = color;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(text, x, y);
  }

  /* ---------- 1. rate-limiter: packet stream through a gate ---------- */
  const rateLimiter = {
    label: 'rate-limiter',
    tag: 'c++17 · self-built',
    foot: 'token-bucket algorithm · sliding window fallback · zero dropped requests under test load',
    metrics: [
      { label: 'in-memory throughput', type: 'count', target: 6500000, unit: 'req/sec' },
      { label: 'redis-backed · 64 threads', type: 'count', target: 66000, unit: 'req/sec' },
    ],
    init(w, h) {
      return { particles: Array.from({ length: REDUCE_MOTION ? 0 : 46 }, () => this.spawn(w, h)) };
    },
    spawn(w, h) {
      return {
        x: -10 - Math.random() * w * 0.6,
        y: 24 + Math.random() * (h - 48),
        speed: 1.1 + Math.random() * 1.6,
        size: 1.6 + Math.random() * 1.8,
        accepted: Math.random() > 0.12,
        dropped: false,
        dropFrame: 0,
      };
    },
    draw(ctx, w, h, state) {
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }

      const gx = w * 0.72;
      ctx.strokeStyle = 'rgba(245,166,35,0.5)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(gx, 10);
      ctx.lineTo(gx, h - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(245,166,35,0.85)';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('limiter', gx - 24, h - 14);

      state.particles.forEach(p => {
        p.x += p.speed;

        if (p.x >= gx && !p.dropped && !p.accepted) {
          p.dropped = true;
          p.dropFrame = 0;
        }

        if (p.dropped) {
          p.dropFrame++;
          ctx.globalAlpha = Math.max(0, 1 - p.dropFrame / 18);
          ctx.fillStyle = '#EF6461';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + p.dropFrame * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (p.dropFrame > 18) Object.assign(p, this.spawn(w, h));
          return;
        }

        const color = p.x < gx ? '#4FD1C5' : '#F5A623';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (p.x > w + 10) Object.assign(p, this.spawn(w, h));
      });
    },
  };

  /* ---------- 2. complyvault: packets moving through pipeline stages ---------- */
  const complyVault = {
    label: 'complyvault.pipeline',
    tag: 'spring boot · kafka',
    foot: 'ingestion → validation → normalization → dedup → storage → policy → review, audited end to end',
    metrics: [
      { label: 'records processed (demo)', type: 'live', unit: '' },
      { label: 'pipeline', type: 'text', value: '6 stages + audit logging' },
    ],
    stageNames: ['ingestion', 'validation', 'normalization', 'deduplication', 'storage', 'policy'],
    init(w, h) {
      const n = this.stageNames.length;
      const nodes = this.stageNames.map((name, i) => ({
        name,
        x: w * 0.08 + (i / (n - 1)) * w * 0.84,
        y: h * 0.42,
        pulse: 0,
      }));
      const count = REDUCE_MOTION ? 0 : 10;
      return {
        nodes,
        packets: Array.from({ length: count }, (_, i) => this.spawn(i / count)),
        processed: 0,
      };
    },
    spawn(offset = 0) {
      return { progress: -offset, speed: 0.0032 + Math.random() * 0.0015 };
    },
    draw(ctx, w, h, state) {
      drawGrid();
      const nodes = state.nodes;

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      nodes.slice(1).forEach(n => ctx.lineTo(n.x, n.y));
      ctx.stroke();

      nodes.forEach(n => {
        n.pulse *= 0.9;
        const r = 6 + n.pulse * 5;
        ctx.fillStyle = n.pulse > 0.08 ? '#F5A623' : '#1B1F29';
        ctx.strokeStyle = 'rgba(245,166,35,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        label(n.x - 8, n.y + 26, n.name, 'rgba(136,144,160,0.9)');
      });
      label(nodes[nodes.length - 1].x - 10, nodes[nodes.length - 1].y - 15, 'audit ✓', 'rgba(79,209,197,0.85)');

      state.packets.forEach(p => {
        p.progress += p.speed;
        if (p.progress < 0) return;
        if (p.progress >= 1) {
          state.processed++;
          Object.assign(p, this.spawn());
          return;
        }
        const segCount = nodes.length - 1;
        const segF = p.progress * segCount;
        const seg = Math.min(Math.floor(segF), segCount - 1);
        const localT = segF - seg;
        const a = nodes[seg], b = nodes[seg + 1];
        const x = a.x + (b.x - a.x) * localT;
        const y = a.y + (b.y - a.y) * localT;
        if (localT < 0.06) a.pulse = 1;
        ctx.fillStyle = '#4FD1C5';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        ctx.globalAlpha = 1;
      });

      valueA.textContent = state.processed.toLocaleString('en-US');
    },
  };

  /* ---------- 3. chatapp: messages ping-ponging over a websocket ---------- */
  const chatApp = {
    label: 'chatapp.sockets',
    tag: 'websockets · live',
    foot: 'full-duplex websocket connection · deployed frontend + backend',
    metrics: [
      { label: 'messages relayed (demo)', type: 'live', unit: '' },
      { label: 'protocol', type: 'text', value: 'websocket · full-duplex' },
    ],
    init(w, h) {
      return {
        leftX: w * 0.14, rightX: w * 0.86, midY: h * 0.5,
        messages: [],
        relayed: 0,
        timer: 0,
      };
    },
    draw(ctx, w, h, state) {
      drawGrid();
      const { leftX, rightX, midY } = state;

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(leftX, midY); ctx.lineTo(rightX, midY); ctx.stroke();
      ctx.setLineDash([]);

      [[leftX, 'You'], [rightX, 'Peer']].forEach(([x, name]) => {
        ctx.fillStyle = '#12151D';
        ctx.strokeStyle = 'rgba(79,209,197,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, midY, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        label(x - 12, midY + 32, name, 'rgba(136,144,160,0.9)');
      });

      state.timer++;
      if (!REDUCE_MOTION && state.timer % 55 === 0) {
        const fromLeft = Math.random() > 0.5;
        state.messages.push({ progress: 0, fromLeft, speed: 0.02 + Math.random() * 0.01 });
      }

      state.messages = state.messages.filter(m => {
        m.progress += m.speed;
        if (m.progress >= 1) { state.relayed++; return false; }
        const x = m.fromLeft ? leftX + (rightX - leftX) * m.progress : rightX - (rightX - leftX) * m.progress;
        const bob = Math.sin(m.progress * Math.PI) * -10;
        ctx.fillStyle = '#F5A623';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(x - 5, midY + bob);
        ctx.lineTo(x + 5, midY + bob);
        ctx.lineTo(x, midY + bob - 7);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });

      valueA.textContent = state.relayed.toLocaleString('en-US');
    },
  };

  /* ---------- 4. weather-guard: radar sweep classifying risk ---------- */
  const weatherGuard = {
    label: 'event-weather-guard',
    tag: 'deterministic · AI-based · live',
    foot: 'classifies an event window Safe / Risky / Unsafe from live forecast data, with a stated reason',
    metrics: [
      { label: 'severity score', type: 'live-number', unit: '/100' },
      { label: 'live classification', type: 'text', value: 'Safe' },
    ],
    classes: [
      { name: 'Safe', color: '#4FD1C5', severity: 18 },
      { name: 'Risky', color: '#F5A623', severity: 62 },
      { name: 'Unsafe', color: '#EF6461', severity: 88 },
    ],
    init(w, h) {
      const cx = w * 0.5, cy = h * 0.52, radius = Math.min(w, h) * 0.36;
      const points = Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return {
          angle,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          cls: Math.floor(Math.random() * 3),
          lit: 0,
        };
      });
      return { cx, cy, radius, points, sweep: 0, holdTimer: 0, activeClass: 0 };
    },
    draw(ctx, w, h, state) {
      drawGrid();
      const { cx, cy, radius, points } = state;

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2); ctx.stroke();

      if (!REDUCE_MOTION) state.sweep += 0.028;
      const sx = cx + Math.cos(state.sweep) * radius;
      const sy = cy + Math.sin(state.sweep) * radius;
      const grad = ctx.createLinearGradient(cx, cy, sx, sy);
      grad.addColorStop(0, 'rgba(245,166,35,0.5)');
      grad.addColorStop(1, 'rgba(245,166,35,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();

      points.forEach(p => {
        const diff = Math.abs(((p.angle - state.sweep + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (diff < 0.18) {
          p.lit = 1;
          state.activeClass = p.cls;
          state.holdTimer = 40;
        }
        p.lit *= 0.96;
        const cls = weatherGuard.classes[p.cls];
        const r = 3 + p.lit * 3;
        ctx.fillStyle = cls.color;
        ctx.globalAlpha = 0.4 + p.lit * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (state.holdTimer > 0) state.holdTimer--;
      const cls = weatherGuard.classes[state.activeClass];
      valueA.textContent = cls.severity;
      valueA.style.color = cls.color;
      valueB.textContent = cls.name;
      valueB.style.color = cls.color;
    },
  };

  const PROJECTS = {
    'rate-limiter': rateLimiter,
    'complyvault': complyVault,
    'chatapp': chatApp,
    'weather-guard': weatherGuard,
  };
  const ORDER = ['rate-limiter', 'complyvault', 'chatapp', 'weather-guard'];

  let active = null;
  let rafId = null;
  let rotateTimer = null;
  let metricsAnimated = false;

  function renderMetrics(project) {
    const [a, b] = project.metrics;
    labelA.textContent = a.label; labelB.textContent = b.label;
    unitA.textContent = a.unit || ''; unitB.textContent = b.unit || '';
    valueA.style.color = ''; valueB.style.color = '';

    if (a.type === 'count') { valueA.textContent = '0'; animateCount(valueA, a.target, { duration: 2000 }); }
    else if (a.type === 'text') { valueA.textContent = a.value; }
    else { valueA.textContent = '0'; } // 'live' / 'live-number' filled in by draw()

    if (b.type === 'count') { valueB.textContent = '0'; animateCount(valueB, b.target, { duration: 2000 }); }
    else if (b.type === 'text') { valueB.textContent = b.value; }
    else { valueB.textContent = '0'; }
  }

  function setActiveTab(key) {
    tabsEl.querySelectorAll('.panel-tab').forEach(btn => {
      const on = btn.dataset.project === key;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function switchProject(key) {
    const project = PROJECTS[key];
    if (!project || (active && active.key === key)) return;
    active = { key, project, state: project.init(width, height) };
    ctx.clearRect(0, 0, width, height);
    titleEl.textContent = project.label;
    tagEl.textContent = project.tag;
    footEl.textContent = project.foot;
    setActiveTab(key);
    renderMetrics(project);
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    if (active) active.project.draw(ctx, width, height, active.state);
    rafId = requestAnimationFrame(loop);
  }

  function startRotation() {
    clearInterval(rotateTimer);
    rotateTimer = setInterval(() => {
      const next = ORDER[(ORDER.indexOf(active.key) + 1) % ORDER.length];
      switchProject(next);
    }, 7000);
  }

  tabsEl.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchProject(btn.dataset.project);
      startRotation();
    });
  });

  resize();
  switchProject('rate-limiter');

  if (REDUCE_MOTION) {
    // Draw one static frame per rotation step instead of animating continuously.
    setInterval(() => active && active.project.draw(ctx, width, height, active.state), 1200);
  } else {
    rafId = requestAnimationFrame(loop);
  }
  startRotation();

  // Kick off metric counters once the panel scrolls into view the first time.
  const heroPanel = document.querySelector('.hero-panel');
  if (heroPanel) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !metricsAnimated) {
          metricsAnimated = true;
          renderMetrics(active.project);
          heroObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    heroObserver.observe(heroPanel);
  }
})();

/* =========================================================
   4. Stack / topic list — rendered from data
   ========================================================= */
const TOPICS = [
  { name: 'Languages', items: ['Java', 'C++', 'JavaScript', 'Python'], partitions: 5 },

  { name: 'Backend', items: ['Spring Boot', 'Node.js', 'Express.js', 'Microservices', 'REST APIs'], partitions: 5 },

  { name: 'Frontend', items: ['React', 'HTML', 'CSS', 'Tailwind CSS'], partitions: 4 },

  { name: 'Databases', items: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch'], partitions: 4 },

  { name: 'Distributed Systems', items: ['Kafka', 'Apache Storm'], partitions: 4 },

  { name: 'DevOps & Cloud', items: ['Docker', , 'AWS', 'Jenkins', 'Argo CD'], partitions: 4 },

  { name: 'Monitoring & Observability', items: ['Datadog'], partitions: 3 },

  { name: 'Tools', items: ['Git', 'Linux', 'Maven', 'Postman'], partitions: 5 },
];

(function renderTopics() {
  const container = document.getElementById('topic-list');
  if (!container) return;

  TOPICS.forEach((topic, i) => {
    const row = document.createElement('div');
    row.className = 'topic-row reveal';

    const partitionEls = Array.from({ length: 5 }, (_, idx) =>
      `<span class="partition ${idx < topic.partitions ? 'on' : ''}"></span>`
    ).join('');

    row.innerHTML = `
      <div class="topic-name">${topic.name}</div>
      <div class="topic-items">${topic.items.map(t => `<span>${t}</span>`).join('')}</div>
      <div class="partitions">${partitionEls}</div>
    `;
    container.appendChild(row);
  });
})();

/* =========================================================
   5. Scroll reveal for cards, log entries, topic rows
   ========================================================= */
(function scrollReveal() {
  const targets = document.querySelectorAll('.card, .log-entry, .paper-card, .cp-card, .topic-row');
  targets.forEach(t => t.classList.add('reveal'));

  if (REDUCE_MOTION) {
    targets.forEach(t => t.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach(t => observer.observe(t));
})();
