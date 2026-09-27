// Se window.SERVER_URL estiver definido (ex: no app desktop), conecta nele.
// Senão, conecta na mesma origem (comportamento normal do app web).
const socket = io(window.SERVER_URL || undefined);

// STUN públicos do Google — ajudam a atravessar NAT.
// Para redes mais restritas (firewalls corporativos), talvez seja
// necessário adicionar um servidor TURN próprio (veja o README).
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let myName = '';
let myRoom = '';
let localStream = new MediaStream(); // pode conter track de tela + mic
let screenTrack = null;
let micTrack = null;

const peers = {}; // { socketId: { pc, name } }

const lobby = document.getElementById('lobby');
const roomEl = document.getElementById('room');
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const roomLabel = document.getElementById('roomLabel');
const videoGrid = document.getElementById('videoGrid');
const shareBtn = document.getElementById('shareBtn');
const micBtn = document.getElementById('micBtn');
const leaveBtn = document.getElementById('leaveBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

// Preenche sala a partir da URL (?room=xxx), se veio de um link de convite
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('room')) roomInput.value = urlParams.get('room');

joinBtn.addEventListener('click', joinRoom);
[nameInput, roomInput].forEach((el) =>
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); })
);

function joinRoom() {
  myName = nameInput.value.trim() || 'Anônimo';
  myRoom = roomInput.value.trim();
  if (!myRoom) { roomInput.focus(); return; }

  lobby.classList.add('hidden');
  roomEl.classList.remove('hidden');
  roomLabel.textContent = `🔊 ${myRoom}`;

  socket.emit('join-room', { roomId: myRoom, name: myName });
  addSystemMessage(`Você entrou na sala como ${myName}.`);
}

// ---------- Sinalização ----------

socket.on('existing-users', (users) => {
  users.forEach((u) => createPeerConnection(u.id, u.name, false));
});

socket.on('user-joined', ({ id, name }) => {
  addSystemMessage(`${name} entrou na sala.`);
  createPeerConnection(id, name, true);
});

socket.on('user-left', ({ id }) => {
  if (peers[id]) {
    addSystemMessage(`${peers[id].name} saiu da sala.`);
    peers[id].pc.close();
    delete peers[id];
    removeTile(id);
  }
});

socket.on('signal', async ({ from, data }) => {
  const entry = peers[from];
  if (!entry) return;
  const { pc } = entry;

  if (data.type === 'offer') {
    await pc.setRemoteDescription(new RTCSessionDescription(data));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal', { to: from, data: pc.localDescription });
  } else if (data.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(data));
  } else if (data.candidate) {
    try { await pc.addIceCandidate(data); } catch (e) { /* ignora candidatos tardios */ }
  }
});

socket.on('chat-message', ({ from, text }) => {
  addChatMessage(from, text);
});

// ---------- Peer connections ----------

function createPeerConnection(id, name, isInitiator) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  peers[id] = { pc, name };

  // envia as tracks locais que já existirem (tela/mic) para o novo peer
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('signal', { to: id, data: e.candidate });
  };

  pc.ontrack = (e) => {
    renderRemoteTile(id, name, e.streams[0]);
  };

  pc.onnegotiationneeded = async () => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: id, data: pc.localDescription });
    } catch (err) { console.error('negotiation error', err); }
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      removeTile(id);
    }
  };

  if (isInitiator) {
    // onnegotiationneeded cuida do createOffer automaticamente
  }
}

// ---------- Compartilhar tela ----------

shareBtn.addEventListener('click', async () => {
  if (screenTrack) {
    stopScreenShare();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    });
    screenTrack = stream.getVideoTracks()[0];
    localStream.addTrack(screenTrack);

    Object.values(peers).forEach(({ pc }) => pc.addTrack(screenTrack, localStream));

    renderLocalTile();
    shareBtn.textContent = '🛑 Parar compartilhamento';
    shareBtn.classList.add('active');

    // se o usuário parar pelo botão nativo do navegador
    screenTrack.onended = stopScreenShare;
  } catch (err) {
    console.log('Compartilhamento cancelado ou negado:', err.message);
  }
});

function stopScreenShare() {
  if (!screenTrack) return;
  Object.values(peers).forEach(({ pc }) => {
    const sender = pc.getSenders().find((s) => s.track === screenTrack);
    if (sender) pc.removeTrack(sender);
  });
  screenTrack.stop();
  localStream.removeTrack(screenTrack);
  screenTrack = null;
  shareBtn.textContent = '🖥️ Compartilhar tela';
  shareBtn.classList.remove('active');
  updateLocalTile();
}

// ---------- Microfone ----------

micBtn.addEventListener('click', async () => {
  if (micTrack) {
    micTrack.stop();
    localStream.removeTrack(micTrack);
    Object.values(peers).forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track === micTrack);
      if (sender) pc.removeTrack(sender);
    });
    micTrack = null;
    micBtn.textContent = '🎤 Ativar mic';
    micBtn.classList.remove('active');
    return;
  }
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micTrack = audioStream.getAudioTracks()[0];
    localStream.addTrack(micTrack);
    Object.values(peers).forEach(({ pc }) => pc.addTrack(micTrack, localStream));
    micBtn.textContent = '🔇 Desativar mic';
    micBtn.classList.add('active');
  } catch (err) {
    alert('Não foi possível acessar o microfone: ' + err.message);
  }
});

// ---------- Vídeo grid ----------

function renderLocalTile() {
  let tile = document.getElementById('tile-local');
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = 'tile-local';
    tile.innerHTML = `<video autoplay playsinline muted></video><span class="label">Você (${myName})</span>`;
    videoGrid.prepend(tile);
  }
  tile.querySelector('video').srcObject = localStream;
}

function updateLocalTile() {
  const hasVideo = localStream.getVideoTracks().length > 0;
  const tile = document.getElementById('tile-local');
  if (!hasVideo && tile) tile.remove();
}

function renderRemoteTile(id, name, stream) {
  let tile = document.getElementById(`tile-${id}`);
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `tile-${id}`;
    tile.innerHTML = `<video autoplay playsinline></video><span class="label">${name}</span>`;
    videoGrid.appendChild(tile);
  }
  const videoEl = tile.querySelector('video');
  if (videoEl.srcObject !== stream) videoEl.srcObject = stream;
}

function removeTile(id) {
  const tile = document.getElementById(`tile-${id}`);
  if (tile) tile.remove();
}

// ---------- Chat ----------

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('chat-message', text);
  addChatMessage(myName, text, true);
  chatInput.value = '';
});

function addChatMessage(author, text) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<span class="author">${escapeHtml(author)}:</span> <span class="text">${escapeHtml(text)}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- Sair / convite ----------

leaveBtn.addEventListener('click', () => location.reload());

copyLinkBtn.addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(myRoom)}`;
  navigator.clipboard.writeText(url).then(() => {
    copyLinkBtn.textContent = '✅ Copiado!';
    setTimeout(() => (copyLinkBtn.textContent = '🔗 Copiar convite'), 1500);
  });
});
