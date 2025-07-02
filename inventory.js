document.addEventListener('navigationLoaded', () => {
    console.log("Inventory page 'navigationLoaded' event received. Initializing script.");

    // =================================================================
    // FIREBASE CONFIGURATION
    // =================================================================
    const firebaseConfig = {
        apiKey: "AIzaSyCjKJmXAJ0C8v1To1tFaAyucfo8YRFTjcw",
        authDomain: "capso-dashboard-pwa.firebaseapp.com",
        projectId: "capso-dashboard-pwa",
        storageBucket: "capso-dashboard-pwa.appspot.com",
        messagingSenderId: "389493283794",
        appId: "1:389493283794:web:04af6938d8d8683271860b"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const inventoryCollection = db.collection("inventory");

    // =================================================================
    // SELECTORS
    // =================================================================
    const inventoryTableBody = document.getElementById('inventory-body');
    const searchInput = document.getElementById('searchInput');
    const quoteBody = document.getElementById('quote-body');
    const grandTotalSpan = document.getElementById('grand-total');
    const clearQuoteBtn = document.getElementById('clear-quote-btn');
    // --- Selectors for the quantity modal ---
    const quantityModal = document.getElementById('quantity-modal');
    const quantityModalTitle = document.getElementById('quantity-modal-title');
    const quantityInput = document.getElementById('quantity-input');
    const confirmQuantityBtn = document.getElementById('confirm-quantity-btn');
    const cancelQuantityBtn = document.getElementById('cancel-quantity-btn');

    // =================================================================
    // STATE
    // =================================================================
    let allInventory = [];
    let quoteItems = [];
    let currentItemForQuote = null; // Temporarily store the item being added

    // =================================================================
    // FUNCTIONS
    // =================================================================

    function renderInventory(items) {
        if (!inventoryTableBody) return;
        if (items.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">No inventory items found.</td></tr>`;
            return;
        }
        inventoryTableBody.innerHTML = items.map(item => {
            const itemName = item.itemName || 'Unnamed Item';
            const category = item.category || 'N/A';
            const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            const stockStatus = item.stockStatus || 'Unknown';
            let statusColorClass = 'text-gray-600 bg-gray-100';
            if (stockStatus === 'In Stock') statusColorClass = 'text-green-800 bg-green-100';
            if (stockStatus === 'Low Stock') statusColorClass = 'text-yellow-800 bg-yellow-100';
            if (stockStatus === 'Out of Stock') statusColorClass = 'text-red-800 bg-red-100';
            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${itemName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${category}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱${unitPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass}">${stockStatus}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="add-to-quote-btn text-indigo-600 hover:text-indigo-900" data-id="${item.id}">Add to Quote</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderQuote() {
        if (!quoteBody || !grandTotalSpan) return;
        if (quoteItems.length === 0) {
            quoteBody.innerHTML = `<p class="text-sm text-gray-500 text-center py-8">No items added yet.</p>`;
            grandTotalSpan.textContent = '0.00';
            return;
        }
        quoteBody.innerHTML = quoteItems.map(item => {
            const itemTotal = item.quantity * item.unitPrice;
            const formattedItemTotal = itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `
                <div class="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                    <div class="flex-grow pr-2">
                        <p class="font-medium text-gray-800">${item.itemName}</p>
                        <p class="text-gray-500">Qty: ${item.quantity}</p>
                    </div>
                    <p class="font-semibold text-gray-900">₱${formattedItemTotal}</p>
                </div>
            `;
        }).join('');
        const grandTotal = quoteItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
        grandTotalSpan.textContent = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function fetchInventory() {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">Loading inventory...</td></tr>`;
        try {
            const snapshot = await inventoryCollection.get();
            allInventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderInventory(allInventory);
        } catch (error) {
            console.error("Error fetching inventory: ", error);
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading inventory.</td></tr>`;
        }
    }

    // --- Modal Functions ---
    function openQuantityModal(item) {
        currentItemForQuote = item;
        quantityModalTitle.textContent = `Enter quantity for ${item.itemName}`;
        quantityInput.value = '1';
        quantityModal.classList.remove('hidden');
        quantityInput.focus();
        quantityInput.select();
    }

    function closeQuantityModal() {
        currentItemForQuote = null;
        quantityModal.classList.add('hidden');
    }

    function handleConfirmQuantity() {
        const quantity = parseInt(quantityInput.value, 10);
        if (currentItemForQuote && !isNaN(quantity) && quantity > 0) {
            const existingQuoteItem = quoteItems.find(item => item.id === currentItemForQuote.id);
            if (existingQuoteItem) {
                existingQuoteItem.quantity += quantity;
            } else {
                quoteItems.push({ ...currentItemForQuote, quantity: quantity });
            }
            renderQuote();
            closeQuantityModal();
        } else {
            alert("Please enter a valid quantity.");
        }
    }

    // =================================================================
    // EVENT HANDLERS
    // =================================================================

    if (inventoryTableBody) {
        inventoryTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-quote-btn')) {
                const itemId = e.target.dataset.id;
                const itemToAdd = allInventory.find(item => item.id === itemId);
                if (itemToAdd) {
                    openQuantityModal(itemToAdd);
                }
            }
        });
    }

    if (clearQuoteBtn) {
        clearQuoteBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the entire quote?")) {
                quoteItems = [];
                renderQuote();
            }
        });
    }

    // --- Modal Event Handlers ---
    if (confirmQuantityBtn) {
        confirmQuantityBtn.addEventListener('click', handleConfirmQuantity);
    }
    
    if (cancelQuantityBtn) {
        cancelQuantityBtn.addEventListener('click', closeQuantityModal);
    }
    
    if (quantityInput) {
        quantityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleConfirmQuantity();
            }
        });
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchInventory();
    renderQuote();

});
