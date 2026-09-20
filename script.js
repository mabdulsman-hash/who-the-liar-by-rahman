'use strict';

/* =========================================================
   WHO THE LIAR? — logika permainan (JavaScript)
   Alur: Beranda → Pengaturan → Bagi kartu → Diskusi → Voting
         → Hasil → (Tebak kata) → Skor → ... → Pemenang
   ========================================================= */

/* ---------- Data ---------- */
const AVATARS = ['🦊', '🐼', '🐸', '🐵', '🦄', '🐙', '🐯', '🐨', '🐷', '🦉', '🐲', '🐰'];
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

// Setiap kata: [nama, emoji sebagai gambar kartu]
const CATEGORIES = {
  hewan: {
    label: 'Hewan', icon: '🐾',
    words: [['Kucing', '🐱'], ['Singa', '🦁'], ['Gajah', '🐘'], ['Kelinci', '🐰'], ['Penguin', '🐧'], ['Buaya', '🐊'],
            ['Kupu-kupu', '🦋'], ['Hiu', '🦈'], ['Monyet', '🐵'], ['Jerapah', '🦒'], ['Kura-kura', '🐢'], ['Lebah', '🐝']]
  },
  makanan: {
    label: 'Makanan', icon: '🍔',
    words: [['Pizza', '🍕'], ['Burger', '🍔'], ['Sate', '🍢'], ['Bakso', '🍜'], ['Es Krim', '🍦'], ['Donat', '🍩'],
            ['Semangka', '🍉'], ['Pisang', '🍌'], ['Sushi', '🍣'], ['Kopi', '☕'], ['Roti', '🍞'], ['Popcorn', '🍿']]
  },
  tempat: {
    label: 'Tempat', icon: '📍',
    words: [['Pantai', '🏖️'], ['Bandara', '🛫'], ['Rumah Sakit', '🏥'], ['Sekolah', '🏫'], ['Bioskop', '🎬'], ['Masjid', '🕌'],
            ['Gunung', '🏔️'], ['Pasar', '🛒'], ['Perpustakaan', '📚'], ['Stadion', '🏟️'], ['Hotel', '🏨'], ['Taman Hiburan', '🎡']]
  },
  profesi: {
    label: 'Profesi', icon: '💼',
    words: [['Dokter', '🧑‍⚕️'], ['Polisi', '👮'], ['Koki', '🧑‍🍳'], ['Pilot', '🧑‍✈️'], ['Guru', '🧑‍🏫'], ['Petani', '🧑‍🌾'],
            ['Astronot', '🧑‍🚀'], ['Pemadam Kebakaran', '🧑‍🚒'], ['Detektif', '🕵️'], ['Seniman', '🧑‍🎨'], ['Penyanyi', '🧑‍🎤'], ['Nelayan', '🎣']]
  },
  benda: {
    label: 'Benda', icon: '🎒',
    words: [['Payung', '☂️'], ['Kacamata', '👓'], ['Jam Tangan', '⌚'], ['Sepeda', '🚲'], ['Gitar', '🎸'], ['Kamera', '📷'],
            ['Kunci', '🔑'], ['Lampu', '💡'], ['Ponsel', '📱'], ['Topi', '🎩'], ['Sepatu', '👟'], ['Kompas', '🧭']]
  },
  olahraga: {
    label: 'Olahraga', icon: '🏅',
    words: [['Sepak Bola', '⚽'], ['Basket', '🏀'], ['Bulu Tangkis', '🏸'], ['Renang', '🏊'], ['Tenis', '🎾'], ['Tinju', '🥊'],
            ['Berkuda', '🏇'], ['Panahan', '🏹'], ['Golf', '⛳'], ['Voli', '🏐'], ['Ski', '⛷️'], ['Bowling', '🎳']]
  }
};

/* ---------- State ---------- */
const state = {
  players: [],            // { name, avatar, score }
  category: 'random',     // 'random' atau kunci kategori
  timerMin: 3,
  totalRounds: 3,

  round: 0,
  catKey: '',
  word: null,             // [nama, emoji]
  liar: 0,                // indeks pemain pembohong
  startIndex: 0,          // siapa yang memberi petunjuk pertama

  revealIndex: 0,
  cardShown: false,
  busy: false,

  voter: 0,
  votes: [],              // votes[i] = indeks yang dipilih pemain i
  selected: null,
  accused: -1,            // -1 = seri
  delta: [],              // poin yang didapat di ronde ini
  usedWords: new Set(),

  timer: { id: null, remaining: 0, total: 0 }
};

/* ---------- Helper ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = () => state.players.length;

function show(id) {
  if (id !== 'screen-discuss') stopTimer();
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo({ top: 0 });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function confetti() {
  const box = $('#confetti');
  const bits = ['🎉', '✨', '🎊', '⭐', '🎭'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    s.textContent = pick(bits);
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
    s.style.animationDelay = Math.random() * 0.8 + 's';
    box.appendChild(s);
    setTimeout(() => s.remove(), 6000);
  }
}

/* ---------- Simpan nama pemain (opsional, aman jika storage diblokir) ---------- */
function saveNames() {
  try { localStorage.setItem('wtl-names', JSON.stringify(state.players.map(p => p.name))); } catch (e) { /* abaikan */ }
}
function loadNames() {
  try { return JSON.parse(localStorage.getItem('wtl-names')) || []; } catch (e) { return []; }
}

/* =========================================================
   PENGATURAN
   ========================================================= */
function initPlayers() {
  const saved = loadNames();
  const count = Math.min(Math.max(saved.length, 4), MAX_PLAYERS);
  state.players = Array.from({ length: count }, (_, i) => ({
    name: saved[i] || '',
    avatar: AVATARS[i % AVATARS.length],
    score: 0
  }));
}

function nextAvatar(current) {
  const used = new Set(state.players.map(p => p.avatar));
  let idx = AVATARS.indexOf(current);
  for (let step = 1; step <= AVATARS.length; step++) {
    const cand = AVATARS[(idx + step) % AVATARS.length];
    if (!used.has(cand) || cand === current) return cand;
  }
  return current;
}

function renderPlayers() {
  const list = $('#player-list');
  list.innerHTML = '';

  state.players.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'player-row';

    const av = document.createElement('button');
    av.type = 'button';
    av.className = 'avatar-btn';
    av.textContent = p.avatar;
    av.setAttribute('aria-label', `Ganti avatar pemain ${i + 1}`);
    av.addEventListener('click', () => { p.avatar = nextAvatar(p.avatar); av.textContent = p.avatar; });

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = `Pemain ${i + 1}`;
    input.value = p.name;
    input.setAttribute('aria-label', `Nama pemain ${i + 1}`);
    input.addEventListener('input', () => { p.name = input.value; });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del-btn';
    del.textContent = '✕';
    del.disabled = n() <= MIN_PLAYERS;
    del.setAttribute('aria-label', `Hapus pemain ${i + 1}`);
    del.addEventListener('click', () => { state.players.splice(i, 1); renderPlayers(); });

    li.append(av, input, del);
    list.appendChild(li);
  });

  $('#player-count').textContent = `${n()}/${MAX_PLAYERS}`;
  $('#btn-add-player').disabled = n() >= MAX_PLAYERS;
}

function addPlayer() {
  if (n() >= MAX_PLAYERS) return;
  const used = new Set(state.players.map(p => p.avatar));
  const avatar = AVATARS.find(a => !used.has(a)) || AVATARS[0];
  state.players.push({ name: '', avatar, score: 0 });
  renderPlayers();
  const inputs = $$('#player-list input');
  inputs[inputs.length - 1].focus();
}

function renderCategoryChips() {
  const box = $('#cat-chips');
  box.innerHTML = '';
  const items = [['random', '🎲 Acak'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, `${c.icon} ${c.label}`])];
  items.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.category === key ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { state.category = key; renderCategoryChips(); });
    box.appendChild(b);
  });
}

function bindSegments() {
  $$('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state[seg.dataset.key] = Number(btn.dataset.v);
      $$('button', seg).forEach(b => b.classList.toggle('on', b === btn));
    });
  });
}

function startGame() {
  const players = state.players.map((p, i) => ({ ...p, name: p.name.trim() || `Pemain ${i + 1}`, score: 0 }));
  const lower = players.map(p => p.name.toLowerCase());
  if (new Set(lower).size !== lower.length) {
    toast('Nama pemain tidak boleh sama. Ubah salah satunya.');
    return;
  }
  state.players = players;
  saveNames();
  state.round = 0;
  state.usedWords.clear();
  nextRound();
}

/* =========================================================
   RONDE
   ========================================================= */
function nextRound() {
  state.round++;

  const keys = Object.keys(CATEGORIES);
  state.catKey = state.category === 'random' ? pick(keys) : state.category;

  // Hindari kata yang sudah dipakai di game ini
  const pool = CATEGORIES[state.catKey].words;
  let fresh = pool.filter(w => !state.usedWords.has(w[0]));
  if (fresh.length === 0) { fresh = pool; }
  state.word = pick(fresh);
  state.usedWords.add(state.word[0]);

  state.liar = Math.floor(Math.random() * n());
  state.startIndex = Math.floor(Math.random() * n());
  state.revealIndex = 0;
  state.votes = [];
  state.voter = 0;
  state.selected = null;
  state.accused = -1;
  state.delta = Array(n()).fill(0);

  renderReveal();
  show('screen-reveal');
}

/* ---------- Bagi kartu ---------- */
function renderReveal() {
  const p = state.players[state.revealIndex];
  $('#reveal-round').textContent = `Ronde ${state.round}/${state.totalRounds}`;
  $('#reveal-progress').textContent = `Pemain ${state.revealIndex + 1} dari ${n()}`;
  $('#reveal-avatar').textContent = p.avatar;
  $('#reveal-name').textContent = p.name;
  $('#reveal-hint').textContent = `Serahkan perangkat ke ${p.name}. Pastikan tidak ada yang mengintip.`;

  $('#flip').classList.remove('flipped');
  $('#role-content').innerHTML = '';
  $('#role-face').classList.remove('liar');
  $('#btn-reveal').textContent = 'Ketuk untuk lihat kartu';
  state.cardShown = false;
}

function fillRoleCard() {
  const isLiar = state.revealIndex === state.liar;
  const cat = CATEGORIES[state.catKey];
  const face = $('#role-face');
  face.classList.toggle('liar', isLiar);

  if (isLiar) {
    $('#role-content').innerHTML = `
      <svg class="liar-mask" viewBox="0 0 200 170" aria-hidden="true"><use href="#ico-mask-red"/></svg>
      <div class="role-tag">KAMU PEMBOHONGNYA</div>
      <div class="role-note">Kategori: ${cat.icon} ${esc(cat.label)}<br>Kamu tidak tahu kata rahasianya. Menyamarlah dan tebak dari petunjuk pemain lain!</div>`;
  } else {
    $('#role-content').innerHTML = `
      <div class="role-tag">KAMU WARGA BIASA</div>
      <div class="word-emoji" aria-hidden="true">${state.word[1]}</div>
      <div class="word-text">${esc(state.word[0])}</div>
      <div class="role-note">Kategori: ${cat.icon} ${esc(cat.label)}<br>Beri petunjuk tanpa menyebut kata ini langsung.</div>`;
  }
}

function onRevealClick() {
  if (state.busy) return;

  if (!state.cardShown) {
    fillRoleCard();
    $('#flip').classList.add('flipped');
    state.cardShown = true;
    $('#btn-reveal').textContent = 'Sembunyikan & lanjut';
    return;
  }

  // Tutup kartu, lalu pindah ke pemain berikutnya
  state.busy = true;
  $('#flip').classList.remove('flipped');
  setTimeout(() => {
    state.busy = false;
    state.revealIndex++;
    if (state.revealIndex >= n()) startDiscuss();
    else renderReveal();
  }, 700);
}

/* ---------- Diskusi ---------- */
function startDiscuss() {
  const cat = CATEGORIES[state.catKey];
  $('#discuss-round').textContent = `Ronde ${state.round}/${state.totalRounds}`;
  $('#discuss-cat').textContent = `${cat.icon} ${cat.label}`;

  const order = $('#order-list');
  order.innerHTML = '';
  for (let k = 0; k < n(); k++) {
    const p = state.players[(state.startIndex + k) % n()];
    const li = document.createElement('li');
    li.innerHTML = `<span class="av">${p.avatar}</span><span>${esc(p.name)}</span>`;
    order.appendChild(li);
  }

  const t = state.timer;
  t.total = t.remaining = state.timerMin * 60;
  updateTimerUI();
  $('#btn-timer').textContent = 'Mulai timer';
  show('screen-discuss');
}

const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

function updateTimerUI() {
  const t = state.timer;
  $('#timer').textContent = fmt(t.remaining);
  $('#timer').classList.toggle('low', t.remaining > 0 && t.remaining <= 15);
  $('#timer-bar').style.width = (t.total ? (t.remaining / t.total) * 100 : 0) + '%';
}

function stopTimer() {
  clearInterval(state.timer.id);
  state.timer.id = null;
}

function toggleTimer() {
  const t = state.timer;
  if (t.id) { stopTimer(); $('#btn-timer').textContent = 'Lanjutkan'; return; }
  if (t.remaining <= 0) t.remaining = t.total;

  $('#btn-timer').textContent = 'Jeda';
  t.id = setInterval(() => {
    t.remaining--;
    updateTimerUI();
    if (t.remaining <= 0) {
      stopTimer();
      $('#btn-timer').textContent = 'Ulangi timer';
      toast('Waktu habis! Saatnya voting.');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, 1000);
}

/* ---------- Voting ---------- */
function startVote() {
  stopTimer();
  state.voter = 0;
  state.votes = [];
  $('#vote-round').textContent = `Ronde ${state.round}/${state.totalRounds}`;
  renderVoteGate();
  show('screen-vote');
}

function renderVoteGate() {
  const v = state.players[state.voter];
  $('#vote-progress').textContent = `Suara ${state.voter + 1} dari ${n()}`;
  $('#gate-avatar').textContent = v.avatar;
  $('#gate-name').textContent = v.name;
  $('#vote-gate').hidden = false;
  $('#vote-panel').hidden = true;
}

function openVotePanel() {
  const v = state.players[state.voter];
  $('#vote-title').textContent = `${v.name}, siapa pembohongnya?`;
  state.selected = null;
  $('#btn-lock').disabled = true;

  const grid = $('#vote-grid');
  grid.innerHTML = '';
  state.players.forEach((p, i) => {
    if (i === state.voter) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vote-card';
    b.innerHTML = `<span class="av">${p.avatar}</span><span>${esc(p.name)}</span>`;
    b.addEventListener('click', () => {
      state.selected = i;
      $$('.vote-card', grid).forEach(c => c.classList.toggle('on', c === b));
      $('#btn-lock').disabled = false;
    });
    grid.appendChild(b);
  });

  $('#vote-gate').hidden = true;
  $('#vote-panel').hidden = false;
}

function lockVote() {
  if (state.selected === null) return;
  state.votes[state.voter] = state.selected;
  state.voter++;
  if (state.voter >= n()) showResult();
  else renderVoteGate();
}

/* ---------- Hasil voting ---------- */
function showResult() {
  const counts = Array(n()).fill(0);
  state.votes.forEach(t => counts[t]++);
  const max = Math.max(...counts);
  const top = counts.map((c, i) => (c === max ? i : -1)).filter(i => i >= 0);
  state.accused = top.length === 1 ? top[0] : -1;

  const list = $('#tally');
  list.innerHTML = '';
  state.players
    .map((p, i) => ({ p, c: counts[i] }))
    .sort((a, b) => b.c - a.c)
    .forEach(({ p, c }) => {
      const li = document.createElement('li');
      const width = n() > 1 ? (c / (n() - 1)) * 100 : 0;
      li.innerHTML = `
        <div class="row"><span class="av">${p.avatar}</span><span>${esc(p.name)}</span><span class="cnt">${c} suara</span></div>
        <div class="meter"><i style="width:0"></i></div>`;
      list.appendChild(li);
      requestAnimationFrame(() => requestAnimationFrame(() => { $('i', li).style.width = width + '%'; }));
    });

  $('#btn-reveal-liar').hidden = false;
  $('#verdict').hidden = true;
  $('#btn-after-verdict').hidden = true;
  show('screen-result');
}

function revealLiar() {
  const liar = state.players[state.liar];
  const caught = state.accused === state.liar;
  const verdict = $('#verdict');
  const next = $('#btn-after-verdict');

  $('#btn-reveal-liar').hidden = true;
  verdict.hidden = false;
  next.hidden = false;
  verdict.classList.remove('good', 'bad');

  if (caught) {
    verdict.classList.add('good');
    verdict.innerHTML = `
      <div class="big">Pembohong tertangkap!</div>
      <svg viewBox="0 0 200 170" aria-hidden="true"><use href="#ico-mask-red"/></svg>
      <div class="who">${liar.avatar}</div>
      <div><b>${esc(liar.name)}</b> memang si pembohong.<br>Tapi ia masih punya satu kesempatan menebak kata rahasia.</div>`;
    next.textContent = `${liar.name}, tebak kata rahasianya`;
    next.onclick = startGuess;
  } else {
    verdict.classList.add('bad');
    const accusedLine = state.accused === -1
      ? 'Suara seri, tidak ada yang berhasil dituduh.'
      : `<b>${esc(state.players[state.accused].name)}</b> dituduh, padahal ia warga biasa.`;
    verdict.innerHTML = `
      <div class="big">Pembohong lolos!</div>
      <svg viewBox="0 0 200 170" aria-hidden="true"><use href="#ico-mask-red"/></svg>
      <div class="who">${liar.avatar}</div>
      <div>${accusedLine}<br>Pembohongnya adalah <b>${esc(liar.name)}</b>.<br>Kata rahasia: ${state.word[1]} <b>${esc(state.word[0])}</b></div>`;
    applyScore('escaped');
    next.textContent = 'Lihat skor';
    next.onclick = showScore;
  }
}

/* ---------- Tebak kata ---------- */
function startGuess() {
  const liar = state.players[state.liar];
  const cat = CATEGORIES[state.catKey];
  $('#guess-avatar').textContent = liar.avatar;
  $('#guess-title').textContent = liar.name;
  $('#guess-cat').textContent = `${cat.icon} ${cat.label}`;

  const others = shuffle(cat.words.filter(w => w[0] !== state.word[0])).slice(0, 7);
  const options = shuffle([state.word, ...others]);

  const grid = $('#guess-grid');
  grid.innerHTML = '';
  options.forEach(w => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'guess-card';
    b.dataset.word = w[0];
    b.innerHTML = `<span class="em">${w[1]}</span><span>${esc(w[0])}</span>`;
    b.addEventListener('click', () => submitGuess(w[0]));
    grid.appendChild(b);
  });

  $('#guess-msg').hidden = true;
  $('#btn-guess-next').hidden = true;
  show('screen-guess');
}

function submitGuess(word) {
  const correct = word === state.word[0];
  $$('.guess-card').forEach(b => {
    b.disabled = true;
    if (b.dataset.word === state.word[0]) b.classList.add('right');
    else if (b.dataset.word === word) b.classList.add('wrong');
    else b.classList.add('dim');
  });

  const msg = $('#guess-msg');
  msg.hidden = false;
  msg.classList.remove('good', 'bad');
  if (correct) {
    msg.classList.add('bad');
    msg.innerHTML = `<div class="big">Tebakan benar!</div>Si pembohong berhasil menebak <b>${esc(state.word[0])}</b> dan mencuri kemenangan.`;
    applyScore('guessed');
  } else {
    msg.classList.add('good');
    msg.innerHTML = `<div class="big">Tebakan salah!</div>Kata yang benar adalah ${state.word[1]} <b>${esc(state.word[0])}</b>. Para warga menang!`;
    applyScore('failed');
  }
  $('#btn-guess-next').hidden = false;
}

/* ---------- Skor ---------- */
function applyScore(outcome) {
  state.delta = Array(n()).fill(0);
  if (outcome === 'escaped') {
    state.delta[state.liar] = 3;
  } else if (outcome === 'guessed') {
    state.delta[state.liar] = 2;
  } else {
    state.players.forEach((_, i) => {
      if (i === state.liar) return;
      state.delta[i] = 1 + (state.votes[i] === state.liar ? 1 : 0);
    });
  }
  state.players.forEach((p, i) => { p.score += state.delta[i]; });
}

function rankIcon(i) { return ['🥇', '🥈', '🥉'][i] || i + 1; }

function renderScoreList(container, withDelta) {
  container.innerHTML = '';
  state.players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score)
    .forEach(({ p, i }, rank) => {
      const li = document.createElement('li');
      if (rank === 0) li.classList.add('first');
      const delta = withDelta && state.delta[i] > 0 ? `<span class="delta">+${state.delta[i]}</span>` : '';
      const tag = withDelta && i === state.liar ? '<span class="tag">pembohong</span>' : '';
      li.innerHTML = `
        <span class="rank">${rankIcon(rank)}</span>
        <span class="av">${p.avatar}</span>
        <span>${esc(p.name)}</span>${tag}
        <span class="pts">${p.score}${delta}</span>`;
      container.appendChild(li);
    });
}

function showScore() {
  $('#score-title').textContent = `Skor ronde ${state.round}`;
  $('#word-recap').innerHTML = `Kata rahasia<br><span class="em">${state.word[1]}</span><br><b>${esc(state.word[0])}</b>`;
  renderScoreList($('#score-list'), true);

  const last = state.round >= state.totalRounds;
  const btn = $('#btn-next-round');
  btn.textContent = last ? 'Lihat pemenang' : `Lanjut ke ronde ${state.round + 1}`;
  btn.onclick = last ? showFinal : nextRound;
  show('screen-score');
}

function showFinal() {
  const best = Math.max(...state.players.map(p => p.score));
  const winners = state.players.filter(p => p.score === best);

  $('#winner-avatar').textContent = winners[0].avatar;
  $('#winner-name').textContent = winners.map(w => w.name).join(' & ');
  $('#winner-sub').textContent = winners.length > 1
    ? `Seri dengan ${best} poin. Kalian sama-sama jago!`
    : `Juara dengan ${best} poin.`;

  renderScoreList($('#final-list'), false);
  show('screen-final');
  confetti();
}

function playAgain() {
  state.players.forEach(p => { p.score = 0; });
  state.round = 0;
  state.usedWords.clear();
  nextRound();
}

/* =========================================================
   INISIALISASI
   ========================================================= */
function init() {
  initPlayers();
  renderPlayers();
  renderCategoryChips();
  bindSegments();

  $('#btn-start').addEventListener('click', () => show('screen-setup'));
  $('#btn-back-home').addEventListener('click', () => show('screen-home'));
  $('#btn-home').addEventListener('click', () => { initPlayers(); renderPlayers(); show('screen-home'); });

  $('#btn-rules').addEventListener('click', () => $('#rules-dialog').showModal());
  $('#btn-close-rules').addEventListener('click', () => $('#rules-dialog').close());

  $('#btn-add-player').addEventListener('click', addPlayer);
  $('#btn-play').addEventListener('click', startGame);

  $('#btn-reveal').addEventListener('click', onRevealClick);
  $('#btn-timer').addEventListener('click', toggleTimer);
  $('#btn-to-vote').addEventListener('click', startVote);

  $('#btn-gate').addEventListener('click', openVotePanel);
  $('#btn-lock').addEventListener('click', lockVote);

  $('#btn-reveal-liar').addEventListener('click', revealLiar);
  $('#btn-guess-next').addEventListener('click', showScore);

  $('#btn-again').addEventListener('click', playAgain);
}

document.addEventListener('DOMContentLoaded', init);
