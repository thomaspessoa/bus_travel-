const driverMap = L.map('driver-map').setView([0, 0], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(driverMap);

const socket = io();
let currentTrip = null;
let simulationInterval = null; // Changed from watchId to simulationInterval
let currentRoute = null;

// Function to simulate trip progress
function simulateTrip(startCoords, endCoords, busNumber) {
    let currentStep = 0;
    const totalSteps = 50; // Simulate 50 steps for the trip

    simulationInterval = setInterval(() => {
        if (currentStep > totalSteps) {
            // End of simulation, but don't clear here. Let the 'end-trip' button handle it.
            return;
        }

        // Simple linear interpolation
        const lat = startCoords[0] + (endCoords[0] - startCoords[0]) * (currentStep / totalSteps);
        const lng = startCoords[1] + (endCoords[1] - startCoords[1]) * (currentStep / totalSteps);

        const location = { lat, lng };
        const speed = (Math.random() * 20 + 40).toFixed(2); // Random speed between 40-60 km/h

        socket.emit('locationUpdate', { busNumber, location, speed });

        // Update marker on driver's map
        if (currentRoute) {
            driverMap.removeLayer(currentRoute);
        }
        currentRoute = L.marker([lat, lng]).addTo(driverMap)
            .bindPopup(`Velocidade: ${speed} km/h`)
            .openPopup();

        currentStep++;
    }, 2000); // Send update every 2 seconds
}


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

    // Get destination coordinates for the route
    const destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${tripData.destination}&format=json&limit=1`);
    const destData = await destRes.json();
    if (destData.length === 0) {
        alert("Destino não encontrado!");
        return;
    }
    const destCoords = [parseFloat(destData[0].lat), parseFloat(destData[0].lon)];

    navigator.geolocation.getCurrentPosition(pos => {
        const startCoords = [pos.coords.latitude, pos.coords.longitude];

        // Clear previous routing if it exists
        if (currentRoute) {
            driverMap.removeControl(currentRoute);
        }

        // Display route on driver's map
        currentRoute = L.Routing.control({
            waypoints: [
                L.latLng(startCoords[0], startCoords[1]),
                L.latLng(destCoords[0], destCoords[1])
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            itinerary: L.DomUtil.create('div', 'hidden')
        }).addTo(driverMap);

        // Start simulation
        simulateTrip(startCoords, destCoords, currentTrip.busNumber);
    });
});

document.getElementById('end-trip').addEventListener('click', async () => {
    if (simulationInterval) clearInterval(simulationInterval);

    await fetch(`/trips/${currentTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: document.getElementById('observations').value })
    });

    // Reset the UI
    document.getElementById('trip-form').style.display = 'block';
    document.getElementById('trip-controls').style.display = 'none';
    document.getElementById('trip-form').reset();
    currentTrip = null;
    simulationInterval = null;
    if (currentRoute) {
       driverMap.removeControl(currentRoute);
       currentRoute = null;
    }
    alert('Viagem encerrada! Você pode iniciar uma nova viagem.');
});
