// E2E smoke test: 1 host + 2 players, full quiz playthrough.
// Run after `npm run dev` in backend.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';

function mkSocket(label) {
  const s = io(URL, { transports: ['websocket'] });
  s.onAny((ev, ...args) => {
    if (ev === 'leaderboard_update' || ev === 'question' || ev === 'question_end' || ev === 'game_end' || ev === 'game_started' || ev === 'player_joined') {
      console.log(`[${label}] <- ${ev}`, JSON.stringify(args).slice(0, 220));
    }
  });
  return s;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emitAck = (s, ev, payload) =>
  new Promise((res, rej) => {
    s.emit(ev, payload, (r) => (r?.ok ? res(r) : rej(new Error(JSON.stringify(r)))));
  });

async function run() {
  console.log('Connecting host...');
  const host = mkSocket('HOST');
  await new Promise((r) => host.on('connect', r));

  const created = await emitAck(host, 'create_game', {});
  console.log('Created game', created);
  const { gameId, hostToken } = created;

  console.log('Connecting players...');
  const p1 = mkSocket('P1');
  const p2 = mkSocket('P2');
  await Promise.all([
    new Promise((r) => p1.on('connect', r)),
    new Promise((r) => p2.on('connect', r)),
  ]);

  const j1 = await emitAck(p1, 'join_game', { gameId, nickname: 'Alice' });
  const j2 = await emitAck(p2, 'join_game', { gameId, nickname: 'Bob' });
  console.log('Joined:', j1.playerId.slice(0, 8), j2.playerId.slice(0, 8));

  // Player auto-answers: random for p1, always-correct-ish for p2
  let qi = -1;
  let p2Correct = 0;
  p1.on('question', (q) => {
    qi = q.index;
    setTimeout(
      () => p1.emit('submit_answer', { gameId, playerId: j1.playerId, questionIndex: q.index, choice: Math.floor(Math.random() * q.choices.length), clientTs: Date.now() }),
      400 + Math.random() * 1200,
    );
  });
  p2.on('question', (q) => {
    setTimeout(
      () => p2.emit('submit_answer', { gameId, playerId: j2.playerId, questionIndex: q.index, choice: 1, clientTs: Date.now() }),
      300 + Math.random() * 800,
    );
  });
  p2.on('question_end', (e) => {
    if (e.yourCorrect) p2Correct++;
  });

  await wait(500);
  await emitAck(host, 'start_game', { gameId, hostToken });
  console.log('Game started');

  // Wait for game_end
  await new Promise((res) => host.on('game_end', (e) => { console.log('GAME END payload:', JSON.stringify(e)); res(); }));

  console.log(`P2 answered correctly on ${p2Correct} questions.`);
  host.close(); p1.close(); p2.close();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
