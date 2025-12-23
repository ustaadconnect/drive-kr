// Firebase Authentication Module
import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// User registration
export async function registerUser(userData) {
    try {
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            userData.email, 
            userData.password
        );
        
        const user = userCredential.user;
        
        // Update user profile
        await updateProfile(user, {
            displayName: userData.fullName
        });
        
        // Save additional user data to Firestore
        const userDoc = {
            uid: user.uid,
            fullName: userData.fullName,
            email: userData.email,
            phone: userData.phone,
            cnic: userData.cnic,
            accountType: userData.accountType,
            status: 'active',
            walletBalance: 0,
            rating: 0,
            totalRides: 0,
            totalSpent: 0,
            totalSaved: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Add driver-specific fields if driver
        if (userData.accountType === 'driver') {
            userDoc.vehicleType = userData.vehicleType;
            userDoc.vehicleNumber = userData.vehicleNumber;
            userDoc.serviceAreas = userData.serviceAreas || [];
            userDoc.onlineStatus = false;
            userDoc.totalEarnings = 0;
            userDoc.completedRides = 0;
            userDoc.verificationStatus = 'pending';
            userDoc.isVerified = false;
            userDoc.documents = {};
        }
        
        // Add location data
        if (userData.city) {
            userDoc.city = userData.city;
            userDoc.area = userData.area;
        }
        
        // Save to Firestore
        await setDoc(doc(db, "users", user.uid), userDoc);
        
        console.log('User registered successfully:', user.uid);
        return { success: true, user: user };
        
    } catch (error) {
        console.error('Registration error:', error);
        return { 
            success: false, 
            error: getErrorMessage(error.code) 
        };
    }
}

// User login
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update last login timestamp
        await updateDoc(doc(db, "users", user.uid), {
            lastLogin: serverTimestamp()
        });
        
        console.log('User logged in:', user.uid);
        return { success: true, user: user };
        
    } catch (error) {
        console.error('Login error:', error);
        return { 
            success: false, 
            error: getErrorMessage(error.code) 
        };
    }
}

// User logout
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log('User logged out');
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Check authentication state
export function checkAuthState(callback) {
    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Get additional user data from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                callback({ 
                    isLoggedIn: true, 
                    user: { ...user, ...userData } 
                });
            } else {
                callback({ isLoggedIn: true, user: user });
            }
        } else {
            callback({ isLoggedIn: false, user: null });
        }
    });
}

// Get current user data
export async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            return { ...user, ...userDoc.data() };
        }
        return user;
    } catch (error) {
        console.error('Error getting user data:', error);
        return user;
    }
}

// Reset password
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: 'Password reset email sent' };
    } catch (error) {
        console.error('Password reset error:', error);
        return { 
            success: false, 
            error: getErrorMessage(error.code) 
        };
    }
}

// Update user profile
export async function updateUserProfile(userId, updates) {
    try {
        await updateDoc(doc(db, "users", userId), {
            ...updates,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: error.message };
    }
}

// Check if user is admin
export async function isAdmin(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            return userDoc.data().role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Error message mapping
function getErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/operation-not-allowed': 'Email/password accounts are not enabled',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/too-many-requests': 'Too many attempts. Try again later',
        'auth/network-request-failed': 'Network error. Check your connection'
    };
    
    return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

// Initialize auth state check for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in and redirect if needed
    const publicPages = ['/index.html', '/pages/login.html', '/pages/register.html', '/'];
    const currentPage = window.location.pathname;
    
    checkAuthState((authState) => {
        // If user is logged in and trying to access login/register, redirect to dashboard
        if (authState.isLoggedIn && 
            (currentPage.includes('login.html') || currentPage.includes('register.html'))) {
            
            const userData = authState.user;
            if (userData.accountType === 'driver') {
                window.location.href = '/pages/driver-dashboard.html';
            } else if (userData.role === 'admin') {
                window.location.href = '/pages/admin-dashboard.html';
            } else {
                window.location.href = '/pages/dashboard.html';
            }
        }
        
        // If user is not logged in and trying to access protected page, redirect to login
        if (!authState.isLoggedIn && 
            !publicPages.some(page => currentPage.includes(page))) {
            window.location.href = '/pages/login.html';
        }
    });
});

// Export for use in HTML files
window.authModule = {
    registerUser,
    loginUser,
    logoutUser,
    checkAuthState,
    getCurrentUserData,
    resetPassword,
    updateUserProfile,
    isAdmin
};