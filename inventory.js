// This script now waits for our custom 'navigationLoaded' event.
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
    // --- New selectors for the quotation builder ---
    const quoteBody = document.getElementById('quote-body');
    const grandTotalSpan = document.getElementById('grand-total');
    const clearQuoteBtn = document.getElementById('clear-quote-btn');


    // =================================================================
    // STATE
    // =================================================================
    let allInventory = []; // This will store all items fetched from Firebase
    let quoteItems = []; // This will store items added to the current quote

    // =================================================================
    // FUNCTIONS
    // =================================================================

    /**
     * Renders a list of inventory items into the main table.
     * @param {Array} items - An array of inventory item objects to render.
     */
    function renderInventory(items) {
        if (!inventoryTableBody) return;
        if (items.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">No inventory items found.</td></tr>`;
            return;
        }
        inventoryTableBody.innerHTML = items.map(item => {
            const itemName = item.itemName || 'Unnamed Item';
            const category = item.category || 'N/A';
            // Use toLocaleString to format the number with commas and two decimal places
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

    /**
     * Renders the items in the quoteItems array into the quotation builder UI.
     */
    function renderQuote() {
        if (!quoteBody || !grandTotalSpan) return;

        if (quoteItems.length === 0) {
            quoteBody.innerHTML = `<p class="text-sm text-gray-500 text-center py-8">No items added yet.</p>`;
            grandTotalSpan.textContent = '0.00';
            return;
        }

        quoteBody.innerHTML = quoteItems.map(item => {
            const itemTotal = item.quantity * item.unitPrice;
            // Format the item total with commas
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
        // Format the grand total with commas
        grandTotalSpan.textContent = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Fetches all documents from the 'inventory' collection in Firestore.
     */
    async function fetchInventory() {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">Loading inventory...</td></tr>`;
        try {
            const snapshot = await inventoryCollection.get();
            allInventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched inventory:", allInventory);
            renderInventory(allInventory);
        } catch (error) {
            console.error("Error fetching inventory: ", error);
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading inventory.</td></tr>`;
        }
    }

    // =================================================================
    // EVENT HANDLERS
    // =================================================================

    // Event listener for the main inventory table
    if (inventoryTableBody) {
        inventoryTableBody.addEventListener('click', (e) => {
            // Check if an "Add to Quote" button was clicked
            if (e.target.classList.contains('add-to-quote-btn')) {
                const itemId = e.target.dataset.id;
                const itemToAdd = allInventory.find(item => item.id === itemId);

                if (itemToAdd) {
                    const quantity = parseInt(prompt(`Enter quantity for ${itemToAdd.itemName}:`, '1'), 10);
                    if (!isNaN(quantity) && quantity > 0) {
                        // Check if item is already in the quote
                        const existingQuoteItem = quoteItems.find(item => item.id === itemId);
                        if (existingQuoteItem) {
                            // If it exists, just update the quantity
                            existingQuoteItem.quantity += quantity;
                        } else {
                            // If it's a new item, add it to the quote list
                            quoteItems.push({ ...itemToAdd, quantity: quantity });
                        }
                        renderQuote(); // Re-render the quote list
                    }
                }
            }
        });
    }

    // Event listener for the "Clear" button in the quote section
    if (clearQuoteBtn) {
        clearQuoteBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the entire quote?")) {
                quoteItems = []; // Empty the quote array
                renderQuote(); // Re-render the empty quote list
            }
        });
    }


    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchInventory(); // Fetch and display the inventory data
    renderQuote(); // Render the initial empty quote list

});
