// Sample product data with Avito-style fields
const products = [
    {
        id: 1,
        title: 'Wireless Headphones',
        price: 59.99,
        desc: 'High quality wireless headphones with noise cancellation.',
        tags: ['electronics', 'audio', 'wireless'],
        category: 'electronics',
        stock: 5,
        location: 'Baku',
        postedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
        seller: 'Ali',
        variants: [
            { name: 'Color', options: ['Black', 'White', 'Blue'] }
        ],
        images: ['media/Wireless Headphones (2).jpeg'],
        video: ''
    },
    {
        id: 2,
        title: 'Smart Watch',
        price: 99.99,
        desc: 'Track your fitness and notifications with this smart watch.',
        tags: ['electronics', 'wearable'],
        category: 'electronics',
        stock: 2,
        location: 'Sumqayit',
        postedAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
        seller: 'Leyla',
        variants: [
            { name: 'Size', options: ['Small', 'Medium', 'Large'] },
            { name: 'Color', options: ['Black', 'Silver'] }
        ],
        images: ['media/download (2).jpeg'],
        video: ''
    },
    {
        id: 3,
        title: 'E-Book Reader',
        price: 79.99,
        desc: 'Read your favorite books anywhere with this lightweight e-reader.',
        tags: ['electronics', 'books'],
        category: 'books',
        stock: 3,
        location: 'Ganja',
        postedAt: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
        seller: 'Samir',
        variants: [],
        images: ['media/E-Book Reader.jpeg'],
        video: ''
    },
    {
        id: 4,
        title: 'ADA Hoodie',
        price: 35.00,
        desc: 'Official ADA University hoodie, size M. Barely used.',
        tags: ['clothing', 'university', 'hoodie'],
        category: 'clothing',
        stock: 1,
        location: 'Baku',
        postedAt: Date.now() - 1000 * 60 * 60 * 8, // 8 hours ago
        seller: 'Nigar',
        variants: [{ name: 'Size', options: ['M'] }],
        images: ['media/hoodie.jpeg'],
        video: ''
    },
    {
        id: 5,
        title: 'Calculus Textbook',
        price: 18.50,
        desc: 'Calculus I & II textbook, good condition, some notes inside.',
        tags: ['books', 'math', 'textbook'],
        category: 'books',
        stock: 2,
        location: 'Baku',
        postedAt: Date.now() - 1000 * 60 * 60 * 30, // 1.25 days ago
        seller: 'Farid',
        variants: [],
        images: ['media/book.png'],
        video: ''
    },
    {
        id: 6,
        title: 'iPhone 12 Case',
        price: 7.99,
        desc: 'Transparent silicone case for iPhone 12. Brand new.',
        tags: ['electronics', 'accessories', 'phone'],
        category: 'electronics',
        stock: 4,
        location: 'Sumqayit',
        postedAt: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
        seller: 'Kamran',
        variants: [{ name: 'Color', options: ['Clear'] }],
        images: ['media/iPhone 12 Case.jpeg'],
        video: ''
    },
    {
        id: 7,
        title: 'Bluetooth Speaker',
        price: 22.00,
        desc: 'Portable Bluetooth speaker, loud and clear sound.',
        tags: ['electronics', 'audio', 'speaker'],
        category: 'electronics',
        stock: 3,
        location: 'Ganja',
        postedAt: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
        seller: 'Aysel',
        variants: [],
        images: ['media/Bluetooth Speaker.jpeg'],
        video: ''
    },
    {
        id: 8,
        title: 'MacBook Pro 2020',
        price: 950.00,
        desc: 'Apple MacBook Pro 13-inch, 2020, 16GB RAM, 512GB SSD. Excellent condition.',
        tags: ['electronics', 'laptop', 'apple'],
        category: 'electronics',
        stock: 1,
        location: 'Baku',
        postedAt: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
        seller: 'Elvin',
        variants: [],
        images: ['media/MacBook Pro 2020.jpeg'],
        video: ''
    },
    {
        id: 9,
        title: 'Desk Lamp',
        price: 12.00,
        desc: 'LED desk lamp with adjustable brightness. White color.',
        tags: ['home', 'lamp', 'desk'],
        category: 'home',
        stock: 2,
        location: 'Sumqayit',
        postedAt: Date.now() - 1000 * 60 * 60 * 15, // 15 hours ago
        seller: 'Rashad',
        variants: [],
        images: ['media/Desk Lamp.png'],
        video: ''
    }
];

// Helper to format posted time
function timeAgo(ts) {
    const now = Date.now();
    const diff = Math.floor((now - ts) / 1000);
    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hours ago`;
    return `${Math.floor(diff/86400)} days ago`;
}

// Cart state
let cart = [];

// SEARCH FUNCTIONALITY
const searchInput = document.querySelector('.search-input');
const categorySelect = document.querySelector('.category-select');
let filteredProducts = [...products];

searchInput.addEventListener('input', filterAndRenderProducts);
categorySelect.addEventListener('change', filterAndRenderProducts);

function filterAndRenderProducts() {
    const search = searchInput.value.toLowerCase();
    const category = document.querySelector('.category-select').value;
    filteredProducts = products.filter(product => {
        const matchesSearch = product.title.toLowerCase().includes(search) || product.desc.toLowerCase().includes(search);
        const matchesCategory = !category || product.category === category;
        return matchesSearch && matchesCategory;
    });
    renderProducts();
}

// POST PRODUCT FUNCTIONALITY
const openPostModal = document.getElementById('openPostModal');
const postModal = document.getElementById('postModal');
const closePostModal = document.getElementById('closePostModal');
const postForm = document.getElementById('postForm');

if (openPostModal) openPostModal.onclick = () => postModal.classList.add('active');
if (closePostModal) closePostModal.onclick = () => postModal.classList.remove('active');
if (postForm) {
    postForm.onsubmit = function(e) {
        e.preventDefault();
        const newProduct = {
            id: Date.now(),
            title: document.getElementById('postTitle').value,
            price: parseFloat(document.getElementById('postPrice').value),
            desc: document.getElementById('postDesc').value,
            tags: document.getElementById('postTags').value.split(',').map(t => t.trim()).filter(Boolean),
            category: document.getElementById('postCategory').value || 'other',
            stock: parseInt(document.getElementById('postStock').value, 10),
            location: document.getElementById('postLocation').value || 'Baku',
            seller: document.getElementById('postSeller').value || 'Unknown',
            postedAt: Date.now(),
            variants: [],
            images: [document.getElementById('postImage').value || 'media/default.png'],
            video: ''
        };
        products.push(newProduct);
        filterAndRenderProducts();
        postModal.classList.remove('active');
        postForm.reset();
    };
}

// RENDER PRODUCTS (use filteredProducts)
function renderProducts() {
    const productsDiv = document.getElementById('products');
    productsDiv.innerHTML = '';
    filteredProducts.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product';
        // Add favorite (heart) icon
        div.innerHTML = `
            <span class="posted-at">${timeAgo(product.postedAt)}</span>
            <span class="favorite-icon" onclick="toggleFavorite(${product.id}, event)" title="Add to favorites" style="position:absolute;top:10px;right:10px;cursor:pointer;font-size:1.3em;user-select:none;">${isFavorite(product.id) ? '❤️' : '🤍'}</span>
            <img src="${product.images[0]}" alt="${product.title}">
            <h3>${product.title}</h3>
            <div class="price">$${product.price.toFixed(2)}</div>
            <div class="location">${product.location}</div>
            <p>${product.desc}</p>
            <div class="stock">${product.stock > 0 ? `In stock: ${product.stock}` : '<span class="out-of-stock">Out of stock</span>'}</div>
            <button onclick="showProductDetail(${product.id})">View Details</button>
            <button onclick="addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productsDiv.appendChild(div);
    });
}

// --- FAVORITES LOGIC ---
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

function isFavorite(id) {
    return favorites.includes(id);
}

function toggleFavorite(id, event) {
    event.stopPropagation();
    if (isFavorite(id)) {
        favorites = favorites.filter(favId => favId !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderProducts();
}

// Add to cart
function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty += 1;
    } else {
        cart.push({ id: product.id, name: product.title, price: product.price, qty: 1 });
    }
    updateCartCount();
    renderCart();
}

// Remove one from cart
function removeOneFromCart(id) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty -= 1;
        if (item.qty <= 0) {
            cart = cart.filter(i => i.id !== id);
        }
    }
    updateCartCount();
    renderCart();
}

// Remove from cart
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartCount();
    renderCart();
}

// Update cart count
function updateCartCount() {
    document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

// Render cart modal
function renderCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    cartItemsDiv.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <span>${item.name} (x${item.qty})</span>
            <span>$${(item.price * item.qty).toFixed(2)}</span>
            <button onclick="removeOneFromCart(${item.id})">–</button>
            <button onclick="removeFromCart(${item.id})">🗑</button>
        `;
        cartItemsDiv.appendChild(div);
    });
    document.getElementById('cartTotal').textContent = total.toFixed(2);
}

// Show product detail modal
function showProductDetail(id) {
    const product = products.find(p => p.id === id);
    const detailDiv = document.getElementById('productDetail');
    if (!product) return;
    // Gallery for multiple images
    let galleryHtml = '';
    if (product.images && product.images.length > 1) {
        galleryHtml = `<div class="gallery-main"><img id="mainGalleryImg" src="${product.images[0]}" style="max-width:240px;display:block;margin:0 auto 1rem;border-radius:10px;"></div>`;
        galleryHtml += '<div class="gallery-thumbs">' + product.images.map((img, idx) =>
            `<img src="${img}" class="gallery-thumb" style="width:48px;height:48px;margin:0 4px;cursor:pointer;border-radius:6px;border:2px solid #eee;" onclick="setGalleryImg('${img}')">`
        ).join('') + '</div>';
    } else {
        galleryHtml = `<img src="${product.images[0]}" alt="${product.title}" style="max-width:240px;display:block;margin:0 auto 1rem;border-radius:10px;">`;
    }
    let variantsHtml = '';
    if (product.variants && product.variants.length > 0) {
        variantsHtml = product.variants.map(variant => `
            <div class="variant-group">
                <label>${variant.name}:</label>
                <select>
                    ${variant.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            </div>
        `).join('');
    }
    let videoHtml = product.video ? `<video src="${product.video}" controls style="width:100%;margin-top:1rem;"></video>` : '';
    detailDiv.innerHTML = `
        ${galleryHtml}
        <h3>${product.title}</h3>
        <div class="price">$${product.price.toFixed(2)}</div>
        <div class="location"><b>Location:</b> ${product.location || 'Baku'}</div>
        <div class="seller"><b>Seller:</b> ${product.seller || 'Unknown'}</div>
        <div class="posted-at"><b>Posted:</b> ${timeAgo(product.postedAt)}</div>
        <div class="stock">${product.stock > 0 ? `In stock: ${product.stock}` : '<span class="out-of-stock">Out of stock</span>'}</div>
        <p>${product.desc}</p>
        ${variantsHtml}
        ${videoHtml}
        <button onclick="addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        <button class="view-comments-btn" onclick="showComments(${product.id})">View Comments</button>
        <button class="contact-btn" style="background:var(--primary-blue);color:#fff;margin-top:0.7rem;">Contact Seller</button>
        <div id="commentsSection"></div>
    `;
    document.getElementById('productModal').classList.add('active');
}

// Gallery image switcher
window.setGalleryImg = function(imgUrl) {
    const mainImg = document.getElementById('mainGalleryImg');
    if (mainImg) mainImg.src = imgUrl;
};

// Dummy comments data
const comments = {
    1: [
        { user: 'Ali', text: 'Great quality, fast delivery!' },
        { user: 'Leyla', text: 'Sound is amazing, battery lasts long.' }
    ],
    2: [
        { user: 'Samir', text: 'Very useful for tracking my steps.' }
    ],
    3: [
        { user: 'Aysel', text: 'Perfect for reading on the go.' }
    ]
};

// Show comments for a product
function showComments(productId) {
    const section = document.getElementById('commentsSection');
    const productComments = comments[productId] || [];
    if (productComments.length === 0) {
        section.innerHTML = '<p style="color:#888;">No comments yet.</p>';
        return;
    }
    section.innerHTML = '<h4>Comments</h4>' + productComments.map(c => `<div class="comment"><strong>${c.user}:</strong> ${c.text}</div>`).join('');
}

// Modal logic
document.getElementById('closeProductModal').onclick = function() {
    document.getElementById('productModal').classList.remove('active');
};
document.getElementById('cartBtn').onclick = function() {
    renderCart();
    document.getElementById('cartModal').classList.add('active');
};
document.getElementById('closeModal').onclick = function() {
    document.getElementById('cartModal').classList.remove('active');
};
document.getElementById('checkoutBtn').onclick = function() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    alert('Thank you for your purchase!');
    cart = [];
    updateCartCount();
    renderCart();
    document.getElementById('cartModal').classList.remove('active');
};

// --- CATEGORY TILE INTERACTION ---
const categoryTiles = document.querySelectorAll('.category-tile');
categoryTiles.forEach(tile => {
    let lastClick = 0;
    tile.addEventListener('click', function() {
        // Remove active from all
        categoryTiles.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        // Set filter
        const cat = this.getAttribute('data-category');
        document.querySelector('.category-select').value = cat;
        filterAndRenderProducts();
        // Double click logic
        const now = Date.now();
        if (now - lastClick < 400) {
            // Double click detected: unselect
            this.classList.remove('active');
            document.querySelector('.category-select').value = '';
            filterAndRenderProducts();
        }
        lastClick = now;
    });
});

// --- LANGUAGE SWITCHER LOGIC ---
const translations = {
    az: {
        searchPlaceholder: 'Mən axtarıram',
        searchBtn: 'Axtarış',
        postBtn: ' Elan yerləşdir',
        cart: 'Səbət',
        yourCart: 'Səbətiniz',
        checkout: 'Alış-verişi bitir',
        signIn: 'Giriş',
        register: 'Qeydiyyat',
        postProduct: 'Yeni məhsul yerləşdir',
        // Category tiles and dropdown
        all: 'Bütün kateqoriyalar',
        electronics: 'Elektronika',
        books: 'Kitablar',
        clothing: 'Geyim',
        home: 'Ev və bağ',
        services: 'Xidmətlər',
        transport: 'Nəqliyyat',
        sports: 'İdman və hobbi',
        personal: 'Şəxsi əşyalar',
        animals: 'Heyvanlar',
        medicine: 'Tibbi Məhsullar',
    },
    en: {
        searchPlaceholder: 'Search in Avito...',
        searchBtn: 'Search',
        postBtn: 'Post ',
        cart: 'Cart',
        yourCart: 'Your Cart',
        checkout: 'Checkout',
        signIn: 'Sign In',
        register: 'Register',
        postProduct: 'Post a New Product',
        // Category tiles and dropdown
        all: 'All Categories',
        electronics: 'Electronics',
        books: 'Books',
        clothing: 'Clothing',
        home: 'Home & Garden',
        services: 'Services',
        transport: 'Transport',
        sports: 'Sports & Hobby',
        personal: 'Personal Items',
        animals: 'Animals',
        medicine: 'Medical Products',
    },
    ru: {
        searchPlaceholder: 'Я ищу',
        searchBtn: 'Поиск',
        postBtn: 'Разместить',
        cart: 'Корзина',
        yourCart: 'Ваша корзина',
        checkout: 'Оформить заказ',
        signIn: 'Вход',
        register: 'Регистрация',
        postProduct: 'Добавить товар',
        // Category tiles and dropdown
        all: 'Все категории',
        electronics: 'Электроника',
        books: 'Книги',
        clothing: 'Одежда',
        home: 'Дом и сад',
        services: 'Услуги',
        transport: 'Транспорт',
        sports: 'Спорт и хобби',
        personal: 'Личные вещи',
        animals: 'Животные',
        medicine: 'Медицинские товары',
    }
};

function setLanguage(lang) {
    localStorage.setItem('lang', lang);
    document.getElementById('langAz').classList.toggle('active', lang === 'az');
    document.getElementById('langEn').classList.toggle('active', lang === 'en');
    document.getElementById('langRu').classList.toggle('active', lang === 'ru');
    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' && el.type === 'text') {
            el.placeholder = translations[lang][key] || el.placeholder;
        } else {
            el.textContent = translations[lang][key] || el.textContent;
        }
    });
    // Update modal titles/buttons if present
    const postTitle = document.querySelector('#postModal h3');
    if (postTitle) postTitle.textContent = translations[lang].postProduct;
    const postBtn = document.querySelector('#postForm .auth-btn');
    if (postBtn) postBtn.textContent = translations[lang].postBtn;
    
    // Dynamic styling for post button based on language
    const headerPostBtn = document.getElementById('openPostModal');
    if (headerPostBtn) {
        headerPostBtn.textContent = translations[lang].postBtn;
        
        // Apply specific styling for Russian language due to longer text
        if (lang === 'ru') {
            headerPostBtn.style.fontSize = '0.75em';
            headerPostBtn.style.padding = '0.35em 0.8em';
            headerPostBtn.style.maxWidth = '200px';
            headerPostBtn.style.letterSpacing = '0.05px';
        } else {
            // Reset to default for other languages
            headerPostBtn.style.fontSize = '';
            headerPostBtn.style.padding = '';
            headerPostBtn.style.maxWidth = '';
            headerPostBtn.style.letterSpacing = '';
        }
    }
    
    const cartTitle = document.querySelector('#cartModal h3');
    if (cartTitle) cartTitle.textContent = translations[lang].yourCart;
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.textContent = translations[lang].checkout;
    // Category tiles
    document.querySelectorAll('[data-i18n-tile]').forEach(tile => {
        const key = tile.getAttribute('data-i18n-tile');
        const span = tile.querySelector('span');
        if (span) span.textContent = translations[lang][key] || span.textContent;
    });
    // Category dropdown
    document.querySelectorAll('.category-select option').forEach(opt => {
        const key = opt.getAttribute('data-i18n-option');
        if (key && translations[lang][key]) opt.textContent = translations[lang][key];
    });
}

// Language switcher event listeners
const langAzBtn = document.getElementById('langAz');
const langEnBtn = document.getElementById('langEn');
const langRuBtn = document.getElementById('langRu');
if (langAzBtn && langEnBtn && langRuBtn) {
    langAzBtn.onclick = () => setLanguage('az');
    langEnBtn.onclick = () => setLanguage('en');
    langRuBtn.onclick = () => setLanguage('ru');
}
// Set initial language
setLanguage(localStorage.getItem('lang') || 'en');

// --- DARK MODE LOGIC ---
const darkModeBtn = document.getElementById('darkModeBtn');
if (darkModeBtn) {
    darkModeBtn.onclick = function() {
        document.body.classList.toggle('dark-mode');
        darkModeBtn.classList.toggle('active');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? '1' : '0');
    };
    // On load
    if (localStorage.getItem('darkMode') === '1') {
        document.body.classList.add('dark-mode');
        darkModeBtn.classList.add('active');
    }
}

// --- FAVORITES MODAL LOGIC ---
const favoritesBtn = document.getElementById('favoritesBtn');
const favoritesModal = document.getElementById('favoritesModal');
const closeFavoritesModal = document.getElementById('closeFavoritesModal');
const favoritesListDiv = document.getElementById('favoritesList');

if (favoritesBtn && favoritesModal && closeFavoritesModal) {
    favoritesBtn.onclick = function() {
        renderFavoritesList();
        favoritesModal.classList.add('active');
    };
    closeFavoritesModal.onclick = function() {
        favoritesModal.classList.remove('active');
    };
}
function renderFavoritesList() {
    favoritesListDiv.innerHTML = '';
    if (!favorites.length) {
        favoritesListDiv.innerHTML = '<p style="color:#888;">No favorites yet.</p>';
        return;
    }
    favorites.forEach(id => {
        const product = products.find(p => p.id === id);
        if (!product) return;
        const div = document.createElement('div');
        div.className = 'favorite-product';
        div.innerHTML = `
            <img src="${product.images[0]}" alt="${product.title}">
            <div>
                <div style="font-weight:600;">${product.title}</div>
                <div style="color:#2563eb;font-weight:500;">$${product.price.toFixed(2)}</div>
            </div>
            <button class="remove-fav-btn" onclick="removeFromFavorites(${product.id})">Remove</button>
        `;
        favoritesListDiv.appendChild(div);
    });
}
window.removeFromFavorites = function(id) {
    favorites = favorites.filter(favId => favId !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavoritesList();
    renderProducts();
};

// Authentication System
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('marketplace_users') || '[]');
        this.init();
    }

    init() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('marketplace_current_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUI();
        }

        // Event listeners
        this.bindEvents();
    }

    bindEvents() {
        // Auth modal events
        document.getElementById('authTriggerBtn').addEventListener('click', () => {
            this.showAuthModal();
        });

        document.getElementById('closeAuthModal').addEventListener('click', () => {
            this.hideAuthModal();
        });

        // Form switching
        document.getElementById('switchToRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('switchToSignIn').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignInForm();
        });

        // Form submissions
        document.getElementById('signInForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignIn();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // User profile events
        document.getElementById('userProfile').addEventListener('click', () => {
            this.toggleUserDropdown();
        });

        document.getElementById('viewProfile').addEventListener('click', (e) => {
            e.preventDefault();
            this.showProfileModal();
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Profile modal events
        document.getElementById('closeProfileModal').addEventListener('click', () => {
            this.hideProfileModal();
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });        // Profile tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Change avatar functionality
        document.getElementById('changeAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            this.handleAvatarChange(e);
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-profile')) {
                this.hideUserDropdown();
            }
        });
    }

    showAuthModal() {
        document.getElementById('authModal').classList.add('active');
        this.showSignInForm();
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.remove('active');
    }

    showSignInForm() {
        document.getElementById('authTitle').textContent = 'Sign In';
        document.getElementById('signInForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }

    showRegisterForm() {
        document.getElementById('authTitle').textContent = 'Create Account';
        document.getElementById('signInForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }

    async handleSignIn() {
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;

        // Find user
        const user = this.users.find(u => u.email === email && u.password === password);
        
        if (user) {
            this.currentUser = user;
            localStorage.setItem('marketplace_current_user', JSON.stringify(user));
            this.updateUI();
            this.hideAuthModal();
            this.showNotification('Welcome back!', 'success');
        } else {
            this.showNotification('Invalid email or password', 'error');
        }
    }

    async handleRegister() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const phone = document.getElementById('registerPhone').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (this.users.find(u => u.email === email)) {
            this.showNotification('Email already registered', 'error');
            return;
        }        // Create new user
        const newUser = {
            id: Date.now(),
            name,
            email,
            phone,
            password,
            avatar: 'media/user.png',
            joinDate: new Date().toISOString(),
            location: 'Baku',
            listings: [],
            reviews: [],
            rating: 0
        };

        this.users.push(newUser);
        localStorage.setItem('marketplace_users', JSON.stringify(this.users));
        
        this.currentUser = newUser;
        localStorage.setItem('marketplace_current_user', JSON.stringify(newUser));
        
        this.updateUI();
        this.hideAuthModal();
        this.showNotification('Account created successfully!', 'success');
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('marketplace_current_user');
        this.updateUI();
        this.hideUserDropdown();
        this.showNotification('Logged out successfully', 'success');
    }    updateUI() {
        const authBtn = document.getElementById('authTriggerBtn');
        const userProfile = document.getElementById('userProfile');

        if (this.currentUser) {
            authBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            
            const avatar = this.currentUser.avatar || 'media/user.png';
            document.getElementById('userAvatar').src = avatar;
            document.getElementById('userName').textContent = this.currentUser.name;
        } else {
            authBtn.style.display = 'block';
            userProfile.style.display = 'none';
        }
    }

    toggleUserDropdown() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.classList.toggle('active');
    }

    hideUserDropdown() {
        document.getElementById('userDropdown').classList.remove('active');
    }

    showProfileModal() {
        document.getElementById('profileModal').classList.add('active');
        this.populateProfileForm();
        this.hideUserDropdown();
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.remove('active');
    }    populateProfileForm() {
        if (!this.currentUser) return;

        const avatar = this.currentUser.avatar || 'media/user.png';
        document.getElementById('profileAvatar').src = avatar;
        document.getElementById('profileName').textContent = this.currentUser.name;
        document.getElementById('profileEmail').textContent = this.currentUser.email;
        
        document.getElementById('editName').value = this.currentUser.name;
        document.getElementById('editEmail').value = this.currentUser.email;
        document.getElementById('editPhone').value = this.currentUser.phone || '';
        document.getElementById('editLocation').value = this.currentUser.location || 'Baku';

        // Update stats
        document.getElementById('listingsCount').textContent = this.currentUser.listings?.length || 0;
        document.getElementById('ratingsCount').textContent = this.currentUser.reviews?.length || 0;
        document.getElementById('memberSince').textContent = new Date(this.currentUser.joinDate).getFullYear();
    }

    updateProfile() {
        if (!this.currentUser) return;

        this.currentUser.name = document.getElementById('editName').value;
        this.currentUser.email = document.getElementById('editEmail').value;
        this.currentUser.phone = document.getElementById('editPhone').value;
        this.currentUser.location = document.getElementById('editLocation').value;

        // Update in users array
        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            this.users[userIndex] = this.currentUser;
            localStorage.setItem('marketplace_users', JSON.stringify(this.users));
        }

        localStorage.setItem('marketplace_current_user', JSON.stringify(this.currentUser));
        this.updateUI();
        this.populateProfileForm();
        this.showNotification('Profile updated successfully!', 'success');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load tab-specific content
        if (tabName === 'listings') {
            this.loadUserListings();
        } else if (tabName === 'reviews') {
            this.loadUserReviews();
        }
    }

    loadUserListings() {
        const listingsContainer = document.getElementById('userListings');
        if (!this.currentUser || !this.currentUser.listings?.length) {
            listingsContainer.innerHTML = '<p>You haven\'t posted any listings yet. <a href="#" onclick="document.getElementById(\'openPostModal\').click()">Create your first listing</a></p>';
            return;
        }

        // Display user's listings
        listingsContainer.innerHTML = this.currentUser.listings.map(listing => `
            <div class="user-listing">
                <img src="${listing.image}" alt="${listing.title}">
                <div class="listing-info">
                    <h4>${listing.title}</h4>
                    <p class="price">$${listing.price}</p>
                    <p class="status">${listing.active ? 'Active' : 'Inactive'}</p>
                </div>
                <div class="listing-actions">
                    <button onclick="editListing(${listing.id})">Edit</button>
                    <button onclick="deleteListing(${listing.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    loadUserReviews() {
        const reviewsContainer = document.getElementById('userReviews');
        if (!this.currentUser || !this.currentUser.reviews?.length) {
            reviewsContainer.innerHTML = '<p>No reviews yet. Reviews from buyers will appear here.</p>';
            return;
        }

        // Display user's reviews
        reviewsContainer.innerHTML = this.currentUser.reviews.map(review => `
            <div class="review">
                <div class="review-header">
                    <strong>${review.reviewerName}</strong>
                    <div class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
                </div>
                <p>${review.comment}</p>
                <small>${new Date(review.date).toLocaleDateString()}</small>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    handleAvatarChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Image size should be less than 5MB', 'error');
            return;
        }

        // Create FileReader to convert image to base64
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            
            // Update user avatar
            if (this.currentUser) {
                this.currentUser.avatar = base64Image;
                
                // Update in users array
                const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
                if (userIndex !== -1) {
                    this.users[userIndex] = this.currentUser;
                    localStorage.setItem('marketplace_users', JSON.stringify(this.users));
                }

                localStorage.setItem('marketplace_current_user', JSON.stringify(this.currentUser));
                
                // Update UI
                this.updateUI();
                this.populateProfileForm();
                this.showNotification('Profile photo updated successfully!', 'success');
            }
        };

        reader.onerror = () => {
            this.showNotification('Error reading the image file', 'error');
        };

        reader.readAsDataURL(file);
    }
}

// Initialize authentication system
const authSystem = new AuthSystem();

// Expose functions globally for HTML event handlers
window.removeOneFromCart = removeOneFromCart;
window.removeFromCart = removeFromCart;
window.addToCart = addToCart;
window.showProductDetail = showProductDetail;
window.toggleFavorite = toggleFavorite;

// Initial render
filterAndRenderProducts();
updateCartCount();