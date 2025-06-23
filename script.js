document.addEventListener('DOMContentLoaded', () => {
  // =================================================================
  // FIREBASE CONFIGURATION
  // =================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyCjKJmXAJ0C8v1To1tFaAyucfo8YRFTjcw",
    authDomain: "capso-dashboard-pwa.firebaseapp.com",
    projectId: "capso-dashboard-pwa",
    storageBucket: "capso-dashboard-pwa.appspot.com", // ✅ Fixed .app to .appspot.com
    messagingSenderId: "389493283794",
    appId: "1:389493283794:web:04af6938d8d8683271860b"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const ordersCollection = db.collection("orders");

  // =================================================================
  // STATE
  // =================================================================
  let allOrders = [];
  let currentFilter = 'All';
  let currentPage = 1;
  const rowsPerPage = 10;
  let currentOrderInModal = null;
  let calendarDate = new Date();

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
  const loadingSpinner = document.getElementById('loading-spinner');
  const calendarGrid = document.getElementById('calendar-grid');
  const currentWeekDisplay = document.getElementById('current-week-display');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  // =================================================================
  // UI HELPERS
  // =================================================================
  function showSpinner(msg = 'Loading orders...') {
    loadingSpinner.querySelector('p').textContent = msg;
    loadingSpinner.classList.remove('hidden');
  }

  function hideSpinner() {
    loadingSpinner.classList.add('hidden');
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
    showSpinner();
    try {
      const snapshot = await ordersCollection.orderBy('orderId', 'desc').get();
      allOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      render();
    } catch (e) {
      console.error(e);
      alert('Error loading data.');
    } finally {
      hideSpinner();
    }
  }

  async function handleSave(isNew) {
    const data = getOrderDataFromModal(isNew);
    showSpinner('Saving...');
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
      console.error(err);
      alert('Failed to save.');
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
    } catch (err) {
      console.error(err);
      alert('Delete failed.');
    } finally {
      hideSpinner();
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

    const sorted = filtered.sort((a, b) => (b.orderId || 0) - (a.orderId || 0));
    const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    ordersListContainer.innerHTML = paginated.map(order => {
      const statusClass = `status-${order.status.toLowerCase().replace(/ /g, '-')}`;
      return `
        <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
          <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 class="text-base font-semibold">${order.customer || 'N/A'}</h3>
            <div class="status-badge ${statusClass}">${order.status || 'N/A'}</div>
          </div>
          <div class="border-t px-4 py-4">
            <button class="view-details-btn w-full rounded-md bg-white px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 hover:bg-gray-50" data-order-id="${order.orderId}">
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
      const list = ordersToday.length ? ordersToday.map(o => `<li class="text-xs">${o.orderId} - ${o.customer}</li>`).join('') : '<p class="text-xs text-gray-400">No deliveries</p>';
      return `<div class="bg-gray-50 p-2 rounded-lg min-h-[100px] text-center">
        <div class="text-sm font-semibold">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div class="text-xs text-gray-500 mb-2">${day.getDate()}</div>
        ${ordersToday.length ? `<ul>${list}</ul>` : list}
      </div>`;
    }).join('');
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
    filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-gray-800', 'text-white'));
    btn.classList.add('bg-gray-800', 'text-white');
    currentFilter = btn.dataset.filter;
    render();
  });

  paginationContainer.addEventListener('click', e => {
    const btn = e.target.closest('.pagination-btn');
    if (!btn || btn.disabled) return;
    const page = btn.dataset.page;
    if (page === 'next') currentPage++;
    else if (page === 'prev') currentPage--;
    render();
  });

  prevWeekBtn.addEventListener('click', () => {
    calendarDate.setDate(calendarDate.getDate() - 7);
    renderCalendar();
  });

  nextWeekBtn.addEventListener('click', () => {
    calendarDate.setDate(calendarDate.getDate() + 7);
    renderCalendar();
  });

  // =================================================================
  // INIT
  // =================================================================
  fetchData();
});
