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
    const copyQuoteBtn = document.getElementById('copy-quote-btn');
    // --- Quantity Modal ---
    const quantityModal = document.getElementById('quantity-modal');
    const quantityModalTitle = document.getElementById('quantity-modal-title');
    const quantityInput = document.getElementById('quantity-input');
    const confirmQuantityBtn = document.getElementById('confirm-quantity-btn');
    const cancelQuantityBtn = document.getElementById('cancel-quantity-btn');
    // --- Clear Confirmation Modal ---
    const confirmClearModal = document.getElementById('confirm-clear-modal');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');

    // =================================================================
    // STATE
    // =================================================================
    let allInventory = [];
    let quoteItems = [];
    let currentItemForQuote = null;
    let editingQuoteItemId = null; // To track which quote item is being edited

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
            // If the current item is being edited, show input fields
            if (item.id === editingQuoteItemId) {
                return `
                    <div class="p-2 border border-indigo-500 rounded-lg bg-indigo-50">
                        <p class="font-medium text-gray-800 mb-2">${item.itemName}</p>
                        <div class="flex items-center gap-2">
                            <input type="number" value="${item.quantity}" class="edit-quantity-input w-1/3 p-1 border rounded-md">
                            <span class="text-gray-500">× ₱</span>
                            <input type="number" step="0.01" value="${item.quotePrice.toFixed(2)}" class="edit-price-input w-2/3 p-1 border rounded-md">
                        </div>
                        <div class="flex justify-end gap-2 mt-2">
                            <button class="save-quote-item-btn text-sm text-indigo-600" data-id="${item.id}">Save</button>
                            <button class="cancel-edit-quote-btn text-sm text-gray-500" data-id="${item.id}">Cancel</button>
                        </div>
                    </div>
                `;
            }
            // Otherwise, show the normal display
            const itemTotal = item.quantity * item.quotePrice;
            const formattedItemTotal = itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `
                <div class="flex justify-between items-center text-sm py-2 border-b border-gray-100 group">
                    <div class="flex-grow pr-2">
                        <p class="font-medium text-gray-800">${item.itemName}</p>
                        <p class="text-gray-500">Qty: ${item.quantity} @ ₱${item.quotePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div class="flex items-center">
                        <p class="font-semibold text-gray-900 mr-4">₱${formattedItemTotal}</p>
                        <button class="edit-quote-item-btn text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mr-2" data-id="${item.id}">✏️</button>
                        <button class="remove-quote-item-btn text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-id="${item.id}">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        const grandTotal = quoteItems.reduce((total, item) => total + (item.quantity * item.quotePrice), 0);
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
                // Add a 'quotePrice' for temporary edits
                const newItem = { ...currentItemForQuote, quantity: quantity, quotePrice: currentItemForQuote.unitPrice };
                quoteItems.push(newItem);
            }
            renderQuote();
            closeQuantityModal();
        } else {
            alert("Please enter a valid quantity.");
        }
    }

    function handleCopyQuote() {
        if (quoteItems.length === 0) {
            alert("Quotation is empty. Add items to copy.");
            return;
        }
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const generatedDate = new Date().toLocaleDateString('en-US', dateOptions);
        let quoteText = "🧾 CAPSo Hardware Quotation\n";
        quoteText += `📅 Generated on: ${generatedDate}\n`;
        quoteText += "-----------------------------------------------\n";
        quoteItems.forEach(item => {
            const itemTotal = item.quantity * item.quotePrice;
            const formattedPrice = item.quotePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedTotal = itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            quoteText += `${item.itemName}\n`;
            quoteText += `\u2003${item.quantity} × ₱${formattedPrice}\u2003\u2003= ₱${formattedTotal}\n\n`;
        });
        const grandTotal = quoteItems.reduce((total, item) => total + (item.quantity * item.quotePrice), 0);
        const formattedGrandTotal = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        quoteText += "-----------------------------------------------\n";
        quoteText += `GRAND TOTAL: ₱${formattedGrandTotal}`;
        const textarea = document.createElement('textarea');
        textarea.value = quoteText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const originalText = copyQuoteBtn.textContent;
        copyQuoteBtn.textContent = 'Copied!';
        copyQuoteBtn.classList.add('bg-green-600', 'hover:bg-green-500');
        copyQuoteBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
        setTimeout(() => {
            copyQuoteBtn.textContent = originalText;
            copyQuoteBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
            copyQuoteBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
        }, 2000);
    }

    // =================================================================
    // EVENT HANDLERS
    // =================================================================

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredInventory = allInventory.filter(item => 
                item.itemName.toLowerCase().includes(searchTerm)
            );
            renderInventory(filteredInventory);
        });
    }

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
            if (quoteItems.length > 0) {
                confirmClearModal.classList.remove('hidden');
            }
        });
    }

    if (copyQuoteBtn) {
        copyQuoteBtn.addEventListener('click', handleCopyQuote);
    }
    
    if (quoteBody) {
        quoteBody.addEventListener('click', e => {
            const target = e.target;
            const id = target.dataset.id;

            if (target.classList.contains('remove-quote-item-btn')) {
                quoteItems = quoteItems.filter(item => item.id !== id);
                renderQuote();
            }
            if (target.classList.contains('edit-quote-item-btn')) {
                editingQuoteItemId = id;
                renderQuote();
            }
            if (target.classList.contains('cancel-edit-quote-btn')) {
                editingQuoteItemId = null;
                renderQuote();
            }
            if (target.classList.contains('save-quote-item-btn')) {
                const itemToSave = quoteItems.find(item => item.id === id);
                const container = target.closest('.p-2');
                const newQuantity = parseInt(container.querySelector('.edit-quantity-input').value, 10);
                const newPrice = parseFloat(container.querySelector('.edit-price-input').value);

                if (itemToSave && !isNaN(newQuantity) && newQuantity > 0 && !isNaN(newPrice)) {
                    itemToSave.quantity = newQuantity;
                    itemToSave.quotePrice = newPrice;
                    editingQuoteItemId = null;
                    renderQuote();
                } else {
                    alert("Please enter a valid quantity and price.");
                }
            }
        });
    }

    // --- Modal Event Handlers ---
    if (confirmQuantityBtn) confirmQuantityBtn.addEventListener('click', handleConfirmQuantity);
    if (cancelQuantityBtn) cancelQuantityBtn.addEventListener('click', closeQuantityModal);
    if (quantityInput) quantityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConfirmQuantity();
    });

    if (confirmClearBtn) {
        confirmClearBtn.addEventListener('click', () => {
            quoteItems = [];
            renderQuote();
            confirmClearModal.classList.add('hidden');
        });
    }
    if (cancelClearBtn) {
        cancelClearBtn.addEventListener('click', () => {
            confirmClearModal.classList.add('hidden');
        });
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchInventory();
    renderQuote();

});
