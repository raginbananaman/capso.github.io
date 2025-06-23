document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // CONFIGURATION
    // =================================================================
    // PASTE THE firebaseConfig OBJECT YOU SAVED EARLIER FROM YOUR FIREBASE PROJECT
    const firebaseConfig = {
        apiKey: "AIzaSyCjKJmXAJ0C8v1To1tFaAyucfo8YRFTjcw",
        authDomain: "capso-dashboard-pwa.firebaseapp.com",
        projectId: "capso-dashboard-pwa",
        storageBucket: "capso-dashboard-pwa.firebasestorage.app",
        messagingSenderId: "389493283794",
        appId: "1:389493283794:web:04af6938d8d8683271860b"
    };
    
   // =================================================================
    // INITIALIZE FIREBASE
    // =================================================================
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const ordersCollection = db.collection("orders");

    // =================================================================
    // STATE MANAGEMENT
    // =================================================================
    let allOrders = [];
    let currentFilter = 'All';
    let currentPage = 1;
    const rowsPerPage = 10;
    let currentOrderInModal = null;
    let calendarDate = new Date();

    // =================================================================
    // ELEMENT SELECTORS
    // =================================================================
    const ordersListContainer = document.getElementById('orders-list-container');
    const paginationContainer = document.getElementById('table-pagination');
    const filterContainer = document.querySelector('.filters');
    const addNewOrderBtn = document.getElementById('add-new-order-btn');
    const orderModal = document.getElementById('order-modal');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const loadingSpinner = document.getElementById('loading-spinner');
    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');

    // =================================================================
    // RENDERING FUNCTIONS
    // =================================================================
    function showSpinner(message = 'Loading orders...') {
        if(loadingSpinner) {
            loadingSpinner.querySelector('p').textContent = message;
            loadingSpinner.classList.remove('hidden');
        }
    }

    function hideSpinner() {
        if(loadingSpinner) loadingSpinner.classList.add('hidden');
    }

    function render() {
        renderOrdersList();
        renderCalendar();
    }
    
    function renderOrdersList() {
        const filtered = allOrders.filter(order => {
            if (!order) return false;
            if (currentFilter === 'All') return true;
            if (currentFilter === 'Active') return ['PENDING', 'SCHEDULED', 'OUT FOR DELIVERY'].includes(order.status);
            return order.status === currentFilter;
        }).sort((a, b) => (b.orderId || 0) - (a.orderId || 0));

        renderPagination(filtered.length);
        const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
        
        let ordersHtml = '';
        if (paginated.length > 0) {
            paginated.forEach(order => {
                const scheduled = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not Scheduled';
                const statusClass = order.status ? `status-${order.status.toLowerCase().replace(/ /g, '-')}` : 'status-canceled';
                ordersHtml += `
                    <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
                        <div class="px-4 py-5 sm:px-6">
                            <div class="flex items-center justify-between">
                                <h3 class="text-base font-semibold leading-6 text-gray-900">${order.customer || 'N/A'}</h3>
                                <div class="status-badge ${statusClass}">${order.status || 'N/A'}</div>
                            </div>
                            <p class="mt-1 max-w-2xl text-sm text-gray-500">Order #${order.orderId} &bull; Scheduled: ${scheduled}</p>
                        </div>
                        <div class="border-t border-gray-200 px-4 py-4 sm:px-6">
                            <button type="button" class="view-details-btn w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50" data-order-id="${order.orderId}">
                                View Details
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            ordersHtml = '<p class="text-center text-gray-500 py-8">No orders match this filter. Add one to get started!</p>';
        }
        ordersListContainer.innerHTML = ordersHtml;
    }

    function renderPagination(totalRows) {
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        if (currentPage > totalPages) currentPage = totalPages || 1;
        paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += `<button class="pagination-btn rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;
            paginationHtml += `<span class="text-sm text-gray-700">Page ${currentPage} of ${totalPages}</span>`;
            paginationHtml += `<button class="pagination-btn rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
        }
        paginationContainer.innerHTML = paginationHtml;
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function renderCalendar() {
        const startOfWeek = getStartOfWeek(calendarDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });
        currentWeekDisplay.textContent = `${monthFormat.format(startOfWeek)} ${startOfWeek.getDate()} - ${monthFormat.format(endOfWeek)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
        const scheduledOrders = allOrders.filter(order => order.scheduledDate && new Date(order.scheduledDate) >= startOfWeek && new Date(order.scheduledDate) <= endOfWeek);
        const ordersByDay = {};
        for(let i=0; i<7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            ordersByDay[day.toISOString().split('T')[0]] = [];
        }
        scheduledOrders.forEach(order => {
            const dayString = new Date(order.scheduledDate).toISOString().split('T')[0];
            if(ordersByDay[dayString]) ordersByDay[dayString].push(order);
        });
        calendarGrid.innerHTML = '';
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        Object.keys(ordersByDay).forEach((dayString, index) => {
            const dayOrders = ordersByDay[dayString];
            const date = new Date(dayString);
            date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
            let ordersHtml = '<p class="text-xs text-gray-400">No deliveries</p>';
            if(dayOrders.length > 0) {
                ordersHtml = '<ul>' + dayOrders.map(o => `<li class="text-xs font-medium text-gray-700 truncate">#${o.orderId} - ${o.customer}</li>`).join('') + '</ul>';
            }
            const dayCell = `<div class="bg-gray-50 rounded-lg p-2 min-h-[100px]"><div class="text-center font-semibold text-sm">${dayNames[index]}</div><div class="text-center text-xs text-gray-500 mb-2">${date.getDate()}</div><div class="space-y-1">${ordersHtml}</div></div>`;
            calendarGrid.innerHTML += dayCell;
        });
    }

    // =================================================================
    // MODAL HANDLING
    // =================================================================
    function setModalMode(mode) {
        const contentContainer = document.getElementById('modal-content-container');
        if (mode === 'edit') {
            contentContainer.classList.remove('view-mode');
            contentContainer.classList.add('edit-mode');
        } else { // view
            contentContainer.classList.remove('view-mode');
            contentContainer.classList.add('edit-mode'); // Start in edit mode for simplicity now
        }
    }
    
    function setupModal(isNew, order = {}) {
        const modal = document.getElementById('order-modal');
        const titleEl = modal.querySelector('#modal-title');
        const contentContainer = document.getElementById('modal-content-container');

        currentOrderInModal = order;
        
        // This is now a single modal for both Add and Edit.
        // The logic to differentiate is in how we populate it and what buttons we show.
        populateEditView(order); 

        if (isNew) {
            titleEl.textContent = 'Add New Order';
            contentContainer.classList.add('edit-mode'); // Always start in edit mode for new orders
            document.getElementById('status-field-container').style.display = 'none';
        } else {
            titleEl.textContent = 'Order Details';
            contentContainer.classList.add('view-mode'); // Start in view mode for existing orders
            populateDisplayView(order);
            document.getElementById('status-field-container').style.display = 'block';
        }
        
        modal.classList.remove('hidden');
    }


    function populateDisplayView(order) {
        document.getElementById('display-order-id').textContent = order.orderId;
        document.getElementById('display-date-created').textContent = order.dateCreated ? new Date(order.dateCreated).toLocaleString() : 'N/A';
        document.getElementById('display-customer-name').textContent = order.customer;
        document.getElementById('display-customer-address').textContent = order.address;
        document.getElementById('display-schedule-date').textContent = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Scheduled';
        document.getElementById('display-status').innerHTML = `<span class="status-badge status-${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span>`;
        
        let itemsHtml = '<ul>';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => { itemsHtml += `<li><span>${item.item}</span><span><strong>${item.quantity}</strong></span></li>`; });
        } else {
             itemsHtml += '<li>No items found.</li>';
        }
        itemsHtml += '</ul>';
        document.getElementById('display-items-list').innerHTML = itemsHtml;
    }

    function populateEditView(order) {
        document.getElementById('customer-name').value = order.customer || '';
        document.getElementById('customer-address').value = order.address || '';
        document.getElementById('schedule-date').value = order.scheduledDate ? new Date(order.scheduledDate).toISOString().split('T')[0] : '';
        document.getElementById('status').value = order.status || 'PENDING';
        
        const itemsContainer = document.getElementById('items-container');
        itemsContainer.innerHTML = '';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => addEditableItemRow(item.item, item.quantity));
        } else {
            addEditableItemRow('', '');
        }
    }
    
    function addEditableItemRow(name = '', qty = '') {
        const itemsContainer = document.getElementById('items-container');
        const itemRow = document.createElement('div');
        itemRow.className = 'flex items-center space-x-2';
        itemRow.innerHTML = `<input type="text" placeholder="Item Name" value="${name}" class="item-name-input block w-full rounded-md border-0 py-1.5 ring-1 ring-inset ring-gray-300"><input type="number" placeholder="Qty" value="${qty}" class="item-qty-input block w-1/4 rounded-md border-0 py-1.5 ring-1 ring-inset ring-gray-300"><button type="button" class="remove-item-btn rounded-full p-1 text-gray-400 hover:text-gray-500">&times;</button>`;
        itemsContainer.appendChild(itemRow);
    }
    
    function closeModal() {
        const modal = document.getElementById('order-modal');
        modal.classList.add('hidden');
    }

    // =================================================================
    // FIRESTORE ACTIONS
    // =================================================================
    async function fetchData() {
        showSpinner();
        try {
            const snapshot = await ordersCollection.orderBy("orderId", "desc").get();
            allOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            render();
        } catch (error) {
            console.error("Error fetching data: ", error);
            alert("Could not fetch data. Check console and Firebase config.");
        } finally {
            hideSpinner();
        }
    }

    async function handleSave(isNew) {
        const orderData = getOrderDataFromModal(isNew);
        showSpinner('Saving...');
        try {
            if (isNew) {
                orderData.orderId = allOrders.length > 0 ? Math.max(...allOrders.map(o => o.orderId)) + 1 : 1;
                orderData.dateCreated = new Date().toISOString();
                orderData.status = orderData.scheduledDate ? 'SCHEDULED' : 'PENDING';
                await ordersCollection.doc(String(orderData.orderId)).set(orderData);
            } else {
                orderData.orderId = currentOrderInModal.orderId;
                await ordersCollection.doc(currentOrderInModal.docId).update(orderData);
            }
            await fetchData(); 
            closeModal();
        } catch (error) {
            console.error("Error saving data: ", error);
            alert("Could not save the order.");
        } finally {
            hideSpinner();
        }
    }

    async function handleDelete() {
        showSpinner('Deleting...');
        try {
            await ordersCollection.doc(currentOrderInModal.docId).delete();
            confirmDeleteModal.classList.add('hidden');
            await fetchData();
            closeModal();
        } catch(error) {
            console.error("Error deleting document: ", error);
            alert("Could not delete the order.");
        } finally {
            hideSpinner();
        }
    }
    
    // =================================================================
    // EVENT LISTENERS
    // =================================================================
    addNewOrderBtn.addEventListener('click', () => {
        const modal = document.getElementById('order-modal');
        const titleEl = modal.querySelector('#modal-title');
        const contentContainer = document.getElementById('modal-content-container');
        
        currentOrderInModal = {}; // Reset for new order
        titleEl.textContent = 'Add New Order';
        contentContainer.classList.remove('view-mode');
        contentContainer.classList.add('edit-mode');
        populateEditView({}); // Populate with empty fields
        
        const footer = modal.querySelector('#modal-footer');
        footer.innerHTML = `
            <button type="button" class="modal-cancel w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button>
            <button id="save-new-order-btn" type="button" class="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto">Create Order</button>
        `;
        modal.classList.remove('hidden');
    });

    ordersListContainer.addEventListener('click', e => {
        const detailsButton = e.target.closest('.view-details-btn');
        if (detailsButton) {
            const orderId = detailsButton.dataset.orderId;
            const order = allOrders.find(d => d.orderId == orderId);
            if (order) setupModal(false, order);
        }
    });

    orderModal.addEventListener('click', e => {
        const target = e.target;
        if (target.closest('.modal-cancel')) { closeModal(); }
        if (target.closest('#add-item-btn')) { addEditableItemRow('edit'); }
        if (target.closest('.remove-item-btn')) { target.closest('.flex').remove(); }
        if (target.closest('#edit-order-btn')) { setModalMode('edit'); }
        if (target.closest('#save-changes-btn')) { handleSave(false); }
        if (target.closest('#save-new-order-btn')) { handleSave(true); }
        if (target.closest('#delete-order-btn')) {
            confirmDeleteModal.querySelector('#confirm-delete-message').textContent = `Are you sure you want to delete order #${currentOrderInModal.orderId}?`;
            confirmDeleteModal.classList.remove('hidden');
        }
    });
    
    confirmDeleteModal.addEventListener('click', e => {
        if (e.target.closest('#cancel-delete-btn')) { confirmDeleteModal.classList.add('hidden'); }
        if (e.target.closest('#confirm-delete-btn')) { handleDelete(); }
    });

    filterContainer.addEventListener('click', e => {
        const filterBtn = e.target.closest('.filter-btn');
        if(filterBtn) {
            filterContainer.querySelector('.bg-gray-800').classList.remove('bg-gray-800', 'text-white');
            filterBtn.classList.add('bg-gray-800', 'text-white');
            currentFilter = filterBtn.dataset.filter;
            currentPage = 1;
            render();
        }
    });

    paginationContainer.addEventListener('click', e => {
        const pageBtn = e.target.closest('.pagination-btn');
        if (pageBtn && !pageBtn.disabled) {
            const page = pageBtn.dataset.page;
            if (page === 'prev') { currentPage--; }
            else if (page === 'next') { currentPage++; }
            else { currentPage = parseInt(page); }
            render();
        }
    });

    prevWeekBtn.addEventListener('click', () => { calendarDate.setDate(calendarDate.getDate() - 7); renderCalendar(); });
    nextWeekBtn.addEventListener('click', () => { calendarDate.setDate(calendarDate.getDate() + 7); renderCalendar(); });

    function getOrderDataFromModal(isNew) {
        const modal = document.getElementById('order-modal');
        const data = {
            customer: modal.querySelector('#customer-name').value,
            address: modal.querySelector('#customer-address').value,
            items: [],
            scheduledDate: modal.querySelector('#schedule-date').value || null,
        };
        if (!isNew) {
            data.status = modal.querySelector('#status').value;
        }
        modal.querySelector('#items-container').querySelectorAll('.flex').forEach(row => {
            const name = row.querySelector('.item-name-input').value.trim();
            const qty = row.querySelector('.item-qty-input').value.trim();
            if (name && qty) { data.items.push({ item: name, quantity: parseInt(qty, 10) }); }
        });
        return data;
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchData(); 
});

