// Wallet Management Module
import { auth, db } from './firebase-config.js';
import { 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Get wallet balance
export async function getWalletBalance(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.walletBalance || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        return 0;
    }
}

// Add funds to wallet
export async function addFunds(userId, amount, paymentMethod, transactionId) {
    try {
        const transactionData = {
            userId: userId,
            type: 'deposit',
            amount: parseFloat(amount),
            paymentMethod: paymentMethod,
            transactionId: transactionId,
            status: 'pending', // Will be updated by admin
            screenshotUrl: '', // Will be added by user
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Add transaction record
        const transactionRef = await addDoc(collection(db, "transactions"), transactionData);
        
        // Send WhatsApp notification to admin
        sendPaymentNotification(userId, amount, paymentMethod, transactionRef.id);
        
        return { 
            success: true, 
            transactionId: transactionRef.id,
            message: 'Deposit request submitted. Share screenshot via WhatsApp for verification.'
        };
        
    } catch (error) {
        console.error('Error adding funds:', error);
        return { success: false, error: error.message };
    }
}

// Request withdrawal
export async function requestWithdrawal(userId, amount, method, accountNumber) {
    try {
        const balance = await getWalletBalance(userId);
        
        if (balance < amount) {
            return { 
                success: false, 
                error: 'Insufficient balance' 
            };
        }
        
        if (amount < 500) {
            return { 
                success: false, 
                error: 'Minimum withdrawal amount is Rs 500' 
            };
        }
        
        const transactionData = {
            userId: userId,
            type: 'withdrawal',
            amount: parseFloat(amount),
            withdrawalMethod: method,
            accountNumber: accountNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Add withdrawal request
        const transactionRef = await addDoc(collection(db, "transactions"), transactionData);
        
        // Deduct from wallet immediately (will be reversed if rejected)
        await updateDoc(doc(db, "users", userId), {
            walletBalance: balance - amount
        });
        
        return { 
            success: true, 
            transactionId: transactionRef.id,
            message: 'Withdrawal request submitted. It will be processed within 24-48 hours.'
        };
        
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        return { success: false, error: error.message };
    }
}

// Get transaction history
export async function getTransactionHistory(userId, limit = 50) {
    try {
        const transactionsQuery = query(
            collection(db, "transactions"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(transactionsQuery);
        const transactions = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            });
        });
        
        return transactions;
        
    } catch (error) {
        console.error('Error getting transaction history:', error);
        return [];
    }
}

// Get transaction stats
export async function getTransactionStats(userId) {
    try {
        const transactions = await getTransactionHistory(userId);
        
        const stats = {
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalRidePayments: 0,
            totalCommission: 0,
            recentTransactions: transactions.slice(0, 10)
        };
        
        transactions.forEach(transaction => {
            if (transaction.type === 'deposit' && transaction.status === 'approved') {
                stats.totalDeposits += transaction.amount;
            } else if (transaction.type === 'withdrawal' && transaction.status === 'approved') {
                stats.totalWithdrawals += transaction.amount;
            } else if (transaction.type === 'ride_payment') {
                stats.totalRidePayments += transaction.amount;
            } else if (transaction.type === 'commission') {
                stats.totalCommission += transaction.amount;
            }
        });
        
        return stats;
        
    } catch (error) {
        console.error('Error getting transaction stats:', error);
        return {
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalRidePayments: 0,
            totalCommission: 0,
            recentTransactions: []
        };
    }
}

// Process ride payment (for completed rides)
export async function processRidePayment(rideId, riderId, driverId, amount) {
    try {
        const commission = amount * 0.15; // 15% commission
        const driverEarnings = amount - commission;
        
        // Get current balances
        const riderDoc = await getDoc(doc(db, "users", riderId));
        const driverDoc = await getDoc(doc(db, "users", driverId));
        
        const riderBalance = riderDoc.data().walletBalance || 0;
        const driverBalance = driverDoc.data().walletBalance || 0;
        
        // Update rider balance (deduct amount)
        await updateDoc(doc(db, "users", riderId), {
            walletBalance: riderBalance - amount,
            totalSpent: (riderDoc.data().totalSpent || 0) + amount
        });
        
        // Update driver balance (add earnings)
        await updateDoc(doc(db, "users", driverId), {
            walletBalance: driverBalance + driverEarnings,
            totalEarnings: (driverDoc.data().totalEarnings || 0) + driverEarnings
        });
        
        // Create transaction records
        const transactions = [
            // Rider payment
            {
                userId: riderId,
                type: 'ride_payment',
                amount: amount,
                rideId: rideId,
                description: `Ride payment for ${rideId}`,
                status: 'completed',
                createdAt: serverTimestamp()
            },
            // Driver earnings
            {
                userId: driverId,
                type: 'ride_earning',
                amount: driverEarnings,
                rideId: rideId,
                description: `Earnings from ride ${rideId}`,
                status: 'completed',
                createdAt: serverTimestamp()
            },
            // Commission
            {
                userId: 'platform',
                type: 'commission',
                amount: commission,
                rideId: rideId,
                description: `Commission from ride ${rideId}`,
                status: 'completed',
                createdAt: serverTimestamp()
            }
        ];
        
        // Save all transactions
        for (const transaction of transactions) {
            await addDoc(collection(db, "transactions"), transaction);
        }
        
        return { 
            success: true, 
            riderEarnings: -amount,
            driverEarnings: driverEarnings,
            commission: commission 
        };
        
    } catch (error) {
        console.error('Error processing ride payment:', error);
        return { success: false, error: error.message };
    }
}

// Send payment notification to admin via WhatsApp link
function sendPaymentNotification(userId, amount, method, transactionId) {
    const adminNumber = '923229814170'; // Admin WhatsApp number
    const message = `New Payment Request\n\nUser ID: ${userId}\nAmount: Rs ${amount}\nMethod: ${method}\nTransaction ID: ${transactionId}\n\nPlease verify and approve.`;
    
    // Create WhatsApp URL (user will need to click and send)
    const whatsappUrl = `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
    
    // Store this URL for user to click
    localStorage.setItem('whatsappPaymentUrl', whatsappUrl);
    console.log('WhatsApp payment notification URL created:', whatsappUrl);
}

// Initialize wallet on page load
export async function initializeWallet() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const balance = await getWalletBalance(user.uid);
        const stats = await getTransactionStats(user.uid);
        const transactions = await getTransactionHistory(user.uid, 10);
        
        return {
            balance: balance,
            stats: stats,
            transactions: transactions
        };
        
    } catch (error) {
        console.error('Error initializing wallet:', error);
        return null;
    }
}

// Export for use in HTML files
window.walletModule = {
    getWalletBalance,
    addFunds,
    requestWithdrawal,
    getTransactionHistory,
    getTransactionStats,
    processRidePayment,
    initializeWallet
};

// Auto-initialize on wallet pages
if (window.location.pathname.includes('wallet.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        const walletData = await initializeWallet();
        if (walletData) {
            // Update UI elements
            const balanceElement = document.getElementById('balanceAmount');
            const totalDepositsElement = document.getElementById('totalDeposits');
            const totalWithdrawalsElement = document.getElementById('totalWithdrawals');
            const ridePaymentsElement = document.getElementById('ridePayments');
            const totalCommissionElement = document.getElementById('totalCommission');
            const transactionsList = document.getElementById('transactionsList');
            
            if (balanceElement) balanceElement.textContent = `Rs ${walletData.balance.toFixed(2)}`;
            if (totalDepositsElement) totalDepositsElement.textContent = `Rs ${walletData.stats.totalDeposits}`;
            if (totalWithdrawalsElement) totalWithdrawalsElement.textContent = `Rs ${walletData.stats.totalWithdrawals}`;
            if (ridePaymentsElement) ridePaymentsElement.textContent = `Rs ${walletData.stats.totalRidePayments}`;
            if (totalCommissionElement) totalCommissionElement.textContent = `Rs ${walletData.stats.totalCommission}`;
            
            // Update transactions list
            if (transactionsList && walletData.transactions.length > 0) {
                transactionsList.innerHTML = '';
                walletData.transactions.forEach(transaction => {
                    transactionsList.appendChild(createTransactionElement(transaction));
                });
            }
        }
    });
}

// Create transaction element for UI
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = `transaction-card ${transaction.type} p-3 mb-2`;
    
    const typeIcons = {
        'deposit': 'fas fa-plus-circle text-success',
        'withdrawal': 'fas fa-minus-circle text-danger',
        'ride_payment': 'fas fa-car text-primary',
        'ride_earning': 'fas fa-money-bill-wave text-success',
        'commission': 'fas fa-percentage text-warning'
    };
    
    const typeLabels = {
        'deposit': 'Deposit',
        'withdrawal': 'Withdrawal',
        'ride_payment': 'Ride Payment',
        'ride_earning': 'Ride Earnings',
        'commission': 'Commission'
    };
    
    const statusBadges = {
        'pending': 'badge bg-warning',
        'approved': 'badge bg-success',
        'rejected': 'badge bg-danger',
        'completed': 'badge bg-info'
    };
    
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <i class="${typeIcons[transaction.type] || 'fas fa-exchange-alt'}"></i>
                <strong>${typeLabels[transaction.type] || transaction.type}</strong>
                <small class="text-muted d-block">
                    ${transaction.description || ''}
                    ${transaction.transactionId ? `<br>ID: ${transaction.transactionId.substring(0, 8)}...` : ''}
                </small>
            </div>
            <div class="text-end">
                <h5 class="mb-1 ${transaction.type === 'deposit' || transaction.type === 'ride_earning' ? 'text-success' : 'text-danger'}">
                    ${transaction.type === 'deposit' || transaction.type === 'ride_earning' ? '+' : '-'}Rs ${transaction.amount}
                </h5>
                <small class="text-muted d-block">
                    ${transaction.createdAt.toLocaleDateString()}
                </small>
                <span class="${statusBadges[transaction.status] || 'badge bg-secondary'}">
                    ${transaction.status}
                </span>
            </div>
        </div>
    `;
    
    return div;
}