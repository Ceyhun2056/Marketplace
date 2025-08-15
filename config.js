// Application Configuration
const appConfig = {
    // When true, the app will attempt to use cloud storage (Firebase)
    // When false, it will fall back to localStorage only
    useCloudStorage: true,
    
    // Firebase configuration
    firebase: {
        apiKey: "YOUR_API_KEY", // Replace with your Firebase API key
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "your-sender-id",
        appId: "your-app-id"
    }
};
