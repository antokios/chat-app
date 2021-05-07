const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || '3000'
// Define paths for express config
const publicDirPath = path.join(__dirname, '../public')

// Setup static directory to serve
app.use(express.static(publicDirPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            // Acknowledgement
            return callback(error)
        }

        socket.join(user.room)
        // Message for every new connection
        socket.emit('message', generateMessage('Admin','Welcome!'))
        // Notify all OTHER users when a new user joins the room
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        // Acknowledgement
        callback()
    })

    // Listen for event sendMessage from client
    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(msg)) {
            // Acknowledgement
            return callback('Profanity is not allowed!')
        }
        // Emit the message to all clients
        socket.emit('message', generateMessage('Me', msg))
        socket.broadcast.to(user.room).emit('message', generateMessage(user.username, msg))
        // Acknowledgement
        callback()
    })

    // Listen for event shareLocation from client
    socket.on ('shareLocation', ({ latitude, longitude }, callback) => {
        const user = getUser(socket.id)
        // Emit the locationMessage to all clients
        socket.emit('locationMessage', generateLocationMessage('Me', latitude, longitude))
        socket.broadcast.to(user.room).emit('locationMessage', generateLocationMessage(user.username, latitude, longitude))
        // Acknowledgement
        callback()
    })

    // Notify all users that a user left
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
})