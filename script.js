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
        renderTableAndPagination();
        renderCalendar();
    }
    
    function renderTableAndPagination() {
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
        
        const scheduledOrders = allOrders.filter(order => {
            if (!order.scheduledDate) return false;
            const scheduled = new Date(order.scheduledDate);
            return scheduled >= startOfWeek && scheduled <= endOfWeek;
        });

        const ordersByDay = {};
        for(let i=0; i<7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            ordersByDay[day.toISOString().split('T')[0]] = [];
        }

        scheduledOrders.forEach(order => {
            const dayString = new Date(order.scheduledDate).toISOString().split('T')[0];
            if(ordersByDay[dayString]) {
                ordersByDay[dayString].push(order);
            }
        });

        calendarGrid.innerHTML = '';
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        Object.keys(ordersByDay).forEach((dayString, index) => {
            const dayOrders = ordersByDay[dayString];
            const date = new Date(dayString);
            date.setMinutes(date.getMinutes() + date.getTimezoneOffset()); // Adjust for display
            
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
    function setupModalFor(type, order = {}) {
        currentOrderInModal = order;
        const modalTitle = orderModal.querySelector('#modal-title');
        const customerNameInput = orderModal.querySelector('#customer-name');
        const customerAddressInput = orderModal.querySelector('#customer-address');
        const itemsContainer = orderModal.querySelector('#items-container');
        const schedulingFields = orderModal.querySelector('#scheduling-fields');
        const statusFieldContainer = orderModal.querySelector('#status-field-container');
        const footer = orderModal.querySelector('#modal-footer');
        
        itemsContainer.innerHTML = '';
        
        if (type === 'new') {
            modalTitle.textContent = 'Add New Order';
            customerNameInput.value = '';
            customerAddressInput.value = '';
            schedulingFields.style.display = 'block';
            orderModal.querySelector('#schedule-date').value = '';
            statusFieldContainer.style.display = 'none'; // Hide status for new orders
            addEditableItemRow('', '');
            footer.innerHTML = `<button type="button" class="modal-cancel w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button><button id="save-new-order-btn" type="button" class="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto">Create Order</button>`;
        } else { // 'edit'
            modalTitle.textContent = `Edit Order #${order.orderId}`;
            customerNameInput.value = order.customer;
            customerAddressInput.value = order.address;
            schedulingFields.style.display = 'block';
            statusFieldContainer.style.display = 'block'; // Show status for editing
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => addEditableItemRow(item.item, item.quantity));
            } else { addEditableItemRow('', ''); }
            orderModal.querySelector('#schedule-date').value = order.scheduledDate ? new Date(order.scheduledDate).toISOString().split('T')[0] : '';
            orderModal.querySelector('#status').value = order.status;
            footer.innerHTML = `<button id="delete-order-btn" type="button" class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Delete</button><div class="flex-grow"></div><button type="button" class="modal-cancel rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button><button id="save-changes-btn" type="button" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Save Changes</button>`;
        }
        orderModal.classList.remove('hidden');
    }
    
    function addEditableItemRow(name = '', qty = '') {
        const itemsContainer = orderModal.querySelector('#items-container');
        const itemRow = document.createElement('div');
        itemRow.className = 'flex items-center space-x-2';
        itemRow.innerHTML = `<input type="text" placeholder="Item Name" value="${name}" class="item-name-input block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm"><input type="number" placeholder="Qty" value="${qty}" class="item-qty-input block w-1/4 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm"><button type="button" class="remove-item-btn rounded-full p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100">&times;</button>`;
        itemsContainer.appendChild(itemRow);
    }
    
    function closeModal() { orderModal.classList.add('hidden'); }

    // =================================================================
    // FIRESTORE ACTIONS
    // =================================================================

    function getNextOrderId() {
        if (allOrders.length === 0) return 1;
        const maxId = Math.max(...allOrders.map(o => o.orderId));
        return maxId + 1;
    }

    async function fetchData() {
        showSpinner();
        try {
            const snapshot = await ordersCollection.orderBy("orderId", "desc").get();
            allOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            render();
        } catch (error) {
            console.error("Error fetching data: ", error);
            alert("Could not fetch data from the database. Check console for errors and ensure your firebaseConfig is correct.");
        } finally {
            hideSpinner();
        }
    }

    async function handleSave(type) {
        const orderData = getOrderDataFromModal(type);
        showSpinner('Saving...');
        try {
            if (type === 'new') {
                orderData.orderId = getNextOrderId();
                orderData.dateCreated = new Date().toISOString();
                // [NEW LOGIC] Set status based on whether a schedule date was provided
                orderData.status = orderData.scheduledDate ? 'SCHEDULED' : 'PENDING';
                await ordersCollection.doc(String(orderData.orderId)).set(orderData);
            } else {
                await ordersCollection.doc(String(orderData.orderId)).update(orderData);
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
            await ordersCollection.doc(String(currentOrderInModal.orderId)).delete();
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
    addNewOrderBtn.addEventListener('click', () => setupModalFor('new'));
    ordersListContainer.addEventListener('click', e => {
        const detailsButton = e.target.closest('.view-details-btn');
        if (detailsButton) {
            const orderId = detailsButton.dataset.orderId;
            const order = allOrders.find(d => d.orderId == orderId);
            if (order) setupModalFor('edit', order);
        }
    });
    orderModal.addEventListener('click', e => {
        if (e.target.closest('.modal-cancel')) { closeModal(); }
        if (e.target.closest('#add-item-btn')) { addEditableItemRow('', ''); }
        if (e.target.closest('.remove-item-btn')) { e.target.closest('.flex').remove(); }
        if (e.target.closest('#save-new-order-btn')) { handleSave('new'); }
        if (e.target.closest('#save-changes-btn')) { handleSave('edit'); }
        if (e.target.closest('#delete-order-btn')) {
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
    prevWeekBtn.addEventListener('click', () => {
        calendarDate.setDate(calendarDate.getDate() - 7);
        renderCalendar();
    });
    nextWeekBtn.addEventListener('click', () => {
        calendarDate.setDate(calendarDate.getDate() + 7);
        renderCalendar();
    });

    function getOrderDataFromModal(type = 'new') {
        const data = {
            customer: orderModal.querySelector('#customer-name').value,
            address: orderModal.querySelector('#customer-address').value,
            items: [],
            scheduledDate: orderModal.querySelector('#schedule-date').value || null, // Get schedule date for new orders too
        };
        orderModal.querySelectorAll('#items-container .flex').forEach(row => {
            const name = row.querySelector('.item-name-input').value.trim();
            const qty = row.querySelector('.item-qty-input').value.trim();
            if (name && qty) { data.items.push({ item: name, quantity: parseInt(qty, 10) }); }
        });
        if (type === 'edit') {
            data.orderId = currentOrderInModal.orderId;
            data.status = orderModal.querySelector('#status').value;
        }
        return data;
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchData(); 
});
