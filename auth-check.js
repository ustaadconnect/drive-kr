// Simple Authentication Check for All Pages
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Public pages that don't require authentication
const publicPages = [
    '/',
    '/index.html',
    '/pages/login.html', 
    '/pages/register.html',
    '/pages/support.html',
    '/offline.html'
];

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    
    onAuthStateChanged(auth, (user) => {
        // Check if current page is public
        const isPublicPage = publicPages.some(page => 
            currentPath.endsWith(page) || currentPath === page
        );
        
        // If user is not logged in and trying to access protected page
        if (!user && !isPublicPage) {
            console.log('User not logged in, redirecting to login');
            window.location.href = '/pages/login.html';
            return;
        }
        
        // If user is logged in
        if (user) {
            console.log('User logged in:', user.uid);
            
            // Update user menu if exists
            updateUserMenu(user);
            
            // Redirect from login/register to dashboard if already logged in
            if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
                // Check user type and redirect accordingly
                setTimeout(() => {
                    checkUserTypeAndRedirect(user.uid);
                }, 1000);
            }
        }
    });
});

// Update user menu in navigation
function updateUserMenu(user) {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;
    
    userMenu.innerHTML = `
        <div class="dropdown">
            <button class="btn btn-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
                <i class="fas fa-user-circle"></i> ${user.displayName || 'User'}
            </button>
            <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="/pages/profile.html">
                    <i class="fas fa-user"></i> Profile
                </a></li>
                <li><a class="dropdown-item" href="/pages/wallet.html">
                    <i class="fas fa-wallet"></i> Wallet
                </a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </a></li>
            </ul>
        </div>
    `;
}

// Check user type and redirect to appropriate dashboard
async function checkUserTypeAndRedirect(userId) {
    try {
        // In real app, you would check Firestore for user type
        // For now, check localStorage or default to rider dashboard
        const userType = localStorage.getItem('userType') || 'rider';
        
        if (userType === 'driver') {
            window.location.href = '/pages/driver-dashboard.html';
        } else if (userType === 'admin') {
            window.location.href = '/pages/admin-dashboard.html';
        } else {
            window.location.href = '/pages/dashboard.html';
        }
    } catch (error) {
        console.error('Error checking user type:', error);
        window.location.href = '/pages/dashboard.html';
    }
}

// Logout function
async function logout() {
    try {
        await auth.signOut();
        localStorage.removeItem('userType');
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Make logout function globally available
window.logout = logout;

// Auto-check for PWA install button
function checkPWAInstall() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button if exists
        const installBtn = document.getElementById('installButton');
        const installContainer = document.getElementById('installContainer');
        
        if (installBtn && installContainer) {
            installContainer.style.display = 'block';
            
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('User accepted install');
                    installContainer.style.display = 'none';
                }
                
                deferredPrompt = null;
            });
        }
    });
}

// Initialize on page load
checkPWAInstall();