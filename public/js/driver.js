const driverMap = L.map('driver-map').setView([0, 0], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(driverMap);

const socket = io();
const locationStatus = document.getElementById('location-status');
const startTripBtn = document.getElementById('start-trip-btn');

let currentTrip = null;
let watchId = null;
let routingControl = null;
let realTimeMarker = null;
let initialMarker = null;
let lastKnownPosition = null;

const formElements = {
    driverName: document.getElementById('driver-name'),
    destination: document.getElementById('destination'),
    busNumber: document.getElementById('bus-number'),
};

function setFormDisabled(disabled) {
    startTripBtn.disabled = disabled;
    Object.values(formElements).forEach(el => el.disabled = disabled);
}

locationStatus.textContent = 'Preencha os dados e clique em "Iniciar Viagem" para permitir a localização.';
setFormDisabled(false); // Enable form by default

function handleLocationError(error) {
    let message = 'Ocorreu um erro desconhecido ao obter a localização.';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Acesso à localização negado. Habilite a permissão nas configurações do seu navegador.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Informações de localização indisponíveis. Verifique o sinal do GPS.";
            break;
        case error.TIMEOUT:
            message = "Tempo para obter localização esgotado. Tente novamente em um local com melhor sinal.";
            break;
    }
    locationStatus.textContent = `Erro: ${message}`;
    locationStatus.style.color = '#d44a5a'; // Make error messages stand out
    console.error("Geolocation error:", error);
    setFormDisabled(false);
}

function startRealTimeTracking(busNumber) {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    const watchOptions = {
        enableHighAccuracy: true,
        timeout: 20000, // Increased timeout to 20 seconds for better mobile performance
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const location = { lat: latitude, lng: longitude };
            const speedKmh = speed ? (speed * 3.6).toFixed(2) : 0;

            socket.emit('locationUpdate', { busNumber, location, speed: speedKmh });

            if (realTimeMarker) {
                realTimeMarker.setLatLng([latitude, longitude]);
            } else {
                const busIcon = L.icon({
                    iconUrl: 'https://img.icons8.com/color/48/000000/bus.png',
                    iconSize: [38, 38],
                });
                realTimeMarker = L.marker([latitude, longitude], { icon: busIcon }).addTo(driverMap);
            }
            realTimeMarker.bindPopup(`Velocidade: ${speedKmh} km/h`).openPopup();

            locationStatus.textContent = 'Rastreamento em tempo real ativo.';
            locationStatus.style.color = '#555'; // Reset color on success
        },
        handleLocationError,
        watchOptions
    );
}


document.getElementById('trip-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!('geolocation' in navigator)) {
        locationStatus.textContent = 'Geolocalização não é suportada neste navegador.';
        return;
    }

    locationStatus.textContent = 'Solicitando permissão de localização...';
    setFormDisabled(true);

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            lastKnownPosition = pos;
            locationStatus.textContent = 'Localização obtida! Iniciando a viagem...';
            driverMap.setView([pos.coords.latitude, pos.coords.longitude], 15);
            if (initialMarker) driverMap.removeLayer(initialMarker);
            initialMarker = L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(driverMap).bindPopup("Ponto de Partida").openPopup();

            startTrip();
        },
        (error) => {
            handleLocationError(error);
            setFormDisabled(false);
        },
        { enableHighAccuracy: true }
    );
});

async function startTrip() {
    if (!lastKnownPosition) {
        locationStatus.textContent = 'Não foi possível obter a localização para iniciar a viagem.';
        setFormDisabled(false);
        return;
    }
    const startCoords = [lastKnownPosition.coords.latitude, lastKnownPosition.coords.longitude];
    const tripData = {
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR'),
        driverName: document.getElementById('driver-name').value,
        destination: document.getElementById('destination').value,
        busNumber: document.getElementById('bus-number').value,
        initialLocation: {
            location: { lat: startCoords[0], lng: startCoords[1] },
            speed: 0
        }
    };

    try {
        const response = await fetch('/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData)
        });
        currentTrip = await response.json();

        if (initialMarker) driverMap.removeLayer(initialMarker);
        initialMarker = null;

        document.getElementById('trip-form').style.display = 'none';
        document.getElementById('trip-controls').style.display = 'block';

        const destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${tripData.destination}&format=json&limit=1`);
        const destData = await destRes.json();
        const destCoords = destData.length > 0 ? [parseFloat(destData[0].lat), parseFloat(destData[0].lon)] : startCoords;

        if (routingControl) driverMap.removeControl(routingControl);

        routingControl = L.Routing.control({
            waypoints: [L.latLng(startCoords[0], startCoords[1]), L.latLng(destCoords[0], destCoords[1])],
            addWaypoints: false,
            routeWhileDragging: false,
            itinerary: L.DomUtil.create('div', 'hidden'),
        }).addTo(driverMap);

        startRealTimeTracking(currentTrip.busNumber);

    } catch (error) {
        console.error("Failed to start trip:", error);
        locationStatus.textContent = "Falha ao iniciar a viagem. Verifique a conexão.";
    }
}

document.getElementById('end-trip').addEventListener('click', async () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    await fetch(`/trips/${currentTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: document.getElementById('observations').value })
    });

    document.getElementById('trip-form').style.display = 'block';
    document.getElementById('trip-controls').style.display = 'none';
    document.getElementById('trip-form').reset();
    document.getElementById('observations').value = '';

    if (routingControl) driverMap.removeControl(routingControl);
    if (realTimeMarker) driverMap.removeLayer(realTimeMarker);

    routingControl = realTimeMarker = currentTrip = null;

    locationStatus.textContent = 'Viagem encerrada! Aguardando nova localização inicial...';
    startTripBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(pos => {
        lastKnownPosition = pos;
        driverMap.setView([pos.coords.latitude, pos.coords.longitude]);
        initialMarker = L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(driverMap).bindPopup("Você está aqui").openPopup();
        locationStatus.textContent = 'Pronto para iniciar uma nova viagem!';
        startTripBtn.disabled = false;
    }, handleLocationError);
});
