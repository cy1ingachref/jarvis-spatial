// test-signaling.mjs — end-to-end check of the zero-dep WS relay.
// Spins up two WS clients, joins room 'jarvis', verifies role assignment + signal relay.
import { spawn } from 'child_process';
import { createConnection } from 'net';

const PORT = 8011; // test port to avoid clashing with a live :8001
const server = spawn('node', ['signaling.js'], { env: { ...process.env, SIG_PORT: String(PORT) }, stdio: 'inherit' });

function wsConnect() {
  return new Promise((resolve) => {
    const key = 'dGhlIHNhbXBsZSBub25jZQ=='; // dummy sec-websocket-key
    const s = createConnection(PORT, '127.0.0.1', () => {
      s.write(
        'GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n'
      );
    });
    let buf = Buffer.alloc(0), handshook = false;
    const api = { send: (o) => {
      const d = Buffer.from(JSON.stringify(o), 'utf8'); let h;
      if (d.length < 126) h = Buffer.from([0x81, d.length]); else { h = Buffer.alloc(4); h[0]=0x81; h[1]=126; h.writeUInt16BE(d.length,2); }
      s.write(Buffer.concat([h, d]));
    }, onMessage: () => {}, close: () => s.end() };
    s.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshook) { if (buf.includes('\r\n\r\n')) { handshook = true; buf = buf.slice(buf.indexOf('\r\n\r\n') + 4); } else return; }
      while (buf.length >= 2) {
        const len = buf[1] & 0x7f; let off = 2, payload;
        if (len === 126) { if (buf.length < 4) return; payload = buf.slice(4, 4 + buf.readUInt16BE(2)); off = 4 + payload.length; }
        else { payload = buf.slice(2, 2 + len); off = 2 + len; }
        buf = buf.slice(off);
        try { api.onMessage(JSON.parse(payload.toString('utf8'))); } catch (_) {}
      }
    });
    s.on('connect', () => setTimeout(() => resolve(api), 100));
    s.on('error', () => resolve(null));
    api.sock = s;
  });
}

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async () => {
  await wait(500);
  const pc = await wsConnect();
  const phone = await wsConnect();
  let pcGot = [], phoneGot = [];
  pc.onMessage = (m) => pcGot.push(m);
  phone.onMessage = (m) => phoneGot.push(m);

  pc.send({ type: 'join', room: 'jarvis' });
  await wait(150);
  phone.send({ type: 'join', room: 'jarvis' });
  await wait(200);
  // phone -> pc signal relay
  phone.send({ type: 'signal', data: { sdp: { type: 'offer', sdp: 'FAKE' } } });
  await wait(200);

  const roles = [pcGot.find(m=>m.type==='joined')?.role, phoneGot.find(m=>m.type==='joined')?.role];
  const relayed = pcGot.some(m => m.type==='signal' && m.data?.sdp?.type==='offer');
  const peerReady = [...pcGot, ...phoneGot].some(m=>m.type==='peer-ready');

  console.log('ROLES:', roles.join(','));
  console.log('RELAY offer->PC:', relayed);
  console.log('PEER-READY both:', peerReady);

  const pass = roles.includes('PC') && roles.includes('PHONE') && relayed && peerReady;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  server.kill(); process.exit(pass ? 0 : 1);
})();
