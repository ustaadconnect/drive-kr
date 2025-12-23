// Admin Management Module
import { auth, db } from './firebase-config.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Get all users
export async function getAllUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const users = [];
        
        usersSnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return users;
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// Get all rides
export async function getAllRides() {
    try {
        const ridesSnapshot = await getDocs(collection(db, "rides"));
        const rides = [];
        
        ridesSnapshot.forEach((doc) => {
            rides.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return rides;
    } catch (error) {
        console.error('Error getting rides:', error);
        return [];
    }
}

// Get pending transactions
export async function getPendingTransactions() {
    try {
        const transactionsQuery = query(
            collection(db, "transactions"),
            where("status", "==", "pending"),
            orderBy("createdAt", "desc")
        );
        
        const snapshot = await getDocs(transactionsQuery);
        const transactions = [];
        
        snapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return transactions;
    } catch (error) {
        console.error('Error getting pending transactions:', error);
        return [];
    }
}

// Get pending document verifications
export async function getPendingDocumentVerifications() {
    try {
        const usersQuery = query(
            collection(db, "users"),
            where("accountType", "==", "driver"),
            where("verificationStatus", "==", "pending")
        );
        
        const snapshot = await getDocs(usersQuery);
        const drivers = [];
        
        snapshot.forEach((doc) => {
            drivers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return drivers;
    } catch (error) {
        console.error('Error getting pending verifications:', error);
        return [];
    }
}

// Approve transaction
export async function approveTransaction(transactionId, adminId) {
    try {
        const transactionRef = doc(db, "transactions", transactionId);
        const transactionDoc = await getDoc(transactionRef);
        
        if (!transactionDoc.exists()) {
            return { success: false, error: 'Transaction not found' };
        }
        
        const transaction = transactionDoc.data();
        
        // Update transaction status
        await updateDoc(transactionRef, {
            status: 'approved',
            verifiedAt: serverTimestamp(),
            verifiedBy: adminId
        });
        
        // If it's a deposit, update user's wallet balance
        if (transaction.type === 'deposit') {
            const userRef = doc(db, "users", transaction.userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const newBalance = (userData.walletBalance || 0) + transaction.amount;
                
                await updateDoc(userRef, {
                    walletBalance: newBalance
                });
            }
        }
        
        // Send WhatsApp notification to user
        sendApprovalNotification(transaction.userId, transaction.amount, 'transaction');
        
        return { success: true };
        
    } catch (error) {
        console.error('Error approving transaction:', error);
        return { success: false, error: error.message };
    }
}

// Reject transaction
export async function rejectTransaction(transactionId, reason, adminId) {
    try {
        const transactionRef = doc(db, "transactions", transactionId);
        
        await updateDoc(transactionRef, {
            status: 'rejected',
            rejectionReason: reason,
            verifiedAt: serverTimestamp(),
            verifiedBy: adminId
        });
        
        // Send WhatsApp notification to user
        const transactionDoc = await getDoc(transactionRef);
        if (transactionDoc.exists()) {
            const transaction = transactionDoc.data();
            sendRejectionNotification(transaction.userId, reason, 'transaction');
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('Error rejecting transaction:', error);
        return { success: false, error: error.message };
    }
}

// Approve driver documents
export async function approveDriverDocuments(userId, adminId) {
    try {
        const userRef = doc(db, "users", userId);
        
        await updateDoc(userRef, {
            verificationStatus: 'approved',
            isVerified: true,
            verifiedAt: serverTimestamp(),
            verifiedBy: adminId
        });
        
        // Update all document statuses
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const documents = userData.documents || {};
            
            for (const [key, docInfo] of Object.entries(documents)) {
                documents[key] = {
                    ...docInfo,
                    status: 'approved',
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: adminId
                };
            }
            
            await updateDoc(userRef, { documents });
        }
        
        // Send WhatsApp notification to driver
        sendApprovalNotification(userId, null, 'documents');
        
        return { success: true };
        
    } catch (error) {
        console.error('Error approving driver documents:', error);
        return { success: false, error: error.message };
    }
}

// Reject driver documents
export async function rejectDriverDocuments(userId, reason, adminId) {
    try {
        const userRef = doc(db, "users", userId);
        
        await updateDoc(userRef, {
            verificationStatus: 'rejected',
            rejectionReason: reason,
            verifiedAt: serverTimestamp(),
            verifiedBy: adminId
        });
        
        // Send WhatsApp notification to driver
        sendRejectionNotification(userId, reason, 'documents');
        
        return { success: true };
        
    } catch (error) {
        console.error('Error rejecting driver documents:', error);
        return { success: false, error: error.message };
    }
}

// Block user
export async function blockUser(userId, reason, adminId) {
    try {
        const userRef = doc(db, "users", userId);
        
        await updateDoc(userRef, {
            status: 'blocked',
            blockedAt: serverTimestamp(),
            blockedBy: adminId,
            blockReason: reason
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error blocking user:', error);
        return { success: false, error: error.message };
    }
}

// Unblock user
export async function unblockUser(userId, adminId) {
    try {
        const userRef = doc(db, "users", userId);
        
        await updateDoc(userRef, {
            status: 'active',
            unblockedAt: serverTimestamp(),
            unblockedBy: adminId
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error unblocking user:', error);
        return { success: false, error: error.message };
    }
}

// Get platform statistics
export async function getPlatformStats() {
    try {
        const [
            usersSnapshot,
            ridesSnapshot,
            driversSnapshot,
            transactionsSnapshot
        ] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(query(collection(db, "rides"), where("status", "==", "completed"))),
            getDocs(query(collection(db, "users"), where("accountType", "==", "driver"))),
            getDocs(query(collection(db, "transactions"), where("status", "==", "approved")))
        ]);
        
        let totalEarnings = 0;
        transactionsSnapshot.forEach(doc => {
            const transaction = doc.data();
            if (transaction.type === 'commission') {
                totalEarnings += transaction.amount;
            }
        });
        
        return {
            totalUsers: usersSnapshot.size,
            totalRides: ridesSnapshot.size,
            totalDrivers: driversSnapshot.size,
            totalEarnings: totalEarnings,
            pendingVerifications: driversSnapshot.docs.filter(doc => 
                doc.data().verificationStatus === 'pending'
            ).length,
            pendingTransactions: transactionsSnapshot.docs.filter(doc => 
                doc.data().status === 'pending'
            ).length
        };
        
    } catch (error) {
        console.error('Error getting platform stats:', error);
        return {
            totalUsers: 0,
            totalRides: 0,
            totalDrivers: 0,
            totalEarnings: 0,
            pendingVerifications: 0,
            pendingTransactions: 0
        };
    }
}

// Send broadcast message to all users
export async function sendBroadcastMessage(message, adminId) {
    try {
        // Get all users
        const usersSnapshot = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        
        // Create notification for each user
        usersSnapshot.forEach((userDoc) => {
            const notificationRef = doc(collection(db, "notifications"));
            batch.set(notificationRef, {
                userId: userDoc.id,
                type: 'broadcast',
                title: 'Admin Broadcast',
                message: message,
                read: false,
                createdAt: serverTimestamp(),
                sentBy: adminId
            });
        });
        
        await batch.commit();
        
        // Also send WhatsApp to active users
        sendBroadcastWhatsApp(message);
        
        return { success: true, message: `Broadcast sent to ${usersSnapshot.size} users` };
        
    } catch (error) {
        console.error('Error sending broadcast:', error);
        return { success: false, error: error.message };
    }
}

// Send approval notification via WhatsApp
function sendApprovalNotification(userId, amount, type) {
    const adminNumber = '923229814170';
    let message = '';
    
    if (type === 'transaction') {
        message = `Your transaction of Rs ${amount} has been approved. Your wallet has been updated.`;
    } else if (type === 'documents') {
        message = `Your driver documents have been approved! You can now go online and accept rides.`;
    }
    
    const whatsappUrl = `https://wa.me/${getUserPhone(userId)}?text=${encodeURIComponent(message)}`;
    console.log('Approval WhatsApp URL:', whatsappUrl);
    // In real app, you would open this URL or use WhatsApp API
}

// Send rejection notification via WhatsApp
function sendRejectionNotification(userId, reason, type) {
    let message = '';
    
    if (type === 'transaction') {
        message = `Your transaction has been rejected. Reason: ${reason}. Please contact support for more information.`;
    } else if (type === 'documents') {
        message = `Your document verification has been rejected. Reason: ${reason}. Please upload correct documents and try again.`;
    }
    
    const whatsappUrl = `https://wa.me/${getUserPhone(userId)}?text=${encodeURIComponent(message)}`;
    console.log('Rejection WhatsApp URL:', whatsappUrl);
}

// Send broadcast WhatsApp
function sendBroadcastWhatsApp(message) {
    // This would typically use WhatsApp Business API
    // For now, log the message
    console.log('Broadcast message:', message);
    console.log('This would be sent to all active users via WhatsApp');
}

// Get user phone number (placeholder)
function getUserPhone(userId) {
    // In real app, get from Firestore
    return '923001234567'; // Placeholder
}

// Export for use in HTML files
window.adminModule = {
    getAllUsers,
    getAllRides,
    getPendingTransactions,
    getPendingDocumentVerifications,
    approveTransaction,
    rejectTransaction,
    approveDriverDocuments,
    rejectDriverDocuments,
    blockUser,
    unblockUser,
    getPlatformStats,
    sendBroadcastMessage
};