// Cloud Storage Service using Firebase
class CloudStorageService {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        this.auth = null;
        this.db = null;
        this.storage = null;
    }

    async init() {
        if (!this.config.useCloudStorage) {
            console.log('Cloud storage disabled in config');
            return false;
        }

        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                await this.loadFirebaseSDK();
            }

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.config.firebase);
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            this.isInitialized = true;
            console.log('Cloud storage initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing cloud storage:', error);
            return false;
        }
    }

    async loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // Load Firebase scripts
            const scripts = [
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js',
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js',
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js',
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js'
            ];

            let scriptsLoaded = 0;

            scripts.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                
                script.onload = () => {
                    scriptsLoaded++;
                    if (scriptsLoaded === scripts.length) {
                        resolve();
                    }
                };
                
                script.onerror = (error) => {
                    reject(new Error(`Failed to load Firebase SDK: ${error}`));
                };
                
                document.head.appendChild(script);
            });
        });
    }

    // User Management
    async signUp(email, password, userData) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            // Create user in Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Store additional user data in Firestore
            await this.db.collection('users').doc(user.uid).set({
                ...userData,
                id: user.uid,
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, user: { uid: user.uid, email: user.email, ...userData } };
        } catch (error) {
            console.error('Error during sign up:', error);
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            // Sign in with Firebase Auth
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Get user data from Firestore
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                return { success: true, user: userData };
            } else {
                return { success: false, error: 'User data not found' };
            }
        } catch (error) {
            console.error('Error during sign in:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };
        
        try {
            await this.auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Error during sign out:', error);
            return { success: false, error: error.message };
        }
    }

    // User Profile
    async updateUserProfile(userId, userData) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            await this.db.collection('users').doc(userId).update(userData);
            return { success: true };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getUserProfile(userId) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                return { success: true, profile: userDoc.data() };
            } else {
                return { success: false, error: 'User profile not found' };
            }
        } catch (error) {
            console.error('Error getting user profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Product Listings
    async addListing(listing) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            const listingRef = await this.db.collection('listings').add({
                ...listing,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, listingId: listingRef.id };
        } catch (error) {
            console.error('Error adding listing:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateListing(listingId, listingData) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            await this.db.collection('listings').doc(listingId).update(listingData);
            return { success: true };
        } catch (error) {
            console.error('Error updating listing:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deleteListing(listingId) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            await this.db.collection('listings').doc(listingId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting listing:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getListings(filters = {}) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            let query = this.db.collection('listings');
            
            // Apply filters
            if (filters.userId) {
                query = query.where('sellerId', '==', filters.userId);
            }
            
            if (filters.category) {
                query = query.where('category', '==', filters.category);
            }
            
            // Get listings
            const snapshot = await query.get();
            const listings = [];
            
            snapshot.forEach(doc => {
                listings.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return { success: true, listings };
        } catch (error) {
            console.error('Error getting listings:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Orders
    async addOrder(order) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            const orderRef = await this.db.collection('orders').add({
                ...order,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, orderId: orderRef.id };
        } catch (error) {
            console.error('Error adding order:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getUserOrders(userId) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            const snapshot = await this.db.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
                
            const orders = [];
            
            snapshot.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return { success: true, orders };
        } catch (error) {
            console.error('Error getting user orders:', error);
            return { success: false, error: error.message };
        }
    }
    
    // File Upload (for product images and avatars)
    async uploadFile(file, path) {
        if (!this.isInitialized) await this.init();
        if (!this.isInitialized) return { success: false, error: 'Cloud storage not initialized' };

        try {
            const storageRef = this.storage.ref();
            const fileRef = storageRef.child(path);
            
            await fileRef.put(file);
            const downloadUrl = await fileRef.getDownloadURL();
            
            return { success: true, url: downloadUrl };
        } catch (error) {
            console.error('Error uploading file:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Helper for base64 image uploads
    async uploadBase64Image(base64String, path) {
        // Convert base64 to blob
        const byteString = atob(base64String.split(',')[1]);
        const mimeString = base64String.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([ab], { type: mimeString });
        return this.uploadFile(blob, path);
    }
}

// Initialize the cloud storage service
const cloudStorage = new CloudStorageService(appConfig);
