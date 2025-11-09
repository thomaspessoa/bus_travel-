const driverMap = L.map('driver-map').setView([0, 0], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(driverMap);

const socket = io();
let currentTrip = null;
let watchId = null;

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        driverMap.setView([pos.coords.latitude, pos.coords.longitude]);
        L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(driverMap).bindPopup("Você está aqui").openPopup();
    });
}

document.getElementById('trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const now = new Date();
    const tripData = {
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR'),
        driverName: document.getElementById('driver-name').value,
        destination: document.getElementById('destination').value,
        busNumber: document.getElementById('bus-number').value,
    };

    const response = await fetch('/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
    });
    currentTrip = await response.json();

    document.getElementById('trip-form').style.display = 'none';
    document.getElementById('trip-controls').style.display = 'block';

    // Get destination coordinates
    const destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${tripData.destination}&format=json`);
    const destData = await destRes.json();
    const destCoords = [destData[0].lat, destData[0].lon];


    navigator.geolocation.getCurrentPosition(pos => {
        L.Routing.control({
            waypoints: [
                L.latLng(pos.coords.latitude, pos.coords.longitude),
                L.latLng(destCoords[0], destCoords[1])
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            itinerary: L.DomUtil.create('div', 'hidden') // This hides the itinerary
        }).addTo(driverMap);
    });


    watchId = navigator.geolocation.watchPosition(pos => {
        const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
        };
        const speed = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(2) : 0;
        socket.emit('locationUpdate', { busNumber: currentTrip.busNumber, location, speed });
    });
});

document.getElementById('end-trip').addEventListener('click', async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    await fetch(`/trips/${currentTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: document.getElementById('observations').value })
    });

    alert('Viagem encerrada!');
    document.getElementById('trip-form').style.display = 'block';
    document.getElementById('trip-controls').style.display = 'none';
});
