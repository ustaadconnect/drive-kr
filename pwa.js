// Progressive Web App Installation and Service Worker
class DriveKarPWA {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = document.getElementById('installButton');
        this.installContainer = document.getElementById('installContainer');
        
        this.init();
    }
    
    init() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Show install button
            this.showInstallButton();
        });
        
        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallButton();
            this.deferredPrompt = null;
            
            // Track installation
            this.trackInstallation();
        });
        
        // Check if app is already installed
        this.checkIfInstalled();
        
        // Register service worker
        this.registerServiceWorker();
        
        // Initialize install button if exists
        if (this.installButton) {
            this.installButton.addEventListener('click', () => this.installApp());
        }
    }
    
    showInstallButton() {
        if (this.installContainer) {
            this.installContainer.style.display = 'block';
            
            // Auto-hide after 30 seconds
            setTimeout(() => {
                if (this.installContainer) {
                    this.installContainer.style.display = 'none';
                }
            }, 30000);
        }
    }
    
    hideInstallButton() {
        if (this.installContainer) {
            this.installContainer.style.display = 'none';
        }
    }
    
    async installApp() {
        if (!this.deferredPrompt) {
            console.log('Install prompt not available');
            return;
        }
        
        try {
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.hideInstallButton();
            } else {
                console.log('User dismissed the install prompt');
            }
            
            // Clear the deferredPrompt variable
            this.deferredPrompt = null;
            
        } catch (error) {
            console.error('Error during installation:', error);
        }
    }
    
    checkIfInstalled() {
        // Check if running as standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            console.log('Running as PWA');
            this.hideInstallButton();
            return true;
        }
        return false;
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        console.log('New service worker state:', newWorker.state);
                        
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New update available
                            this.showUpdateNotification();
                        }
                    });
                });
                
                return registration;
            } catch (error) {
                console.error('ServiceWorker registration failed: ', error);
                return null;
            }
        }
        return null;
    }
    
    showUpdateNotification() {
        // Show update notification to user
        if (confirm('A new version of DriveKar is available. Reload to update?')) {
            window.location.reload();
        }
    }
    
    trackInstallation() {
        // Track installation in analytics
        console.log('PWA installation tracked');
        
        // You can add analytics tracking here
        // Example: firebase analytics, google analytics, etc.
    }
    
    // Utility function to check connectivity
    checkConnectivity() {
        return navigator.onLine;
    }
    
    // Show offline message
    showOfflineMessage() {
        if (!this.checkConnectivity()) {
            const offlineMessage = document.createElement('div');
            offlineMessage.id = 'offlineMessage';
            offlineMessage.innerHTML = `
                <div class="alert alert-warning text-center m-0 rounded-0">
                    <i class="fas fa-wifi-slash"></i> You are offline. Some features may not work.
                </div>
            `;
            document.body.prepend(offlineMessage);
        }
    }
    
    // Hide offline message
    hideOfflineMessage() {
        const offlineMessage = document.getElementById('offlineMessage');
        if (offlineMessage) {
            offlineMessage.remove();
        }
    }
    
    // Initialize connectivity monitoring
    initConnectivityMonitoring() {
        window.addEventListener('online', () => {
            console.log('App is online');
            this.hideOfflineMessage();
        });
        
        window.addEventListener('offline', () => {
            console.log('App is offline');
            this.showOfflineMessage();
        });
        
        // Initial check
        if (!this.checkConnectivity()) {
            this.showOfflineMessage();
        }
    }
}

// Initialize PWA when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.drivekarPWA = new DriveKarPWA();
    window.drivekarPWA.initConnectivityMonitoring();
});

// Export for module usage
export default DriveKarPWA;