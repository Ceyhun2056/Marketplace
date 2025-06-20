// Sample product data with correct image paths and titles
const products = [
    {
        id: 1,
        title: 'Wireless Headphones',
        price: 59.99,
        desc: 'High quality wireless headphones with noise cancellation.',
        tags: ['electronics', 'audio', 'wireless'],
        category: 'electronics',
        stock: 5,
        variants: [
            { name: 'Color', options: ['Black', 'White', 'Blue'] }
        ],
        images: ['media/earbuds.png'],

    },
    {
        id: 2,
        title: 'Smart Watch',
        price: 99.99,
        desc: 'Track your fitness and notifications with this smart watch.',
        tags: ['electronics', 'wearable'],
        category: 'electronics',
        stock: 2,
        variants: [
            { name: 'Size', options: ['Small', 'Medium', 'Large'] },
            { name: 'Color', options: ['Black', 'Silver'] }
        ],
        images: ['media/apple.png'],
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
        variants: [],
        images: ['media/book.png'],
        video: ''
    }
];
 
// Cart state
let cart = [];

// Render products with stock and variants (no tags)
function renderProducts() {
    const productsDiv = document.getElementById('products');
    productsDiv.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product';
        div.innerHTML = `
            <img src="${product.images[0]}" alt="${product.title}">
            <h3>${product.title}</h3>
            <p>${product.desc}</p>
            <div class="price">$${product.price.toFixed(2)}</div>
            <div class="stock">${product.stock > 0 ? `In stock: ${product.stock}` : '<span class="out-of-stock">Out of stock</span>'}</div>
            <button onclick="showProductDetail(${product.id})">View Details</button>
            <button onclick="addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productsDiv.appendChild(div);
    });
}

// Add to cart (fix undefined name issue)
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
            <button onclick="removeFromCart(${item.id})">Remove</button>
        `;
        cartItemsDiv.appendChild(div);
    });
    document.getElementById('cartTotal').textContent = total.toFixed(2);
}

// Remove from cart
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartCount();
    renderCart();
}

// Show product detail modal
function showProductDetail(id) {
    const product = products.find(p => p.id === id);
    const detailDiv = document.getElementById('productDetail');
    if (!product) return;
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
        <img src="${product.images[0]}" alt="${product.title}" style="max-width:200px;display:block;margin:0 auto 1rem;">
        <h3>${product.title}</h3>
        <div class="price">$${product.price.toFixed(2)}</div>
        <div class="stock">${product.stock > 0 ? `In stock: ${product.stock}` : '<span class="out-of-stock">Out of stock</span>'}</div>
        <p>${product.desc}</p>
        ${variantsHtml}
        ${videoHtml}
        <button onclick="addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        <button class="view-comments-btn" onclick="showComments(${product.id})">View Comments</button>
        <div id="commentsSection"></div>
    `;
    document.getElementById('productModal').classList.add('active');
}

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

document.getElementById('closeProductModal').onclick = function() {
    document.getElementById('productModal').classList.remove('active');
};

// Modal logic
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

// Expose removeFromCart and addToCart globally
window.removeFromCart = removeFromCart;
window.addToCart = addToCart;

// Initial render
renderProducts();
updateCartCount();