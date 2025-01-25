const express = require('express');
const app = express();
const indexRouter = require('./routes/index');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

require('dotenv').config();

const server = http.createServer(app);
const io = socketio(server);

const waitingroom = [];
const rooms = new Map(); // Using Map to store active rooms

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('joinroom', () => {
        console.log('User requesting to join:', socket.id);
        if (waitingroom.length > 0) {
            const partner = waitingroom.shift();
            const roomName = `${socket.id}-${partner.id}`;
            
            // Store room information
            rooms.set(roomName, {
                users: [socket.id, partner.id],
                created: Date.now()
            });
            
            socket.join(roomName);
            partner.join(roomName);
            
            // Send room name to both users
            io.to(roomName).emit('joined', roomName);
            console.log(`Room created: ${roomName}`);
        } else {
            waitingroom.push(socket);
            console.log(`User ${socket.id} added to waiting room`);
        }
    });

    socket.on("message", ({ room, message }) => {
        console.log(`Message in room ${room}:`, message);
        socket.broadcast.to(room).emit('message', { message });
    });

    socket.on('disconnect', () => {
        // Remove from waiting room if present
        const index = waitingroom.findIndex(s => s.id === socket.id);
        if (index !== -1) {
            waitingroom.splice(index, 1);
        }
        
        // Handle disconnection from active room
        rooms.forEach((value, roomName) => {
            if (value.users.includes(socket.id)) {
                io.to(roomName).emit('partnerDisconnected');
                rooms.delete(roomName);
            }
        });
    });
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine','ejs');

app.use('/',indexRouter);

const PORT = process.env.PORT || 3000;

server.listen(PORT,()=>{
    console.log(`server started on port ${PORT}`);
});