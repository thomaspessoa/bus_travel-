const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const TRIPS_FILE = './trips.json';

app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
}));
app.use(express.static('public'));
app.use(express.json());

// Load trips from file on startup
let trips = [];
try {
    const data = fs.readFileSync(TRIPS_FILE, 'utf8');
    trips = JSON.parse(data);
} catch (err) {
    console.error("Could not read trips.json, starting with an empty list.", err);
    trips = [];
}

const saveTripsToFile = () => {
    try {
        fs.writeFileSync(TRIPS_FILE, JSON.stringify(trips, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing to trips.json", err);
    }
};

let activeBuses = {};

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

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/driver.html');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.post('/trips', (req, res) => {
    const trip = req.body;
    trip.id = Date.now();
    trip.startTime = new Date().toLocaleTimeString();
    trip.locations = []; // Ensure locations array exists
    trips.push(trip);
    saveTripsToFile();
    activeBuses[trip.busNumber] = { ...trip };
    res.status(201).json(trip);
});

app.put('/trips/:id', (req, res) => {
    const { id } = req.params;
    const { observations } = req.body;
    const tripIndex = trips.findIndex(t => t.id == id);
    if (tripIndex !== -1) {
        const trip = trips[tripIndex];
        trip.observations = observations;
        trip.endTime = new Date().toLocaleTimeString();
        if (activeBuses[trip.busNumber]) {
            trip.locations = activeBuses[trip.busNumber].locations;
            delete activeBuses[trip.busNumber];
        }
        saveTripsToFile();
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
    saveTripsToFile();
    res.status(204).send();
});


// Socket.io connection
io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('locationUpdate', (data) => {
        const { busNumber, location, speed } = data;
        if (activeBuses[busNumber]) {
            if (!activeBuses[busNumber].locations) {
                activeBuses[busNumber].locations = [];
            }
            activeBuses[busNumber].locations.push({ location, speed });
            activeBuses[busNumber].speed = speed;
            io.emit('busLocationUpdate', {
                busNumber,
                location,
                speed,
                driverName: activeBuses[busNumber].driverName,
                destination: activeBuses[busNumber].destination
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} and available on the local network.`);
});
