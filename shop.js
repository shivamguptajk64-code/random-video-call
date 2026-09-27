const walletKey = 'vibematch_wallet_coins_v1';
const historyKey = 'vibematch_shop_history_v1';
let walletCoins = Number(localStorage.getItem(walletKey));
if (!Number.isFinite(walletCoins) || walletCoins < 0) walletCoins = 150;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const checkoutModal = $('#checkoutModal');
const historyModal = $('#historyModal');
const pricingModal = $('#pricingModal');
let pendingPurchase = null;
let selectedPayment = 'UPI';
let toastTimer;

function updateWallet() {
    localStorage.setItem(walletKey, String(walletCoins));
    $('#walletCoins').textContent = walletCoins.toLocaleString('en-IN');
    $('#walletCoinsLarge').textContent = walletCoins.toLocaleString('en-IN');
}

function showToast(message) {
    const toast = $('#shopToast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function getHistory() {
    try { return JSON.parse(localStorage.getItem(historyKey) || '[]'); }
    catch (error) { return []; }
}

function addHistory(title, amount) {
    const history = getHistory();
    history.unshift({ title, amount, at: new Date().toISOString() });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 20)));
}

function setModal(modal, open) {
    modal.classList.toggle('show', open);
    modal.setAttribute('aria-hidden', String(!open));
}

function openCheckout(button) {
    pendingPurchase = {
        kind: button.dataset.kind,
        title: button.dataset.title,
        price: Number(button.dataset.price),
        coins: Number(button.dataset.coins || 0)
    };
    $('#checkoutItem').textContent = pendingPurchase.title;
    $('#checkoutPrice').textContent = '₹' + pendingPurchase.price.toLocaleString('en-IN');
    setModal(checkoutModal, true);
}

function spendCoins(button) {
    const cost = Number(button.dataset.cost || 0);
    const title = button.dataset.title || 'Item';
    if (walletCoins < cost) {
        showToast(`You need ${cost - walletCoins} more coins for ${title}.`);
        $('#coin-packs').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    walletCoins -= cost;
    updateWallet();
    addHistory(title, `-${cost} coins`);
    $('#walletCard').classList.add('wallet-focus');
    setTimeout(() => $('#walletCard').classList.remove('wallet-focus'), 750);
    showToast(`${title} activated. ${walletCoins.toLocaleString('en-IN')} coins remaining.`);
}

$$('#shopTabs button').forEach(button => button.addEventListener('click', () => {
    $$('#shopTabs button').forEach(item => item.classList.toggle('active', item === button));
    $('#' + button.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

$$('[data-kind]').forEach(button => button.addEventListener('click', () => {
    button.dataset.kind === 'spend' ? spendCoins(button) : openCheckout(button);
}));

$$('.payment-methods button').forEach(button => button.addEventListener('click', () => {
    $$('.payment-methods button').forEach(item => {
        item.classList.toggle('active', item === button);
        item.querySelector('i:last-child').className = item === button ? 'fas fa-circle-check' : 'far fa-circle';
    });
    selectedPayment = button.dataset.payment;
    $('#confirmPurchase').innerHTML = `Continue with ${selectedPayment} <i class="fas fa-arrow-right"></i>`;
}));

$('#confirmPurchase').addEventListener('click', () => {
    if (!pendingPurchase) return;
    const purchase = { ...pendingPurchase };
    const payButton = $('#confirmPurchase');
    payButton.disabled = true;
    payButton.textContent = 'Processing securely…';
    setTimeout(() => {
        if (purchase.kind === 'coins') {
            walletCoins += purchase.coins;
            updateWallet();
        } else {
            localStorage.setItem('vibematch_active_plan_v1', JSON.stringify({ name: purchase.title, activatedAt: new Date().toISOString() }));
        }
        addHistory(purchase.title, `₹${purchase.price}`);
        setModal(checkoutModal, false);
        pendingPurchase = null;
        payButton.disabled = false;
        payButton.innerHTML = `Continue with ${selectedPayment} <i class="fas fa-arrow-right"></i>`;
        showToast(purchase.kind === 'coins' ? `${purchase.coins.toLocaleString('en-IN')} coins added to your wallet.` : `${purchase.title} is now active.`);
    }, 700);
});

function renderHistory() {
    const history = getHistory();
    $('#historyList').innerHTML = history.length ? history.map(item => `<div class="history-item"><span><b>${item.title}</b><small>${new Date(item.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></span><strong>${item.amount}</strong></div>`).join('') : '<p class="empty-history">No purchases yet. Recent orders will appear here.</p>';
}

$('#viewWallet').addEventListener('click', () => $('#walletCard').scrollIntoView({ behavior: 'smooth', block: 'center' }));
$('#walletHistory').addEventListener('click', () => { renderHistory(); setModal(historyModal, true); });
$('#trustCheckout').addEventListener('click', () => {
    $('#coin-packs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Choose a coin pack or VIP plan to continue to secure checkout.');
});
$('#trustPricing').addEventListener('click', () => {
    setModal(pricingModal, true);
});
$('#viewCoinPricing').addEventListener('click', () => {
    setModal(pricingModal, false);
    $('#coin-packs').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#checkoutClose').addEventListener('click', () => { setModal(checkoutModal, false); pendingPurchase = null; });
$('#historyClose').addEventListener('click', () => setModal(historyModal, false));
$('#pricingClose').addEventListener('click', () => setModal(pricingModal, false));
[checkoutModal, historyModal, pricingModal].forEach(modal => modal.addEventListener('pointerdown', event => { if (event.target === modal) setModal(modal, false); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') { setModal(checkoutModal, false); setModal(historyModal, false); setModal(pricingModal, false); } });

updateWallet();
