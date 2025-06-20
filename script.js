document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // CONFIGURATION
    // =================================================================
    const GAS_URL = "https://script.google.com/macros/s/AKfycby706vdNUYknsHRyXGkWkGG36MnmLxMHHZ4294n5HPI4Q20XFoG2N-e6axoM06UiCv1CA/exec"; // Replace with your actual deployed Apps Script URL

    // =================================================================
    // STATE MANAGEMENT
    // =================================================================
    let allOrders = [];
    let currentFilter = 'All';
    let currentPage = 1;
    const rowsPerPage = 10;
    let currentOrderInModal = null;

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

    // =================================================================
    // RENDERING FUNCTIONS
    // =================================================================

    function showSpinner() {
        loadingSpinner.classList.remove('hidden');
    }

    function hideSpinner() {
        loadingSpinner.classList.add('hidden');
    }

    function render() {
        showSpinner();
        const filtered = allOrders.filter(order => {
            if (currentFilter === 'All') return true;
            if (currentFilter === 'Active') return ['PENDING', 'SCHEDULED', 'OUT FOR DELIVERY'].includes(order.status);
            return order.status === currentFilter;
        }).sort((a, b) => b.orderId - a.orderId);

        renderPagination(filtered.length);

        const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
        
        let ordersHtml = '';
        if (paginated.length > 0) {
            paginated.forEach(order => {
                const scheduled = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not Scheduled';
                ordersHtml += `
                    <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
                        <div class="px-4 py-5 sm:px-6">
                            <div class="flex items-center justify-between">
                                <h3 class="text-base font-semibold leading-6 text-gray-900">${order.customer}</h3>
                                <div class="status-badge status-${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</div>
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
            ordersHtml = '<p class="text-center text-gray-500 py-8">No orders match this filter.</p>';
        }
        ordersListContainer.innerHTML = ordersHtml;
        hideSpinner();
    }

    function renderPagination(totalRows) {
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        if (currentPage > totalPages) currentPage = totalPages || 1;

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += `<button class="pagination-btn rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;
            paginationHtml += `<span class="text-sm text-gray-700">Page ${currentPage} of ${totalPages}</span>`;
            paginationHtml += `<button class="pagination-btn rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
        }
        paginationContainer.innerHTML = paginationHtml;
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
        const editingFields = orderModal.querySelector('#editing-fields');
        const footer = orderModal.querySelector('#modal-footer');
        
        itemsContainer.innerHTML = '';
        
        if (type === 'new') {
            modalTitle.textContent = 'Add New Order';
            customerNameInput.value = '';
            customerAddressInput.value = '';
            editingFields.style.display = 'none';
            addEditableItemRow('', '');
            footer.innerHTML = `
                <button type="button" class="modal-cancel w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button>
                <button id="save-new-order-btn" type="button" class="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto">Create Order</button>
            `;
        } else { // 'edit'
            modalTitle.textContent = `Edit Order #${order.orderId}`;
            customerNameInput.value = order.customer;
            customerAddressInput.value = order.address;
            editingFields.style.display = 'block';

            if (order.items && order.items.length > 0) {
                order.items.forEach(item => addEditableItemRow(item.item, item.quantity));
            } else {
                addEditableItemRow('', '');
            }

            orderModal.querySelector('#schedule-date').value = order.scheduledDate ? new Date(order.scheduledDate).toISOString().split('T')[0] : '';
            orderModal.querySelector('#time-slot').value = order.timeSlot || '';
            orderModal.querySelector('#status').value = order.status;

            footer.innerHTML = `
                <button id="delete-order-btn" type="button" class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Delete</button>
                <div class="flex-grow"></div>
                <button type="button" class="modal-cancel rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
                <button id="save-changes-btn" type="button" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Save Changes</button>
            `;
        }
        orderModal.classList.remove('hidden');
    }
    
    function addEditableItemRow(name = '', qty = '') {
        const itemsContainer = orderModal.querySelector('#items-container');
        const itemRow = document.createElement('div');
        itemRow.className = 'flex items-center space-x-2';
        itemRow.innerHTML = `
            <input type="text" placeholder="Item Name" value="${name}" class="item-name-input block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm">
            <input type="number" placeholder="Qty" value="${qty}" class="item-qty-input block w-1/4 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm">
            <button type="button" class="remove-item-btn rounded-full p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100">&times;</button>
        `;
        itemsContainer.appendChild(itemRow);
    }
    
    function closeModal() { orderModal.classList.add('hidden'); }

    // =================================================================
    // SERVER COMMUNICATION (API CALLS)
    // =================================================================

    async function fetchData() {
        showSpinner();
        try {
            const response = await fetch(`${GAS_URL}?action=getOrders`);
            const result = await response.json();
            if (result.success) {
                allOrders = result.data;
                render();
            } else {
                alert('Error fetching orders: ' + result.message);
            }
        } catch (error) {
            alert('A critical error occurred while fetching data.');
            console.error(error);
        } finally {
            hideSpinner();
        }
    }

    async function postData(action, data) {
        showSpinner();
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Required for Apps Script POST
                body: JSON.stringify({ action, data })
            });
            return await response.json();
        } catch (error) {
            alert(`A critical error occurred while performing action: ${action}.`);
            console.error(error);
            return { success: false };
        } finally {
            hideSpinner();
        }
    }

    // =================================================================
    // EVENT LISTENERS
    // =================================================================

    addNewOrderBtn.addEventListener('click', () => setupModalFor('new'));

    ordersListContainer.addEventListener('click', e => {
        if (e.target.closest('.view-details-btn')) {
            const orderId = e.target.closest('.view-details-btn').dataset.orderId;
            const order = allOrders.find(d => d.orderId == orderId);
            if (order) setupModalFor('edit', order);
        }
    });

    orderModal.addEventListener('click', async e => {
        if (e.target.classList.contains('modal-cancel')) { closeModal(); }
        if (e.target.closest('#add-item-btn')) { addEditableItemRow('', ''); }
        if (e.target.closest('.remove-item-btn')) { e.target.closest('.flex').remove(); }
        
        if (e.target.closest('#save-new-order-btn')) {
            const orderData = getOrderDataFromModal();
            const result = await postData('addNewOrder', orderData);
            if (result.success) {
                allOrders.push(result.newOrder);
                render();
                closeModal();
            } else { alert('Failed to add order.'); }
        }
        
        if (e.target.closest('#save-changes-btn')) {
            const orderData = getOrderDataFromModal('edit');
            const result = await postData('updateOrder', orderData);
            if (result.success) {
                const index = allOrders.findIndex(o => o.orderId == result.updatedOrder.orderId);
                if (index !== -1) allOrders[index] = result.updatedOrder;
                render();
                closeModal();
            } else { alert('Failed to update order.'); }
        }
        
        if (e.target.closest('#delete-order-btn')) {
            confirmDeleteModal.querySelector('#confirm-delete-message').textContent = `Are you sure you want to delete order #${currentOrderInModal.orderId}? This cannot be undone.`;
            confirmDeleteModal.classList.remove('hidden');
        }
    });
    
    confirmDeleteModal.addEventListener('click', async e => {
        if (e.target.closest('#cancel-delete-btn')) { confirmDeleteModal.classList.add('hidden'); }
        if (e.target.closest('#confirm-delete-btn')) {
            const result = await postData('deleteOrder', { orderId: currentOrderInModal.orderId });
            if (result.success) {
                allOrders = allOrders.filter(o => o.orderId != result.deletedOrderId);
                render();
                closeModal();
                confirmDeleteModal.classList.add('hidden');
            } else { alert('Failed to delete order.'); }
        }
    });

    filterContainer.addEventListener('click', e => {
        if(e.target.classList.contains('filter-btn')) {
            filterContainer.querySelector('.bg-gray-800').classList.remove('bg-gray-800', 'text-white');
            e.target.classList.add('bg-gray-800', 'text-white');
            currentFilter = e.target.dataset.filter;
            currentPage = 1;
            render();
        }
    });
    
    paginationContainer.addEventListener('click', e => {
        if (e.target.closest('.pagination-btn')) {
            const page = e.target.closest('.pagination-btn').dataset.page;
            if (page === 'prev') { currentPage--; }
            else if (page === 'next') { currentPage++; }
            render();
        }
    });
    
    function getOrderDataFromModal(type = 'new') {
        const data = {
            customerName: orderModal.querySelector('#customer-name').value,
            address: orderModal.querySelector('#customer-address').value,
            items: [],
        };
        orderModal.querySelectorAll('#items-container .flex').forEach(row => {
            const name = row.querySelector('.item-name-input').value.trim();
            const qty = row.querySelector('.item-qty-input').value.trim();
            if (name && qty) { data.items.push({ item: name, quantity: parseInt(qty, 10) }); }
        });

        if (type === 'edit') {
            data.orderId = currentOrderInModal.orderId;
            data.scheduledDate = orderModal.querySelector('#schedule-date').value;
            data.timeSlot = orderModal.querySelector('#time-slot').value;
            data.status = orderModal.querySelector('#status').value;
        }
        return data;
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchData(); 
});
</script>
