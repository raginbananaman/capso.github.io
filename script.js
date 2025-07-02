// This script will now wait for the 'navigationLoaded' event.
// This guarantees that all elements from nav.html (like the notification toggle)
// are present in the document before this script tries to find them.
document.addEventListener('navigationLoaded', () => {
    console.log("'navigationLoaded' event received. Initializing dashboard script.");

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

    const VAPID_KEY = "YOUR_VAPID_KEY_HERE";

    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
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
    
    // These elements are loaded from nav.html, so we select them carefully
    const installAppBtn = document.getElementById('install-app-btn');
    const notificationToggle = document.getElementById('notification-toggle');

    // =================================================================
    // PWA & NOTIFICATIONS
    // =================================================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered successfully:', registration);
                    return registration.pushManager.getSubscription();
                })
                .then(subscription => {
                    isNotificationSubscribed = !(subscription === null);
                    updateNotificationUI();
                })
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (installAppBtn) installAppBtn.classList.remove('hidden');
        console.log('`beforeinstallprompt` event was fired.');
    });

    if (installAppBtn) {
        installAppBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            if (outcome === 'accepted') {
                installAppBtn.classList.add('hidden');
            }
            deferredInstallPrompt = null;
        });
    }

    function updateNotificationUI() {
        if (notificationToggle) {
            notificationToggle.checked = isNotificationSubscribed;
        }
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
            console.error("VAPID Key is not set in script.js.");
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
                isNotificationSubscribed = false;
                updateNotificationUI();
            }
        } catch (err) {
            console.error('Error unsubscribing', err);
        }
    }

    if (notificationToggle) {
        notificationToggle.addEventListener('change', () => {
            if (notificationToggle.checked) {
                subscribeUserToPush();
            } else {
                unsubscribeUserFromPush();
            }
        });
    }

    // =================================================================
    // UI HELPERS & RENDERERS
    // =================================================================
    function showSkeleton(show) {
        if (skeletonLoader) skeletonLoader.classList.toggle('hidden', !show);
        if (ordersListContainer) ordersListContainer.classList.toggle('hidden', show);
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function setModalMode(mode) {
        if (modalContentContainer) {
            modalContentContainer.classList.toggle('edit-mode', mode === 'edit');
            modalContentContainer.classList.toggle('view-mode', mode === 'view');
        }
    }

    function closeModal() {
        if (orderModal) orderModal.classList.add('hidden');
    }

    function openModal(isNew, order = {}) {
        currentOrderInModal = order;
        document.getElementById('modal-title').textContent = isNew ? 'Add New Order' : `Order #${order.orderId} Details`;
        setModalMode(isNew ? 'edit' : 'view');
        populateEditView(order);
        if (!isNew) populateDisplayView(order);
        document.getElementById('save-new-order-btn').classList.toggle('hidden', !isNew);
        document.getElementById('save-changes-btn').classList.toggle('hidden', isNew);
        if (orderModal) orderModal.classList.remove('hidden');
    }
    
    function addEditableItemRow(name = '', qty = '') {
        const itemsContainer = document.getElementById('items-container');
        if (!itemsContainer) return;
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
        if (itemsContainer) itemsContainer.innerHTML = '';
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

    async function fetchData() {
        showSkeleton(true);
        try {
            const snapshot = await ordersCollection.orderBy('orderId', 'desc').get();
            allOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            render();
        } catch (e) {
            console.error("Error loading data:", e);
            if (ordersListContainer) ordersListContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error loading data. Please check connection.</p>`;
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
            if (confirmDeleteModal) confirmDeleteModal.classList.add('hidden');
            await fetchData();
            closeModal();
        } catch (err) {
            console.error("Delete failed:", err);
            alert('Delete failed.');
        }
    }

    function render() {
        renderOrdersList();
        renderCalendar();
    }

    function renderOrdersList() {
        if (!ordersListContainer) return;
        const filtered = allOrders.filter(o => {
            if (!o) return false;
            if (currentFilter === 'All') return true;
            if (currentFilter === 'Active') return ['PENDING', 'SCHEDULED', 'OUT FOR DELIVERY'].includes(o.status);
            return o.status === currentFilter;
        });
        const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
        ordersListContainer.innerHTML = paginated.map(order => {
            const statusClass = `status-${order.status.toLowerCase().replace(/ /g, '-')}`;
            return `
                <div class="bg-white rounded-xl shadow-md overflow-hidden ring-1 ring-black ring-opacity-5">
                    <div class="p-4 sm:p-6">
                        <div class="flex justify-between items-start gap-4">
                            <div class="flex-grow min-w-0">
                                <p class="text-sm font-medium text-indigo-600">Order #${order.orderId}</p>
                                <p class="text-xl font-bold text-gray-900 truncate">${order.customer || 'N/A'}</p>
                                <p class="text-sm text-gray-500 truncate">${order.address || 'No address'}</p>
                            </div>
                            <div class="flex-shrink-0">
                                <p class="status-badge ${statusClass}">${order.status || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="px-4 py-3 sm:px-6 bg-gray-50 border-t border-gray-200">
                        <button class="view-details-btn w-full rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50" data-order-id="${order.orderId}">
                        View Details
                        </button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-center text-gray-500 py-8">No orders match this filter.</p>';
    }

    function renderCalendar() {
        if (!calendarGrid || !currentWeekDisplay) return;
        const start = getStartOfWeek(calendarDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        currentWeekDisplay.textContent = `${start.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${end.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
        if (window.innerWidth < 768) {
            renderAgendaView(start);
        } else {
            renderGridView(start, end);
        }
    }

    function renderGridView(start, end) {
        if (!calendarGrid) return;
        calendarGrid.className = 'grid grid-cols-7 gap-4';
        const weekOrders = allOrders.filter(order => {
            if (!order.scheduledDate) return false;
            const d = new Date(order.scheduledDate);
            d.setHours(0,0,0,0);
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
            const list = ordersToday.map(o => `<li class="text-xs truncate bg-white p-1 rounded" title="${o.orderId} - ${o.customer}">${o.customer}</li>`).join('');
            return `<div class="bg-gray-50 p-2 rounded-lg min-h-[120px]">
                <div class="text-sm font-semibold text-center">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div class="text-xs text-gray-500 mb-2 text-center">${day.getDate()}</div>
                <ul class="space-y-1">${list || ''}</ul>
            </div>`;
        }).join('');
    }

    function renderAgendaView(start) {
        if (!calendarGrid) return;
        calendarGrid.className = 'flex overflow-x-auto snap-x snap-mandatory space-x-4 pb-4';
        let html = '';
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(day.getDate() + i);
            const dayStr = day.toISOString().split('T')[0];
            const ordersToday = allOrders.filter(o => o.scheduledDate?.startsWith(dayStr));
            const isToday = new Date().toDateString() === day.toDateString();
            html += `
                <div class="snap-center flex-shrink-0 w-[85%] sm:w-[60%] md:w-[45%] bg-white rounded-xl shadow-lg p-4 ring-1 ring-gray-900/5">
                    <div class="flex justify-between items-center mb-3">
                        <div class="font-bold text-gray-800">${day.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                        <div class="text-sm font-semibold ${isToday ? 'bg-yellow-300 text-gray-900' : 'bg-gray-200 text-gray-600'} rounded-full px-3 py-1">${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div class="space-y-3 h-48 overflow-y-auto">
                    ${ordersToday.length > 0
                        ? ordersToday.map(o => {
                            let iconSvg = '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>';
                            if(o.status === 'OUT FOR DELIVERY') iconSvg = '<svg class="w-5 h-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M1.5 7.143a.75.75 0 0 1 .75-.75h1.23a.75.75 0 0 1 .743.648l.512 2.563a.75.75 0 0 1-.343.834L3.18 11.5a.75.75 0 0 1-.94-.312l-1.34-2.345a.75.75 0 0 1 .311-.95l.292-.15Z" clip-rule="evenodd" /><path fill-rule="evenodd" d="M4.623 8.384a.75.75 0 0 1 .743.648l.513 2.563a.75.75 0 0 1-.343.834l-1.206.603a.75.75 0 0 1-.94-.312l-1.34-2.345a.75.75 0 0 1 .311-.95l3.253-1.626Zm2.633-.001.023-.011a.75.75 0 0 1 1.018-.43l3.354 1.342a.75.75 0 0 1 .311.95l-1.34 2.345a.75.75 0 0 1-.95.311L6.34 11.5a.75.75 0 0 1-.343-.834l.513-2.563a.75.75 0 0 1 .743-.648ZM10.5 6.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Z" clip-rule="evenodd" /><path d="M8.25 10a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z" /><path d="M14 6.25a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H14.75a.75.75 0 0 1-.75-.75Z" /><path d="M14 10a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Z" /><path d="M14 13.75a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H14.75a.75.75 0 0 1-.75-.75Z" /><path d="M14 17.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Z" /></svg>';
                            if(o.status === 'COMPLETE') iconSvg = '<svg class="w-5 h-5 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.06 0l4-5.5Z" clip-rule="evenodd" /></svg>';
                            if(o.status === 'CANCELED') iconSvg = '<svg class="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>';
                            return `
                                <div class="flex items-start space-x-3 bg-gray-50 p-2.5 rounded-lg">
                                    <div class="mt-0.5">${iconSvg}</div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-semibold text-gray-800 truncate">${o.customer}</p>
                                        <p class="text-xs text-gray-500">Order #${o.orderId}</p>
                                    </div>
                                    <div class="text-xs font-medium text-white ${o.status === 'PENDING' ? 'bg-red-500' : 'bg-blue-500'} rounded-full px-2 py-1">${o.status.split(' ')[0]}</div>
                                </div>
                            `;
                        }).join('')
                        : `<div class="text-center text-sm text-gray-400 py-8 flex flex-col items-center justify-center h-full">
                               <svg class="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-1.414v.001M9 12h.01M15 12h.01M12 9v.01M12 15v.01"></path></svg>
                               <p class="mt-2 font-medium">No deliveries today!</p>
                           </div>`
                    }
                    </div>
                </div>
            `;
        }
        calendarGrid.innerHTML = html;
        const todayCard = document.querySelector('.bg-yellow-300');
        if (todayCard) {
            todayCard.parentElement.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    // =================================================================
    // EVENT HANDLERS
    // =================================================================
    if (addNewOrderBtn) addNewOrderBtn.addEventListener('click', () => openModal(true));

    if (ordersListContainer) {
        ordersListContainer.addEventListener('click', e => {
            const btn = e.target.closest('.view-details-btn');
            if (!btn) return;
            const order = allOrders.find(o => o.orderId == btn.dataset.orderId);
            if (order) openModal(false, order);
        });
    }

    if (orderModal) {
        orderModal.addEventListener('click', e => {
            const t = e.target;
            if (t.closest('.modal-cancel')) closeModal();
            if (t.closest('#edit-order-btn')) setModalMode('edit');
            if (t.closest('#save-new-order-btn')) handleSave(true);
            if (t.closest('#save-changes-btn')) handleSave(false);
            if (t.closest('#delete-order-btn')) {
                document.getElementById('confirm-delete-message').textContent = `Delete order #${currentOrderInModal.orderId}?`;
                if (confirmDeleteModal) confirmDeleteModal.classList.remove('hidden');
            }
            if (t.closest('#add-item-btn')) addEditableItemRow();
            if (t.closest('.remove-item-btn')) t.closest('.flex').remove();
        });
    }

    if (confirmDeleteModal) {
        confirmDeleteModal.addEventListener('click', e => {
            if (e.target.closest('#cancel-delete-btn')) confirmDeleteModal.classList.add('hidden');
            if (e.target.closest('#confirm-delete-btn')) handleDelete();
        });
    }

    if (filterContainer) {
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
    }

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            calendarDate.setDate(calendarDate.getDate() - 7);
            renderCalendar();
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            calendarDate.setDate(calendarDate.getDate() + 7);
            renderCalendar();
        });
    }

    window.addEventListener('resize', renderCalendar);

    // =================================================================
    // INIT
    // =================================================================
    fetchData();
});
