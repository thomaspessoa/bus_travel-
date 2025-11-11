const express = require('express');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();

const sslOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

const server = https.createServer(sslOptions, app);
const io = socketIo(server);

const PORT = process.env.PORT || 8080;
const TRIPS_FILE = path.join(__dirname, 'trips.json');

app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
}));
app.use(express.static('public'));
app.use(express.json());

let trips = [];
try {
    if (fs.existsSync(TRIPS_FILE)) {
        const data = fs.readFileSync(TRIPS_FILE, 'utf8');
        if (data) trips = JSON.parse(data);
    } else {
        fs.writeFileSync(TRIPS_FILE, '[]', 'utf8');
    }
} catch (err) {
    console.error("Error initializing trips.json:", err);
}

const saveTripsToFile = () => {
    try {
        const data = JSON.stringify(trips, null, 2);
        fs.writeFileSync(TRIPS_FILE, data, 'utf8');
    } catch (err) {
        console.error("Failed to save trips to file:", err);
    }
};

let activeBuses = {};
trips.forEach(trip => {
    if (!trip.endTime) {
        activeBuses[trip.busNumber] = trip;
    }
});

const auth = (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).send('Unauthorized');
};

app.get('/admin.html', auth, (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/driver.html', auth, (req, res) => res.sendFile(path.join(__dirname, 'public/driver.html')));

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
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.post('/trips', (req, res) => {
    const trip = req.body;
    trip.id = Date.now();
    trip.startTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    trip.locations = [];
    if (trip.initialLocation) {
        trip.locations.push(trip.initialLocation);
        delete trip.initialLocation;
    }

    trips.push(trip);
    activeBuses[trip.busNumber] = { ...trip };
    saveTripsToFile();
    io.emit('tripStarted', trip); // Notify all clients
    res.status(201).json(trip);
});

app.put('/trips/:id', (req, res) => {
    const { id } = req.params;
    const { observations } = req.body;
    const tripIndex = trips.findIndex(t => t.id == id);
    if (tripIndex !== -1) {
        trips[tripIndex].observations = observations;
        trips[tripIndex].endTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        delete activeBuses[trips[tripIndex].busNumber];
        saveTripsToFile();
        io.emit('tripEnded', trips[tripIndex].busNumber);
        res.json(trips[tripIndex]);
    } else {
        res.status(404).send('Trip not found');
    }
});

app.get('/trips', (req, res) => {
    const { date } = req.query;
    res.json(date ? trips.filter(t => t.date === date) : trips);
});

app.get('/trips/:id', (req, res) => {
    const trip = trips.find(t => t.id == req.params.id);
    if (trip) res.json(trip);
    else res.status(404).send('Trip not found');
});

app.delete('/trips/:id', (req, res) => {
    trips = trips.filter(t => t.id != req.params.id);
    saveTripsToFile();
    res.status(204).send();
});

io.on('connection', (socket) => {
    socket.on('locationUpdate', (data) => {
        const { busNumber, location, speed } = data;
        const trip = trips.find(t => t.busNumber === busNumber && !t.endTime);
        if (trip) {
            trip.locations.push({ location, speed });
            trip.speed = speed;
            saveTripsToFile();
            io.emit('busLocationUpdate', { busNumber, location, speed, ...trip });
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on https://0.0.0.0:${PORT}.`);
});
