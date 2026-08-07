// signaling.js — zero-dependency WebSocket signaling relay for WebRTC phone bridge.
// Pure Node (http + crypto + stream). No npm packages needed.
// Run: node signaling.js   -> serves a WS endpoint on :8001 and static files on :8000 proxy isn't needed;
// this server ONLY does WebSocket signaling. Serve the HTML via `python -m http.server 8000`.
//
// Protocol (JSON text frames):
//   {type:'join', room:'jarvis'}            -> server assigns role (first=PC, second=PHONE) and echoes {type:'joined', role, room}
//   {type:'signal', data:{...}}             -> relayed verbatim to the OTHER peer in same room as {type:'signal', data:{...}}
//   {type:'bye'}                            -> notifies the other peer {type:'peer-left'}
//
// Rooms hold at most 2 peers; extra peers get {type:'room-full'}.

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.SIG_PORT || 8001;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const server = http.createServer((req, res) => {
  // tiny health endpoint so you can confirm it's alive
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('JARVIS signaling WS server. Connect a WebSocket client to /ws\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  const conn = new WSConn(socket);

  conn.onMessage = (msg) => handle(conn, msg);
  conn.onClose = () => cleanup(conn);
});

// ---- minimal WebSocket frame codec (text only, no fragmentation handling needed for our small msgs) ----
class WSConn {
  constructor(socket) {
    this.socket = socket; this.buffer = Buffer.alloc(0);
    this.onMessage = () => {}; this.onClose = () => {};
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // parse all complete frames
    while (true) {
      if (this.buffer.length < 2) return;
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) { if (this.buffer.length < 4) return; len = this.buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (this.buffer.length < 10) return; len = Number(this.buffer.readBigUInt64BE(2)); offset = 10; }
      let maskKey;
      if (masked) { if (this.buffer.length < offset + 4) return; maskKey = this.buffer.slice(offset, offset + 4); offset += 4; }
      if (this.buffer.length < offset + len) return;
      let payload = this.buffer.slice(offset, offset + len);
      if (masked) { const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i % 4]; payload = out; }
      this.buffer = this.buffer.slice(offset + len);
      if (opcode === 0x8) { this.onClose(); return; } // close
      if (opcode === 0x1) { try { this.onMessage(JSON.parse(payload.toString('utf8'))); } catch (_) {} }
      // ignore ping/pong/continuation for brevity
    }
  }
  send(obj) {
    const data = Buffer.from(JSON.stringify(obj), 'utf8');
    const len = data.length;
    let header;
    if (len < 126) { header = Buffer.from([0x81, len]); }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([header, data])); } catch (_) {}
  }
  close() { try { this.socket.write(Buffer.from([0x88, 0])); this.socket.end(); } catch (_) {} }
}

// ---- room/peer bookkeeping ----
const rooms = {}; // room -> [conn,...]
function handle(conn, msg) {
  if (msg.type === 'join') {
    const room = msg.room || 'jarvis';
    rooms[room] = rooms[room] || [];
    if (rooms[room].length >= 2) { conn.send({ type: 'room-full' }); conn.close(); return; }
    conn.room = room;
    conn.role = rooms[room].length === 0 ? 'PC' : 'PHONE';
    rooms[room].push(conn);
    conn.send({ type: 'joined', role: conn.role, room });
    if (rooms[room].length === 2) {
      // inform both peers they can begin; phone should create offer
      rooms[room].forEach((c) => c.send({ type: 'peer-ready' }));
    }
    return;
  }
  if (msg.type === 'signal' && conn.room) {
    const others = (rooms[conn.room] || []).filter((c) => c !== conn);
    others.forEach((c) => c.send({ type: 'signal', data: msg.data, from: conn.role }));
    return;
  }
  if (msg.type === 'bye' && conn.room) {
    const others = (rooms[conn.room] || []).filter((c) => c !== conn);
    others.forEach((c) => c.send({ type: 'peer-left' }));
  }
}
function cleanup(conn) {
  if (conn.room && rooms[conn.room]) {
    const others = rooms[conn.room].filter((c) => c !== conn);
    others.forEach((c) => c.send({ type: 'peer-left' }));
    rooms[conn.room] = rooms[conn.room].filter((c) => c !== conn);
    if (rooms[conn.room].length === 0) delete rooms[conn.room];
  }
  try { conn.close(); } catch (_) {}
}

server.listen(PORT, () => console.log('[signaling] WebSocket relay listening on ws://localhost:' + PORT));
