const presetButtons = Array.from(document.querySelectorAll('.preset-btn'));
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const dialFace = document.getElementById('dialFace');
const digitalReadout = document.getElementById('digitalReadout');
const progressSweep = document.getElementById('progressSweep');
const tickRing = document.getElementById('tickRing');
const numberRing = document.getElementById('numberRing');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');

let selectedMinutes = 25;
let durationMs = selectedMinutes * 60 * 1000;
let remainingMs = durationMs;
let running = false;
let startTime = 0;
let endTime = 0;
let rafId = null;
let sweepDisplayDeg = 0;
let sweepVelocity = 0;
let lastSweepTs = 0;
let audioCtx = null;

function buildDialMarks() {
  tickRing.innerHTML = '';
  numberRing.innerHTML = '';

  const tickSize = tickRing.getBoundingClientRect().width;
  const labelSize = numberRing.getBoundingClientRect().width;
  if (!tickSize || !labelSize) return;

  const tickCx = tickSize / 2;
  const tickCy = tickSize / 2;
  const labelCx = labelSize / 2;
  const labelCy = labelSize / 2;
  const tickRadius = tickSize * 0.47;
  const labelRadius = labelSize * 0.490;

  const tickFrag = document.createDocumentFragment();
  const labelFrag = document.createDocumentFragment();

  for (let i = 0; i < 60; i++) {
    const deg = i * 6;
    const angle = (deg - 90) * (Math.PI / 180);
    const x = tickCx + Math.cos(angle) * tickRadius;
    const y = tickCy + Math.sin(angle) * tickRadius;

    const tick = document.createElement('span');
    tick.className = i % 5 === 0 ? 'tick major' : 'tick minor';
    tick.style.left = `${x}px`;
    tick.style.top = `${y}px`;
    tick.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    tickFrag.appendChild(tick);
  }

  for (let i = 0; i < 60; i += 5) {
    const deg = i * 6;
    const angle = (deg - 90) * (Math.PI / 180);
    const x = labelCx + Math.cos(angle) * labelRadius;
    const y = labelCy + Math.sin(angle) * labelRadius;

    const label = document.createElement('span');
    label.className = 'minute-label';
    label.textContent = String(i);
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.transform = 'translate(-50%, -52%)';
    labelFrag.appendChild(label);
  }

  tickRing.appendChild(tickFrag);
  numberRing.appendChild(labelFrag);
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function renderSweep(ts = performance.now(), snap = false) {
  const elapsed = durationMs - remainingMs;
  const progress = durationMs === 0 ? 0 : Math.min(1, Math.max(0, elapsed / durationMs));
  const targetDeg = progress * 360;

  if (snap) {
    sweepDisplayDeg = targetDeg;
    sweepVelocity = 0;
    lastSweepTs = ts;
  } else {
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastSweepTs) / 1000 || 0.016));
    lastSweepTs = ts;

    const stiffness = 180;
    const damping = 24;
    const accel = (targetDeg - sweepDisplayDeg) * stiffness - sweepVelocity * damping;
    sweepVelocity += accel * dt;
    sweepDisplayDeg += sweepVelocity * dt;
    sweepDisplayDeg = Math.max(0, Math.min(360, sweepDisplayDeg));
  }

  progressSweep.style.setProperty('--sweep-end', `${sweepDisplayDeg}deg`);
  digitalReadout.textContent = formatTime(remainingMs);
}

function loop(ts) {
  if (!running) return;
  remainingMs = Math.max(0, endTime - ts);
  renderSweep(ts, false);
  if (remainingMs <= 0) {
    renderSweep(ts, true);
    stopTimer(true);
    return;
  }
  rafId = requestAnimationFrame(loop);
}

function initAudio() {
  if (!audioCtx && 'AudioContext' in window) {
    audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playEndSound() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime + 0.02;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, now);

  const frequencies = [880, 988, 1047];
  frequencies.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const start = now + index * 0.16;
    const end = start + 0.12;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gain);
    osc.start(start);
    osc.stop(end);
  });

  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + frequencies.length * 0.16 + 0.04);
}

function startTimer() {
  if (running || remainingMs <= 0) return;
  initAudio();
  running = true;
  startPauseBtn.textContent = 'Pause';
  startPauseBtn.classList.add('is-live');
  startTime = performance.now();
  lastSweepTs = startTime;
  endTime = startTime + remainingMs;
  rafId = requestAnimationFrame(loop);
}

function pauseTimer() {
  if (!running) return;
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  startPauseBtn.textContent = 'Start';
  startPauseBtn.classList.remove('is-live');
}

function stopTimer(completed = false) {
  pauseTimer();
  if (completed) {
    playEndSound();
    startPauseBtn.textContent = 'Start';
    startPauseBtn.classList.remove('is-live');
    window.setTimeout(() => {
      alert('Session complete. Great work.');
    }, 120);
  }
}

function resetTimer() {
  stopTimer(false);
  durationMs = selectedMinutes * 60 * 1000;
  remainingMs = durationMs;
  renderSweep(performance.now(), true);
}

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    presetButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMinutes = Number(btn.dataset.minutes);
    resetTimer();
  });
});

startPauseBtn.addEventListener('click', () => {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener('click', resetTimer);

function loadTasks() {
  try {
    const saved = localStorage.getItem('pomodoro_tasks');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
}

function renderTasks() {
  const tasks = loadTasks();
  taskList.innerHTML = '';
  tasks.forEach((text, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = text;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      const next = loadTasks();
      next.splice(index, 1);
      saveTasks(next);
      renderTasks();
    });

    li.appendChild(span);
    li.appendChild(del);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const tasks = loadTasks();
  tasks.push(text);
  saveTasks(tasks);
  taskInput.value = '';
  renderTasks();
  taskInput.focus();
});

const relayoutDial = () => buildDialMarks();
window.addEventListener('resize', relayoutDial);

if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(relayoutDial);
  ro.observe(dialFace);
}

buildDialMarks();
resetTimer();
renderTasks();
