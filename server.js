const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// rooms[roomId] = { userId: { name } }
const rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentName = null;

  socket.on('join-room', ({ roomId, name }) => {
    currentRoom = roomId;
    currentName = name || 'Anônimo';

    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = {};

    // manda pro novo usuário a lista de quem já está na sala
    const existingUsers = Object.entries(rooms[roomId]).map(([id, u]) => ({
      id,
      name: u.name,
    }));
    socket.emit('existing-users', existingUsers);

    // registra o novo usuário na sala
    rooms[roomId][socket.id] = { name: currentName };

    // avisa os outros que alguém novo entrou
    socket.to(roomId).emit('user-joined', { id: socket.id, name: currentName });

    console.log(`[join] ${currentName} (${socket.id}) entrou na sala ${roomId}`);
  });

  // Relay de sinalização WebRTC (offer, answer, ice candidate)
  // 'to' é o socket.id do destinatário
  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('chat-message', (msg) => {
    if (!currentRoom) return;
    io.to(currentRoom).emit('chat-message', {
      from: currentName,
      id: socket.id,
      text: msg,
      time: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom][socket.id];
      socket.to(currentRoom).emit('user-left', { id: socket.id });
      if (Object.keys(rooms[currentRoom]).length === 0) {
        delete rooms[currentRoom];
      }
      console.log(`[leave] ${currentName} (${socket.id}) saiu da sala ${currentRoom}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
