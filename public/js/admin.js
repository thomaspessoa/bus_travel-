const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const busMarkers = {};
const activeBuses = {};
const socket = io();

socket.on('busLocationUpdate', ({ busNumber, location, speed, driverName, destination }) => {
    if (busMarkers[busNumber]) {
        busMarkers[busNumber].setLatLng([location.lat, location.lng]);
    } else {
        const busIcon = L.divIcon({
            html: `<span>${busNumber}</span><img src="https://img.icons8.com/color/48/000000/bus.png" alt="bus"/>`,
            className: 'bus-icon'
        });
        busMarkers[busNumber] = L.marker([location.lat, location.lng], { icon: busIcon }).addTo(map);
    }
    busMarkers[busNumber].bindPopup(`Ônibus ${busNumber}<br>Motorista: ${driverName}<br>Velocidade: ${speed} km/h`);

    activeBuses[busNumber] = { driverName, speed, destination };
    updateActiveBusesList();
});

socket.on('tripEnded', (busNumber) => {
    delete activeBuses[busNumber];
    updateActiveBusesList();
    if (busMarkers[busNumber]) {
        map.removeLayer(busMarkers[busNumber]);
        delete busMarkers[busNumber];
    }
    fetchTrips();
});

socket.on('tripStarted', (trip) => {
    const { busNumber, driverName, destination, speed = 0, locations } = trip;
    activeBuses[busNumber] = { driverName, speed, destination };
    updateActiveBusesList();

    if (locations && locations.length > 0) {
        const lastLocation = locations[locations.length - 1].location;
        const busIcon = L.divIcon({
            html: `<span>${busNumber}</span><img src="https://img.icons8.com/color/48/000000/bus.png" alt="bus"/>`,
            className: 'bus-icon'
        });
        if (!busMarkers[busNumber]) {
            busMarkers[busNumber] = L.marker([lastLocation.lat, lastLocation.lng], { icon: busIcon }).addTo(map);
        }
        busMarkers[busNumber].bindPopup(`Ônibus ${busNumber}<br>Motorista: ${driverName}<br>Velocidade: ${speed} km/h`);
    }
    fetchTrips();
});

async function fetchTrips(date = '') {
    await new Promise(resolve => setTimeout(resolve, 500));

    const url = date ? `/trips?date=${date}` : '/trips';
    const response = await fetch(url);
    const trips = await response.json();
    const tableBody = document.getElementById('history-table');
    tableBody.innerHTML = '';
    trips.forEach(trip => {
        const row = `<tr>
            <td data-label="Data">${trip.date}</td>
            <td data-label="Motorista">${trip.driverName}</td>
            <td data-label="Ônibus">${trip.busNumber}</td>
            <td data-label="Início">${trip.startTime}</td>
            <td data-label="Fim">${trip.endTime || ''}</td>
            <td data-label="Destino">${trip.destination}</td>
            <td data-label="Observações">${trip.observations || ''}</td>
            <td data-label="Ações">
                <button onclick="viewRoute(${trip.id})">Ver Trajeto</button>
                <button onclick="deleteTrip(${trip.id})">Excluir</button>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

async function deleteTrip(id) {
    await fetch(`/trips/${id}`, { method: 'DELETE' });
    fetchTrips();
}

let routeMapInstance = null;

async function viewRoute(id, retries = 3) {
    if (retries <= 0) {
        alert("Não foi possível carregar o trajeto desta viagem.");
        return;
    }

    const response = await fetch(`/trips/${id}`);
    const trip = await response.json();

    if (!trip.locations || trip.locations.length === 0) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return viewRoute(id, retries - 1);
    }

    const modal = document.getElementById('route-modal');
    modal.style.display = 'flex';

    if (routeMapInstance) {
        routeMapInstance.remove();
    }

    const latlngs = trip.locations.map(p => [p.location.lat, p.location.lng]);
    const bounds = L.latLngBounds(latlngs);

    routeMapInstance = L.map('route-map').fitBounds(bounds);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(routeMapInstance);

    L.polyline(latlngs, { color: 'red' }).addTo(routeMapInstance);

    let totalSpeed = 0;
    trip.locations.forEach(p => {
        totalSpeed += parseFloat(p.speed || 0);
        L.circleMarker([p.location.lat, p.location.lng], {
            radius: 5, color: 'blue', fillOpacity: 0.8
        }).addTo(routeMapInstance).bindTooltip(`Velocidade: ${p.speed} km/h`);
    });

    const averageSpeed = trip.locations.length > 0 ? (totalSpeed / trip.locations.length).toFixed(2) : 0;

    let durationString = "N/A";
    if (trip.startTime && trip.endTime) {
        const start = new Date(`1970-01-01T${trip.startTime}`);
        const end = new Date(`1970-01-01T${trip.endTime}`);
        const diffMs = end - start;

        if (!isNaN(diffMs) && diffMs > 0) {
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            const seconds = Math.floor(((diffMs % 360000) % 60000) / 1000);
            durationString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    const detailsDiv = document.getElementById('route-details');
    detailsDiv.innerHTML = `<strong>Velocidade Média:</strong> ${averageSpeed} km/h <br> <strong>Duração da Viagem:</strong> ${durationString}`;
}

document.getElementById('close-modal').addEventListener('click', () => {
    const modal = document.getElementById('route-modal');
    modal.style.display = 'none';
    if (routeMapInstance) {
        routeMapInstance.remove();
        routeMapInstance = null;
    }
});

document.getElementById('date-filter').addEventListener('change', (e) => {
    fetchTrips(e.target.value);
});

document.getElementById('search-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-input').value;
    if (busMarkers[searchTerm]) {
        map.setView(busMarkers[searchTerm].getLatLng(), 15);
        busMarkers[searchTerm].openPopup();
    } else {
        alert('Ônibus não encontrado ou não está em viagem.');
    }
});

document.getElementById('toggle-history-btn').addEventListener('click', (e) => {
    const historyContainer = document.querySelector('.history-container');
    const isVisible = historyContainer.style.display !== 'none';
    historyContainer.style.display = isVisible ? 'none' : 'block';
    e.target.textContent = isVisible ? 'Mostrar Histórico' : 'Ocultar Histórico';
});

function updateActiveBusesList() {
    const list = document.getElementById('active-buses-list');
    list.innerHTML = '';
    for (const busNumber in activeBuses) {
        const bus = activeBuses[busNumber];
        const listItem = document.createElement('li');
        listItem.innerHTML = `<strong>Ônibus ${busNumber}</strong><br>
                              Motorista: ${bus.driverName}<br>
                              Destino: ${bus.destination}<br>
                              Velocidade: ${bus.speed} km/h`;
        list.appendChild(listItem);
    }
}

async function initializeActiveBuses() {
    try {
        const response = await fetch('/trips');
        const trips = await response.json();

        trips.forEach(trip => {
            if (!trip.endTime) {
                // This trip is active
                activeBuses[trip.busNumber] = {
                    driverName: trip.driverName,
                    speed: trip.speed || 0,
                    destination: trip.destination
                };

                if (trip.locations && trip.locations.length > 0) {
                    const lastLocation = trip.locations[trip.locations.length - 1].location;
                    const busIcon = L.divIcon({
                        html: `<span>${trip.busNumber}</span><img src="https://img.icons8.com/color/48/000000/bus.png" alt="bus"/>`,
                        className: 'bus-icon'
                    });
                    if (!busMarkers[trip.busNumber]) {
                        busMarkers[trip.busNumber] = L.marker([lastLocation.lat, lastLocation.lng], { icon: busIcon }).addTo(map);
                    }
                    busMarkers[trip.busNumber].bindPopup(`Ônibus ${trip.busNumber}<br>Motorista: ${trip.driverName}<br>Velocidade: ${trip.speed || 0} km/h`);
                }
            }
        });
        updateActiveBusesList(); // This was the missing call
    } catch (error) {
        console.error("Failed to initialize active buses:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchTrips();
    initializeActiveBuses();
});
