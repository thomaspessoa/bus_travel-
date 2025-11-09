const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
}));
app.use(express.static('public'));
app.use(express.json());

const auth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).send('Unauthorized');
    }
};

app.get('/admin.html', auth, (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

app.get('/driver.html', auth, (req, res) => {
    res.sendFile(__dirname + '/public/driver.html');
});

// In-memory database for trips
let trips = [];
let activeBuses = {};

// Routes
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'adm@hotmail.com' && password === 'adm123') {
        req.session.user = 'admin';
        res.json({ success: true, userType: 'admin' });
    } else if (email === 'motorista@hotmail.com' && password === 'motorista2026') {
        req.session.user = 'driver';
        res.json({ success: true, userType: 'driver' });
    } else {
        res.json({ success: false });
    }
});

app.post('/trips', (req, res) => {
    const trip = req.body;
    trip.id = Date.now();
    trip.startTime = new Date().toLocaleTimeString();
    trips.push(trip);
    activeBuses[trip.busNumber] = { ...trip, locations: [] };
    res.status(201).json(trip);
});

app.put('/trips/:id', (req, res) => {
    const { id } = req.params;
    const { observations } = req.body;
    const trip = trips.find(t => t.id == id);
    if (trip) {
        trip.observations = observations;
        trip.endTime = new Date().toLocaleTimeString();
        trip.locations = activeBuses[trip.busNumber].locations;
        delete activeBuses[trip.busNumber];
        io.emit('tripEnded', trip.busNumber);
        res.json(trip);
    } else {
        res.status(404).send('Trip not found');
    }
});

app.get('/trips', (req, res) => {
    const { date } = req.query;
    if (date) {
        const filteredTrips = trips.filter(t => t.date === date);
        res.json(filteredTrips);
    } else {
        res.json(trips);
    }
});

app.get('/trips/:id', (req, res) => {
    const { id } = req.params;
    const trip = trips.find(t => t.id == id);
    if (trip) {
        res.json(trip);
    } else {
        res.status(404).send('Trip not found');
    }
});

app.delete('/trips/:id', (req, res) => {
    const { id } = req.params;
    trips = trips.filter(t => t.id != id);
    res.status(204).send();
});


// Socket.io connection
io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('locationUpdate', (data) => {
        const { busNumber, location, speed } = data;
        if (activeBuses[busNumber]) {
            activeBuses[busNumber].locations.push(location);
            activeBuses[busNumber].speed = speed;
            io.emit('busLocationUpdate', { busNumber, location, speed });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
