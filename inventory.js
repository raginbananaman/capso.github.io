// This script now waits for our custom 'navigationLoaded' event.
// This guarantees that both the navigation AND the Firebase libraries are ready before it runs.
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

    // =================================================================
    // STATE
    // =================================================================
    let allInventory = []; // This will store all items fetched from Firebase

    // =================================================================
    // FUNCTIONS
    // =================================================================

    /**
     * Renders a list of inventory items into the main table.
     * @param {Array} items - An array of inventory item objects to render.
     */
    function renderInventory(items) {
        if (!inventoryTableBody) {
            console.error("Inventory table body not found!");
            return;
        }

        if (items.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">No inventory items found.</td></tr>`;
            return;
        }

        inventoryTableBody.innerHTML = items.map(item => {
            const itemName = item.itemName || 'Unnamed Item';
            const category = item.category || 'N/A';
            const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : '0.00';
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
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass}">
                            ${stockStatus}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="add-to-quote-btn text-indigo-600 hover:text-indigo-900" data-id="${item.id}">Add to Quote</button>
                    </td>
                </tr>
            `;
        }).join('');
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
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading inventory. Please check the connection and console.</td></tr>`;
        }
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    fetchInventory();

});
