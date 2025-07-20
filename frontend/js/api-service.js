// API service layer to add to your current app
class ApiService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.token = localStorage.getItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { Authorization: `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication
    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.token = response.token;
        localStorage.setItem('auth_token', this.token);
        return response;
    }

    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        this.token = response.token;
        localStorage.setItem('auth_token', this.token);
        return response;
    }

    // Products
    async getProducts(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/products?${queryString}`);
    }

    async createProduct(productData) {
        return this.request('/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    }

    // Favorites
    async addToFavorites(productId) {
        return this.request(`/favorites/${productId}`, {
            method: 'POST'
        });
    }

    async removeFromFavorites(productId) {
        return this.request(`/favorites/${productId}`, {
            method: 'DELETE'
        });
    }

    async getFavorites() {
        return this.request('/favorites');
    }
}

// Initialize API service
const api = new ApiService();
