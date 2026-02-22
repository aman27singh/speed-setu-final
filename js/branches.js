// branches.js - initialize Leaflet map and populate branch markers
document.addEventListener('DOMContentLoaded', function () {
  const branches = [
    { id: 'jamshedpur', name: 'Jamshedpur Branch', city: 'Jamshedpur', addr: 'Bistupur, Jamshedpur', coords: [22.8046, 86.2029] },
    { id: 'delhi', name: 'Delhi Office', city: 'New Delhi', addr: 'Connaught Place, New Delhi', coords: [28.7041, 77.1025] },
    { id: 'imt-manesar', name: 'IMT Manesar', city: 'Manesar (Gurugram)', addr: 'IMT Manesar, Gurugram', coords: [28.3942, 76.8600] },
    { id: 'dehradun', name: 'Dehradun Branch', city: 'Dehradun', addr: 'City Center, Dehradun', coords: [30.3165, 78.0322] },
    { id: 'jaipur', name: 'Jaipur Branch', city: 'Jaipur', addr: 'C Scheme, Jaipur', coords: [26.9124, 75.7873] },
    { id: 'bangalore', name: 'Bengaluru Office', city: 'Bengaluru', addr: 'Whitefield, Bengaluru', coords: [12.9716, 77.5946] },
    { id: 'pantnagar', name: 'Pantnagar Branch', city: 'Pantnagar', addr: 'Pantnagar Industrial Area', coords: [29.0276, 79.4911] },
    { id: 'ahmedabad', name: 'Ahmedabad Branch', city: 'Ahmedabad', addr: 'Navrangpura, Ahmedabad', coords: [23.0225, 72.5714] },
    { id: 'chennai', name: 'Chennai Office', city: 'Chennai', addr: 'Guindy, Chennai', coords: [13.0827, 80.2707] },
    { id: 'vapi', name: 'Vapi Branch', city: 'Vapi', addr: 'Vapi Industrial Estate', coords: [20.3839, 72.9346] },
    { id: 'mumbai', name: 'Mumbai Hub', city: 'Mumbai', addr: 'Andheri East, Mumbai', coords: [19.0760, 72.8777] },
    { id: 'guwahati', name: 'Guwahati Branch', city: 'Guwahati', addr: 'Pan Bazaar, Guwahati', coords: [26.1445, 91.7362] },
    { id: 'lucknow', name: 'Lucknow Branch', city: 'Lucknow', addr: 'Hazratganj, Lucknow', coords: [26.8467, 80.9462] },
    { id: 'bhopal', name: 'Bhopal Branch', city: 'Bhopal', addr: 'Arera Colony, Bhopal', coords: [23.2599, 77.4126] },
    { id: 'hyderabad', name: 'Hyderabad Office', city: 'Hyderabad', addr: 'Hitech City, Hyderabad', coords: [17.3850, 78.4867] },
    { id: 'ranchi', name: 'Ranchi Branch', city: 'Ranchi', addr: 'Hatia, Ranchi', coords: [23.3441, 85.3096] },
    { id: 'pune', name: 'Pune Hub', city: 'Pune', addr: 'Viman Nagar, Pune', coords: [18.5204, 73.8567] }
  ];
  const list = document.getElementById('branchItems');

  // If Leaflet failed to load (e.g., CDN blocked or integrity mismatch), show helpful fallback
  if (typeof L === 'undefined') {
    const mapEl = document.getElementById('branches-map');
    if (mapEl) {
      mapEl.innerHTML = '<div style="padding:24px;color:var(--muted);">Map failed to load. Please check your internet connection or allow external resources. You can still click locations on the right.</div>';
      mapEl.style.display = 'flex';
      mapEl.style.alignItems = 'center';
      mapEl.style.justifyContent = 'center';
    }

    // still populate the list so users can see branch info and click to copy coords
    branches.forEach(b => {
      const li = document.createElement('li');
      li.dataset.lat = b.coords[0];
      li.dataset.lng = b.coords[1];
      li.innerHTML = `<div class="branch-name">${b.name}</div><div class="branch-city">${b.city} · ${b.addr}</div>`;
      li.addEventListener('click', () => {
        // fallback: open Google Maps in new tab centered on coords
        const url = `https://www.google.com/maps/search/?api=1&query=${b.coords[0]},${b.coords[1]}`;
        window.open(url, '_blank');
      });
      list.appendChild(li);
    });

    return;
  }

  // init map (Leaflet is available)
  const map = L.map('branches-map', { scrollWheelZoom: false }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markers = [];

  branches.forEach(b => {
    const marker = L.marker(b.coords).addTo(map).bindPopup(`<strong>${b.name}</strong><br>${b.addr}`);
    markers.push(marker);

    const li = document.createElement('li');
    li.dataset.lat = b.coords[0];
    li.dataset.lng = b.coords[1];
    li.innerHTML = `<div class="branch-name">${b.name}</div><div class="branch-city">${b.city} · ${b.addr}</div>`;
    li.addEventListener('click', () => {
      map.setView(b.coords, 13, { animate: true });
      marker.openPopup();
    });
    list.appendChild(li);
  });

  // fit map to markers
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.2));
});
