const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const busMarkers = {};
const activeBuses = {};
const socket = io();

socket.on('busLocationUpdate', ({ busNumber, location, speed, driverName }) => {
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

    // Update active buses list
    activeBuses[busNumber] = { driverName, speed };
    updateActiveBusesList();
});

socket.on('tripEnded', (busNumber) => {
    // Remove from active buses list
    delete activeBuses[busNumber];
    updateActiveBusesList();
    if (busMarkers[busNumber]) {
        map.removeLayer(busMarkers[busNumber]);
        delete busMarkers[busNumber];
    }
    fetchTrips();
});


async function fetchTrips(date = '') {
    const url = date ? `/trips?date=${date}` : '/trips';
    const response = await fetch(url);
    const trips = await response.json();
    const tableBody = document.getElementById('history-table');
    tableBody.innerHTML = '';
    trips.forEach(trip => {
        const row = `<tr>
            <td>${trip.date}</td>
            <td>${trip.driverName}</td>
            <td>${trip.busNumber}</td>
            <td>${trip.startTime}</td>
            <td>${trip.endTime || ''}</td>
            <td>${trip.destination}</td>
            <td>${trip.observations || ''}</td>
            <td>
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
async function viewRoute(id) {
    const response = await fetch(`/trips/${id}`);
    const trip = await response.json();
    const modal = document.getElementById('route-modal');
    modal.style.display = 'flex';

    // Ensure map is re-initialized correctly
    if (routeMapInstance) {
        routeMapInstance.remove();
    }
    routeMapInstance = L.map('route-map').setView([trip.locations[0].lat, trip.locations[0].lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(routeMapInstance);

    const latlngs = trip.locations.map(loc => [loc.lat, loc.lng]);
    L.polyline(latlngs, { color: 'red' }).addTo(routeMapInstance);
}

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('route-modal').style.display = 'none';
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
                              Velocidade: ${bus.speed} km/h`;
        list.appendChild(listItem);
    }
}


fetchTrips();
