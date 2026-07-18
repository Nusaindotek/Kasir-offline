if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('PWA Service Worker terdaftar!', reg))
            .catch(err => console.log('PWA Gagal didaftarkan:', err));
    });
}

let products = JSON.parse(localStorage.getItem('pos_products')) || [];
let transactions = JSON.parse(localStorage.getItem('pos_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('pos_categories')) || ["Rajut", "Aksesoris", "Umum"];
let cart = [];
let currentProductTab = 'aktif';

function switchPage(pageId) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');

    const navIds = ['home', 'penjualan', 'menu', 'produk', 'infotoko'];
    navIds.forEach(id => {
        const navBtn = document.getElementById(`nav-${id}`);
        if (navBtn) {
            navBtn.className = "flex flex-col items-center p-1 text-slate-400 cursor-pointer";
        }
    });

    const activeNav = document.getElementById(`nav-${pageId}`);
    if (activeNav) {
        activeNav.className = "flex flex-col items-center p-1 text-blue-600 font-bold bg-blue-50 px-4 py-1.5 rounded-xl transition-all cursor-pointer";
    }

    if (pageId === 'home') updateDashboardMetrics();
    if (pageId === 'penjualan') { renderSaleProducts(); updateCartUI(); }
    if (pageId === 'produk') renderProducts();
    if (pageId === 'infotoko') { loadStoreInfo(); renderCategories(); }
}

// MANAJEMEN KATEGORI
function renderCategories() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach((cat, index) => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                <span class="font-semibold text-slate-700">${cat}</span>
                <button onclick="deleteCategory(${index})" class="text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-colors">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    });

    const selectDropdown = document.getElementById('prod-category');
    if (selectDropdown) {
        selectDropdown.innerHTML = '<option value="" disabled selected>Pilih Kategori</option>';
        categories.forEach(cat => {
            selectDropdown.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    try { lucide.createIcons(); } catch(e){}
}

function addCategory() {
    const input = document.getElementById('new-category-input');
    const value = input.value.trim();
    if (!value) return alert('Nama kategori tidak boleh kosong!');
    if (categories.includes(value)) return alert('Kategori sudah ada!');

    categories.push(value);
    localStorage.setItem('pos_categories', JSON.stringify(categories));
    input.value = '';
    renderCategories();
}

function deleteCategory(index) {
    if (confirm(`Hapus kategori "${categories[index]}"?`)) {
        categories.splice(index, 1);
        localStorage.setItem('pos_categories', JSON.stringify(categories));
        renderCategories();
    }
}

function renderSaleProducts() {
    const list = document.getElementById('sale-product-list');
    if (!list) return;
    list.innerHTML = '';
    const q = document.getElementById('sale-search').value.toLowerCase();

    const activeProds = products.filter(p => !p.archived && p.name.toLowerCase().includes(q));
    if(activeProds.length === 0) {
        list.innerHTML = `<p class="text-xs text-center py-4 text-slate-400">Produk tidak ditemukan.</p>`;
        return;
    }

    activeProds.forEach(p => {
        list.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-2xs">
                <div>
                    <div class="flex items-center gap-1.5">
                        <h4 class="text-xs font-bold text-slate-800">${p.name}</h4>
                        <span class="bg-blue-50 text-blue-600 text-[8px] px-1 rounded font-medium">${p.category || 'Umum'}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">Rp ${p.price.toLocaleString('id-ID')} • Stok: ${p.stock}</p>
                </div>
                <button onclick="addToCart(${p.id})" class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer active:scale-95 transition-transform">+ Pilih</button>
            </div>
        `;
    });
}

function addToCart(id) {
    const prod = products.find(p => p.id === id);
    if (!prod || prod.stock <= 0) return alert('Stok habis!');

    const cartItem = cart.find(c => c.id === id);
    if (cartItem) {
        if (cartItem.qty >= prod.stock) return alert('Batas stok tercapai!');
        cartItem.qty++;
    } else {
        cart.push({ ...prod, qty: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Keranjang masih kosong.</p>`;
        document.getElementById('cart-subtotal').innerText = 'Rp 0';
        document.getElementById('cart-tax').innerText = 'Rp 0';
        document.getElementById('cart-total').innerText = 'Rp 0';
        return;
    }

    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center py-2 text-xs">
                <div class="flex-1 pr-2">
                    <p class="font-bold text-slate-800">${item.name}</p>
                    <p class="text-[10px] text-slate-400">Rp ${item.price.toLocaleString('id-ID')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeQty(${item.id}, -1)" class="w-6 h-6 bg-slate-100 rounded-md font-bold text-center">-</button>
                    <span class="font-bold">${item.qty}</span>
                    <button onclick="changeQty(${item.id}, 1)" class="w-6 h-6 bg-slate-100 rounded-md font-bold text-center">+</button>
                </div>
            </div>
        `;
    });

    const taxPercent = parseFloat(document.getElementById('inp-pajak-toko')?.value || 0);
    const tax = subtotal * (taxPercent / 100);
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('cart-tax').innerText = `Rp ${tax.toLocaleString('id-ID')}`;
    document.getElementById('cart-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function changeQty(id, delta) {
    const item = cart.find(c => c.id === id);
    const prod = products.find(p => p.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty > prod.stock) { alert('Stok tidak cukup!'); item.qty = prod.stock; }
    if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
    updateCartUI();
}

function clearCart() {
    cart = [];
    document.getElementById('cart-customer').value = '';
    updateCartUI();
}

function checkoutTransaction() {
    if (cart.length === 0) return alert('Keranjang kosong!');

    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.qty;
        const prod = products.find(p => p.id === item.id);
        if (prod) prod.stock -= item.qty;
    });

    const taxPercent = parseFloat(document.getElementById('inp-pajak-toko')?.value || 0);
    const tax = subtotal * (taxPercent / 100);
    const total = subtotal + tax;

    transactions.push({ id: Date.now(), items: [...cart], total: total, date: new Date().toISOString() });
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_transactions', JSON.stringify(transactions));

    showReceipt(subtotal, tax, total);
    clearCart();
}

function showReceipt(subtotal, tax, total) {
    document.getElementById('rec-store-name').innerText = document.getElementById('inp-nama-toko').value;
    document.getElementById('rec-store-address').innerText = document.getElementById('inp-alamat-toko').value;
    document.getElementById('rec-customer').innerText = document.getElementById('cart-customer').value || "Umum";
    document.getElementById('rec-time').innerText = new Date().toLocaleString('id-ID');
    document.getElementById('rec-footer').innerText = document.getElementById('inp-footer-toko').value || "Terima kasih atas kunjungan Anda!";

    // Memuat Pratinjau Logo ke dalam Struk Belanjaan (Jika Ada)
    const saved = JSON.parse(localStorage.getItem('pos_store_profile'));
    const recLogoSpace = document.getElementById('rec-logo-space');
    if (recLogoSpace) {
        if (saved && saved.logo) {
            recLogoSpace.innerHTML = `<img src="${saved.logo}" class="h-10 w-10 object-contain mb-1">`;
        } else {
            recLogoSpace.innerHTML = '';
        }
    }

    const itemsContainer = document.getElementById('rec-items');
    itemsContainer.innerHTML = '';

    cart.forEach(item => {
        itemsContainer.innerHTML += `
            <div class="flex justify-between items-start gap-1">
                <span class="flex-1">${item.name} (x${item.qty})</span>
                <span class="whitespace-nowrap">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
            </div>
        `;
    });

    document.getElementById('rec-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('rec-tax').innerText = `Rp ${tax.toLocaleString('id-ID')}`;
    document.getElementById('rec-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('receipt-modal').classList.remove('hidden');
}

function openModal() { renderCategories(); document.getElementById('product-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('product-modal').classList.add('hidden'); document.getElementById('product-form').reset(); }

function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const category = document.getElementById('prod-category').value;
    const price = parseInt(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    products.push({ id: Date.now(), name, category, price, stock, archived: false });
    localStorage.setItem('pos_products', JSON.stringify(products));
    closeModal();
    renderProducts();
}

function renderProducts() {
    const container = document.getElementById('product-container');
    if (!container) return;
    container.innerHTML = '';
    const q = document.getElementById('product-search').value.toLowerCase();

    const filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(q);
        return currentProductTab === 'aktif' ? (!p.archived && matchSearch) : (p.archived && matchSearch);
    });

    if(filtered.length === 0) {
        container.innerHTML = `<p class="text-xs text-center text-slate-400 py-6">Tidak ada produk.</p>`;
        return;
    }

    filtered.forEach(p => {
        let tombolAksi = '';
        if (currentProductTab === 'aktif') {
            tombolAksi = `
                <button onclick="toggleArsip(${p.id})" class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer">
                    Arsirkan
                </button>
            `;
        } else {
            tombolAksi = `
                <div class="flex gap-1.5">
                    <button onclick="toggleArsip(${p.id})" class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer">
                        Aktifkan
                    </button>
                    <button onclick="hapusProdukPermanen(${p.id})" class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 cursor-pointer">
                        Hapus
                    </button>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="text-xs font-bold text-slate-800">${p.name}</h4>
                        <span class="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md font-medium">${p.category || 'Umum'}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">Harga: Rp ${p.price.toLocaleString('id-ID')} | Stok: ${p.stock}</p>
                </div>
                ${tombolAksi}
            </div>
        `;
    });
}

function toggleArsip(id) {
    const p = products.find(prod => prod.id === id);
    if(p) p.archived = !p.archived;
    localStorage.setItem('pos_products', JSON.stringify(products));
    renderProducts();
}

function hapusProdukPermanen(id) {
    if (confirm('Apakah Anda yakin ingin menghapus produk ini secara permanen?')) {
        products = products.filter(p => p.id !== id);
        localStorage.setItem('pos_products', JSON.stringify(products));
        renderProducts();
    }
}

function switchProductTab(tab) {
    currentProductTab = tab;
    document.getElementById('btn-tab-aktif').className = tab === 'aktif' ? "flex-1 py-2 text-center text-sm font-medium rounded-md bg-blue-600 text-white cursor-pointer" : "flex-1 py-2 text-center text-sm font-medium rounded-md text-gray-700 cursor-pointer";
    document.getElementById('btn-tab-arsip').className = tab === 'arsip' ? "flex-1 py-2 text-center text-sm font-medium rounded-md bg-blue-600 text-white cursor-pointer" : "flex-1 py-2 text-center text-sm font-medium rounded-md text-gray-700 cursor-pointer";
    renderProducts();
}

function updateDashboardMetrics() {
    let todayOmset = 0;
    let todayTransactions = 0;
    let todayItemsSold = 0;

    transactions.forEach(t => {
        todayOmset += t.total;
        todayTransactions++;
        t.items.forEach(item => todayItemsSold += item.qty);
    });

    if(document.getElementById('dash-omset')) document.getElementById('dash-omset').innerText = `Rp ${todayOmset.toLocaleString('id-ID')}`;
    if(document.getElementById('dash-transaksi')) document.getElementById('dash-transaksi').innerText = todayTransactions;
    if(document.getElementById('dash-terjual')) document.getElementById('dash-terjual').innerText = todayItemsSold;
}

function syncStoreInfo() {
    const nama = document.getElementById('inp-nama-toko').value;
    const alamat = document.getElementById('inp-alamat-toko').value;
    if(document.getElementById('dash-nama-toko')) document.getElementById('dash-nama-toko').innerText = nama;
    if(document.getElementById('lbl-nama-toko')) document.getElementById('lbl-nama-toko').innerText = nama;
    if(document.getElementById('lbl-alamat-toko')) document.getElementById('lbl-alamat-toko').innerText = alamat;
}

function saveStoreInfo() {
    const storeProfile = JSON.parse(localStorage.getItem('pos_store_profile')) || {};
    storeProfile.nama = document.getElementById('inp-nama-toko').value;
    storeProfile.alamat = document.getElementById('inp-alamat-toko').value;
    storeProfile.pajak = document.getElementById('inp-pajak-toko').value;
    storeProfile.kertas = document.getElementById('inp-kertas-toko').value;
    storeProfile.footer = document.getElementById('inp-footer-toko').value;

    localStorage.setItem('pos_store_profile', JSON.stringify(storeProfile));
    alert('Informasi Toko disimpan!');
}

function loadStoreInfo() {
    try {
        const saved = JSON.parse(localStorage.getItem('pos_store_profile'));
        if (saved) {
            if (document.getElementById('inp-nama-toko')) document.getElementById('inp-nama-toko').value = saved.nama || 'GROSIR BAJU RAJUT';
            if (document.getElementById('inp-alamat-toko')) document.getElementById('inp-alamat-toko').value = saved.alamat || 'jln inspeksi citarum';
            if (document.getElementById('inp-pajak-toko')) document.getElementById('inp-pajak-toko').value = saved.pajak || '10';
            if (document.getElementById('inp-kertas-toko')) document.getElementById('inp-kertas-toko').value = saved.kertas || '58mm';
            if (document.getElementById('inp-footer-toko')) document.getElementById('inp-footer-toko').value = saved.footer || 'Terima kasih atas kunjungan Anda!';

            if (saved.logo && document.getElementById('preview-logo-container')) {
                document.getElementById('preview-logo-container').innerHTML = `<img src="${saved.logo}" class="w-full h-full object-cover rounded-xl" id="img-logo-toko" alt="Logo">`;
            }
        } else {
            if (document.getElementById('inp-nama-toko')) document.getElementById('inp-nama-toko').value = 'GROSIR BAJU RAJUT';
            if (document.getElementById('inp-alamat-toko')) document.getElementById('inp-alamat-toko').value = 'jln inspeksi citarum';
            if (document.getElementById('inp-pajak-toko')) document.getElementById('inp-pajak-toko').value = '10';
        }
        syncStoreInfo();
    } catch (e) { console.error(e); }
}

// SISTEM SELEKTOR MULTIMEDIA UNTUK LOGO
function triggerPilihLogo() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            alert('Ukuran gambar terlalu besar! Harap pilih gambar di bawah 1 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = event => {
            const base64Image = event.target.result;
            const container = document.getElementById('preview-logo-container');
            if (container) {
                container.innerHTML = `<img src="${base64Image}" class="w-full h-full object-cover rounded-xl" id="img-logo-toko" alt="Logo">`;
            }

            const storeProfile = JSON.parse(localStorage.getItem('pos_store_profile')) || {};
            storeProfile.logo = base64Image;
            localStorage.setItem('pos_store_profile', JSON.stringify(storeProfile));
        };
        reader.readAsDataURL(file);
    };
    fileInput.click();
}

function hapusLogoToko() {
    if (confirm('Apakah Anda yakin ingin menghapus logo toko?')) {
        const container = document.getElementById('preview-logo-container');
        if (container) {
            container.innerHTML = `<span class="text-[10px] font-bold text-slate-400 tracking-wider">STORE</span>`;
        }

        const storeProfile = JSON.parse(localStorage.getItem('pos_store_profile')) || {};
        delete storeProfile.logo;
        localStorage.setItem('pos_store_profile', JSON.stringify(storeProfile));
        alert('Logo berhasil dihapus.');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadStoreInfo();
    updateDashboardMetrics();
    renderCategories();
});
