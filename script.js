document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // FIREBASE & PWA CONFIGURATION
    // =================================================================
    const firebaseConfig = {
        apiKey: "AIzaSyCjKJmXAJ0C8v1To1tFaAyucfo8YRFTjcw",
        authDomain: "capso-dashboard-pwa.firebaseapp.com",
        projectId: "capso-dashboard-pwa",
        storageBucket: "capso-dashboard-pwa.appspot.com",
        messagingSenderId: "389493283794",
        appId: "1:389493283794:web:04af6938d8d8683271860b"
    };

    // THIS IS THE VAPID KEY FOR WEB PUSH NOTIFICATIONS.
    // GET THIS FROM: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
    const VAPID_KEY = "BL_43FfHONt9UDcrI4nBH6McL4eW-6kyy2m-54wmOpWTCDL7ebHh_jc1gqQtUj-2gBstZ4yFf40ElGw3DtPc1PM";

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const ordersCollection = db.collection("orders");
    const subscriptionsCollection = db.collection("subscriptions");

    // =================================================================
    // STATE
    // =================================================================
    let allOrders = [];
    let currentFilter = 'All';
    let currentPage = 1;
    const rowsPerPage = 10;
    let currentOrderInModal = null;
    let calendarDate = new Date();
    let deferredInstallPrompt = null;
    let isNotificationSubscribed = false;

    // =================================================================
    // SELECTORS
    // =================================================================
    const ordersListContainer = document.getElementById('orders-list-container');
    const paginationContainer = document.getElementById('table-pagination');
    const filterContainer = document.querySelector('.filters');
    const addNewOrderBtn = document.getElementById('add-new-order-btn');
    const orderModal = document.getElementById('order-modal');
    const modalContentContainer = document.getElementById('modal-content-container');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const installAppBtn = document.getElementById('install-app-btn');
    const notificationToggle = document.getElementById('notification-toggle');

    // =================================================================
    // PWA & NOTIFICATIONS
    // =================================================================

    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered successfully:', registration);
                    // Check initial subscription status
                    return registration.pushManager.getSubscription();
                })
                .then(subscription => {
                    isNotificationSubscribed = !(subscription === null);
                    updateNotificationUI();
                })
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // --- Custom Install Prompt ---
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); // Prevent the mini-infobar from appearing on mobile
        deferredInstallPrompt = e; // Stash the event so it can be triggered later.
        installAppBtn.classList.remove('hidden'); // Show the install button.
        console.log('`beforeinstallprompt` event was fired.');
    });

    installAppBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt(); // Show the install prompt.
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        if (outcome === 'accepted') {
            installAppBtn.classList.add('hidden'); // Hide button after install
        }
        deferredInstallPrompt = null; // We can only use it once.
    });

    // --- Push Notification Logic ---
    function updateNotificationUI() {
        notificationToggle.checked = isNotificationSubscribed;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function subscribeUserToPush() {
        if (VAPID_KEY === "YOUR_VAPID_KEY_HERE") {
            console.error("VAPID Key is not set in script.js. Please get it from your Firebase project settings.");
            alert("Notification setup is incomplete. Please contact the administrator.");
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const applicationServerKey = urlBase64ToUint8Array(VAPID_KEY);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            console.log('User is subscribed:', subscription);
            await subscriptionsCollection.doc(btoa(JSON.stringify(subscription))).set(subscription.toJSON());
            isNotificationSubscribed = true;
            updateNotificationUI();
        } catch (err) {
            console.error('Failed to subscribe the user: ', err);
            isNotificationSubscribed = false;
            updateNotificationUI();
        }
    }

    async function unsubscribeUserFromPush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscriptionsCollection.doc(btoa(JSON.stringify(subscription))).delete();
                await subscription.unsubscribe();
                console.log('User is unsubscribed.');
                isNotificationSubscribed = false;
                updateNotificationUI();
            }
        } catch (err) {
            console.error('Error unsubscribing', err);
        }
    }
    
    notificationToggle.addEventListener('change', () => {
        if (notificationToggle.checked) {
            subscribeUserToPush();
        } else {
            unsubscribeUserFromPush();
        }
    });

    // =================================================================
    // UI HELPERS & RENDERERS
    // =================================================================
    function showSkeleton(show) {
        if (show) {
            skeletonLoader.classList.remove('hidden');
            ordersListContainer.classList.add('hidden');
        } else {
            skeletonLoader.classList.add('hidden');
            ordersListContainer.classList.remove('hidden');
        }
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function setModalMode(mode) {
        modalContentContainer.classList.toggle('edit-mode', mode === 'edit');
        modalContentContainer.classList.toggle('view-mode', mode === 'view');
    }

    function closeModal() {
        orderModal.classList.add('hidden');
    }

    function openModal(isNew, order = {}) {
        currentOrderInModal = order;
        document.getElementById('modal-title').textContent = isNew ? 'Add New Order' : `Order #${order.orderId} Details`;
        setModalMode(isNew ? 'edit' : 'view');
        populateEditView(order);
        if (!isNew) populateDisplayView(order);
        document.getElementById('save-new-order-btn').classList.toggle('hidden', !isNew);
        document.getElementById('save-changes-btn').classList.toggle('hidden', isNew);
        orderModal.classList.remove('hidden');
    }

    function addEditableItemRow(name = '', qty = '') {
        const itemsContainer = document.getElementById('items-container');
        const row = document.createElement('div');
        row.className = 'flex items-center space-x-2';
        row.innerHTML = `
      <input type="text" placeholder="Item Name" value="${name}" class="item-name-input block w-full rounded-md border-0 py-1.5 ring-1 ring-inset ring-gray-300">
      <input type="number" placeholder="Qty" value="${qty}" class="item-qty-input block w-1/4 rounded-md border-0 py-1.5 ring-1 ring-inset ring-gray-300">
      <button type="button" class="remove-item-btn rounded-full p-1 text-gray-400 hover:text-gray-500">&times;</button>
    `;
        itemsContainer.appendChild(row);
    }

    function populateEditView(order) {
        document.getElementById('customer-name').value = order.customer || '';
        document.getElementById('customer-address').value = order.address || '';
        document.getElementById('schedule-date').value = order.scheduledDate ? new Date(order.scheduledDate).toISOString().split('T')[0] : '';
        document.getElementById('status').value = order.status || 'PENDING';
        document.getElementById('status-field-container').style.display = order.orderId ? 'block' : 'none';

        const itemsContainer = document.getElementById('items-container');
        itemsContainer.innerHTML = '';
        if (order.items && order.items.length) {
            order.items.forEach(i => addEditableItemRow(i.item, i.quantity));
        } else {
            addEditableItemRow();
        }
    }

    function populateDisplayView(order) {
        document.getElementById('display-order-id').textContent = order.orderId;
        document.getElementById('display-date-created').textContent = order.dateCreated ? new Date(order.dateCreated).toLocaleString() : 'N/A';
        document.getElementById('display-customer-name').textContent = order.customer;
        document.getElementById('display-customer-address').textContent = order.address;
        document.getElementById('display-schedule-date').textContent = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : 'Not Scheduled';
        document.getElementById('display-status').innerHTML = `<span class="status-badge status-${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span>`;

        let html = '<ul>';
        if (order.items && order.items.length) {
            order.items.forEach(i => html += `<li><span>${i.item}</span><span><strong>${i.quantity}</strong></span></li>`);
        } else {
            html += '<li>No items.</li>';
        }
        html += '</ul>';
        document.getElementById('display-items-list').innerHTML = html;
    }

    function getOrderDataFromModal(isNew) {
        const data = {
            customer: document.getElementById('customer-name').value.trim(),
            address: document.getElementById('customer-address').value.trim(),
            items: [],
            scheduledDate: document.getElementById('schedule-date').value || null,
        };
        if (!isNew) {
            data.status = document.getElementById('status').value;
        }

        document.querySelectorAll('#items-container .flex').forEach(row => {
            const name = row.querySelector('.item-name-input').value.trim();
            const qty = row.querySelector('.item-qty-input').value.trim();
            if (name && qty) data.items.push({ item: name, quantity: parseInt(qty) || 0 });
        });

        return data;
    }

    // =================================================================
    // DATA FETCH & ACTIONS
    // =================================================================
    async function fetchData() {
        showSkeleton(true);
        try {
            const snapshot = await ordersCollection.orderBy('orderId', 'desc').get();
            allOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            render();
        } catch (e) {
            console.error("Error loading data:", e);
            ordersListContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error loading data. Please check connection.</p>`;
        } finally {
            showSkeleton(false);
        }
    }

    async function handleSave(isNew) {
        const data = getOrderDataFromModal(isNew);
        if (!data.customer) {
            alert("Customer name is required.");
            return;
        }

        try {
            if (isNew) {
                data.orderId = allOrders.length ? Math.max(...allOrders.map(o => o.orderId || 0)) + 1 : 1;
                data.dateCreated = new Date().toISOString();
                data.status = data.scheduledDate ? 'SCHEDULED' : 'PENDING';
                // Using orderId as docId for simplicity and predictability
                await ordersCollection.doc(String(data.orderId)).set(data);
            } else {
                await ordersCollection.doc(currentOrderInModal.docId).update(data);
            }
            await fetchData();
            closeModal();
        } catch (err) {
            console.error("Failed to save order:", err);
            alert('Failed to save order.');
        }
    }

    async function handleDelete() {
        try {
            await ordersCollection.doc(currentOrderInModal.docId).delete();
            confirmDeleteModal.classList.add('hidden');
            await fetchData();
            closeModal();
        } catch (err) {
            console.error("Delete failed:", err);
            alert('Delete failed.');
        }
    }

    // =================================================================
    // RENDER UI
    // =================================================================
    function render() {
        renderOrdersList();
        renderCalendar();
    }

    function renderOrdersList() {
        const filtered = allOrders.filter(o => {
            if (!o) return false;
            if (currentFilter === 'All') return true;
            if (currentFilter === 'Active') return ['PENDING', 'SCHEDULED', 'OUT FOR DELIVERY'].includes(o.status);
            return o.status === currentFilter;
        });

        // The data is already sorted by orderId descending from the query.
        const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        ordersListContainer.innerHTML = paginated.map(order => {
            const statusClass = `status-${order.status.toLowerCase().replace(/ /g, '-')}`;
            return `
        <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
          <div class="px-4 py-5 sm:px-6 flex justify-between items-start">
            <div>
              <h3 class="text-base font-semibold leading-6 text-gray-900">${order.customer || 'N/A'}</h3>
              <p class="text-sm text-gray-500">Order #${order.orderId}</p>
            </div>
            <div class="status-badge ${statusClass}">${order.status || 'N/A'}</div>
          </div>
          <div class="border-t border-gray-200 px-4 py-4 sm:px-6">
            <button class="view-details-btn w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50" data-order-id="${order.orderId}">
              View Details
            </button>
          </div>
        </div>
      `;
        }).join('') || '<p class="text-center text-gray-500 py-8">No orders match this filter.</p>';
    }

    function renderCalendar() {
        const start = getStartOfWeek(calendarDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        currentWeekDisplay.textContent = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        
        // OPTIMIZATION: Render Agenda view on mobile, Grid view on desktop
        if (window.innerWidth < 768) {
            renderAgendaView(start);
        } else {
            renderGridView(start, end);
        }
    }

    function renderGridView(start, end) {
        calendarGrid.className = 'grid grid-cols-7 gap-4'; // Desktop grid
        const weekOrders = allOrders.filter(order => {
            const d = new Date(order.scheduledDate);
            return d >= start && d <= end;
        });

        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d;
        });

        calendarGrid.innerHTML = days.map(day => {
            const dayStr = day.toISOString().split('T')[0];
            const ordersToday = weekOrders.filter(o => o.scheduledDate?.startsWith(dayStr));
            const list = ordersToday.map(o => `<li class="text-xs truncate" title="${o.orderId} - ${o.customer}">${o.orderId} - ${o.customer}</li>`).join('');
            
            return `<div class="bg-gray-50 p-2 rounded-lg min-h-[100px]">
        <div class="text-sm font-semibold text-center">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div class="text-xs text-gray-500 mb-2 text-center">${day.getDate()}</div>
        <ul class="space-y-1">${list || '<li class="text-xs text-gray-400 text-center">No deliveries</li>'}</ul>
      </div>`;
        }).join('');
    }

    function renderAgendaView(start) {
        calendarGrid.className = 'space-y-4'; // Mobile list
        let html = '';
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(day.getDate() + i);
            const dayStr = day.toISOString().split('T')[0];
            const ordersToday = allOrders.filter(o => o.scheduledDate?.startsWith(dayStr));

            html += `
                <div class="bg-gray-50 p-3 rounded-lg">
                    <div class="font-semibold text-gray-800 border-b pb-2 mb-2">${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                    ${ordersToday.length > 0
                        ? `<ul class="space-y-2">` + ordersToday.map(o => `
                            <li class="flex justify-between items-center text-sm">
                                <span>#${o.orderId} - ${o.customer}</span>
                                <span class="status-badge status-${o.status.toLowerCase().replace(/ /g, '-')}">${o.status}</span>
                            </li>
                        `).join('') + `</ul>`
                        : `<p class="text-sm text-gray-500">No deliveries scheduled.</p>`
                    }
                </div>
            `;
        }
        calendarGrid.innerHTML = html;
    }


    // =================================================================
    // EVENT HANDLERS
    // =================================================================
    addNewOrderBtn.addEventListener('click', () => openModal(true));

    ordersListContainer.addEventListener('click', e => {
        const btn = e.target.closest('.view-details-btn');
        if (!btn) return;
        const order = allOrders.find(o => o.orderId == btn.dataset.orderId);
        if (order) openModal(false, order);
    });

    orderModal.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('.modal-cancel')) closeModal();
        if (t.closest('#edit-order-btn')) setModalMode('edit');
        if (t.closest('#save-new-order-btn')) handleSave(true);
        if (t.closest('#save-changes-btn')) handleSave(false);
        if (t.closest('#delete-order-btn')) {
            document.getElementById('confirm-delete-message').textContent = `Delete order #${currentOrderInModal.orderId}?`;
            confirmDeleteModal.classList.remove('hidden');
        }
        if (t.closest('#add-item-btn')) addEditableItemRow();
        if (t.closest('.remove-item-btn')) t.closest('.flex').remove();
    });

    confirmDeleteModal.addEventListener('click', e => {
        if (e.target.closest('#cancel-delete-btn')) confirmDeleteModal.classList.add('hidden');
        if (e.target.closest('#confirm-delete-btn')) handleDelete();
    });

    filterContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        filterContainer.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-gray-800', 'text-white');
            b.classList.add('bg-white', 'text-gray-700', 'ring-1', 'ring-inset', 'ring-gray-300', 'hover:bg-gray-50');
        });
        btn.classList.add('bg-gray-800', 'text-white');
        btn.classList.remove('bg-white', 'text-gray-700', 'ring-1', 'ring-inset', 'ring-gray-300', 'hover:bg-gray-50');
        currentFilter = btn.dataset.filter;
        renderOrdersList();
    });

    prevWeekBtn.addEventListener('click', () => {
        calendarDate.setDate(calendarDate.getDate() - 7);
        renderCalendar();
    });

    nextWeekBtn.addEventListener('click', () => {
        calendarDate.setDate(calendarDate.getDate() + 7);
        renderCalendar();
    });

    // Re-render calendar on window resize for responsiveness
    window.addEventListener('resize', renderCalendar);


    // =================================================================
    // INIT
    // =================================================================
    fetchData();
});
