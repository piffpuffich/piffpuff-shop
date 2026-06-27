const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { Telegraf } = require('telegraf');

// ТОКЕН БОТА ДЛЯ УВЕДОМЛЕНИЙ (создали в ШАГЕ 1)
const NOTIFY_BOT_TOKEN = '8917717243:AAGa2gUGpPXHuEE-ZDhpNdfHOZ0k_a9zSUA';

// ID чата, куда отправлять уведомления (твой Telegram ID)
// Узнать можно у бота @userinfobot
const CHAT_ID = '8395485499'; // Например: 123456789

// Создаём бота для уведомлений
const notifyBot = new Telegraf(NOTIFY_BOT_TOKEN);

console.log('🚀 Запуск Piff&Puff Shop сервера...');

// ========== НАСТРОЙКИ ==========
// ТОВАРЫ
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4NasjkziFFrgdzsm-KeYrgnfB_--B5zYwZQPvKvThqsk-w6b_NrTkKvvVF27JT8Cyl9I-DLTcSDG4/pub?gid=0&single=true&output=csv';

// КЭШБЭК (URL твоей таблицы с балансами)
const CASHBACK_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSiOF1m5JwHgEL3ygZSk0r2jJaIU0KW6eu0Z9PckSpRudtN22PnDZWFal7zBV72ZfBy7GMnIt_GStGY/pub?gid=0&single=true&output=csv';

// ========== КЭШ ==========
let productsCache = [];
let cashbackCache = {};
let lastUpdateProducts = 0;
let lastUpdateCashback = 0;
const CACHE_TIME = 60000; // 1 минута

// ========== ЗАГРУЗКА ТОВАРОВ ==========
async function loadProductsFromGoogle() {
    try {
        console.log('📊 Загружаем товары...');
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const products = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, index) => { row[h] = values[index] || ''; });
            if (row.name && row.name !== '') {
                let options = [];
                if (row.options && row.options !== '') {
                    options = row.options.split(',').map(o => o.trim());
                }
                products.push({
                    id: parseInt(row.id) || i,
                    name: row.name,
                    price: parseInt(row.price) || 0,
                    category: row.category || 'Другое',
                    emoji: row.emoji || '📦',
                    description: row.description || '',
                    options: options
                });
            }
        }
        console.log(`✅ Загружено ${products.length} товаров`);
        return products;
    } catch (error) {
        console.error('❌ Ошибка загрузки товаров:', error.message);
        return productsCache;
    }
}

// ========== ЗАГРУЗКА КЭШБЭКА ==========
async function loadCashbackFromGoogle() {
    try {
        console.log('💰 Загружаем кэшбэк...');
        const response = await fetch(CASHBACK_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return {};
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const cashback = {};
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, index) => { row[h] = values[index] || ''; });
            if (row.user_id) {
                cashback[row.user_id] = {
                    username: row.username || '',
                    balance: parseInt(row.balance) || 0
                };
            }
        }
        console.log(`✅ Загружено ${Object.keys(cashback).length} пользователей`);
        return cashback;
    } catch (error) {
        console.error('❌ Ошибка загрузки кэшбэка:', error.message);
        return cashbackCache;
    }
}

// ========== СОХРАНЕНИЕ КЭШБЭКА В ТАБЛИЦУ ==========
async function saveCashbackToGoogle(userId, username, balance) {
    // ВНИМАНИЕ: Это заглушка. Google Sheets API для записи требует авторизации.
    // Для простоты мы будем обновлять кэш, а вручную раз в день обновлять таблицу.
    // Позже я покажу, как подключить Google Sheets API для автоматической записи.
    console.log(`💾 Сохраняем кэшбэк: ${username} (${userId}) → ${balance} ₽`);
    // Пока просто обновляем кэш
    if (!cashbackCache[userId]) {
        cashbackCache[userId] = { username, balance: 0 };
    }
    cashbackCache[userId].balance = balance;
    return true;
}

// ========== API ==========

// Получить товары
app.get('/api/products', async (req, res) => {
    const now = Date.now();
    if (now - lastUpdateProducts > CACHE_TIME || productsCache.length === 0) {
        productsCache = await loadProductsFromGoogle();
        lastUpdateProducts = now;
    }
    res.json(productsCache);
});

// Получить баланс кэшбэка
app.get('/api/cashback/:userId', async (req, res) => {
    const userId = req.params.userId;
    const now = Date.now();
    
    if (now - lastUpdateCashback > CACHE_TIME || Object.keys(cashbackCache).length === 0) {
        cashbackCache = await loadCashbackFromGoogle();
        lastUpdateCashback = now;
    }
    
    const userData = cashbackCache[userId] || { balance: 0, username: '' };
    const balance = userData.balance || 0;
    const canSpend = Math.floor(balance / 500) * 500;
    
    res.json({
        balance: balance,
        canSpend: canSpend,
        username: userData.username || ''
    });
});

// Списать кэшбэк (при использовании)
app.post('/api/cashback/spend', async (req, res) => {
    const { userId, amount } = req.body;
    const now = Date.now();
    
    if (now - lastUpdateCashback > CACHE_TIME || Object.keys(cashbackCache).length === 0) {
        cashbackCache = await loadCashbackFromGoogle();
        lastUpdateCashback = now;
    }
    
    if (!cashbackCache[userId]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const currentBalance = cashbackCache[userId].balance || 0;
    if (amount > currentBalance) {
        return res.status(400).json({ error: 'Недостаточно средств' });
    }
    
    const newBalance = currentBalance - amount;
    cashbackCache[userId].balance = newBalance;
    
    // Здесь нужно записать в Google Таблицу (пока просто логируем)
    console.log(`💰 Списано ${amount} ₽ у ${cashbackCache[userId].username}. Остаток: ${newBalance} ₽`);
    
    res.json({ success: true, newBalance: newBalance });
});

// Начислить кэшбэк (после заказа)
app.post('/api/cashback/add', async (req, res) => {
    const { userId, username, orderTotal } = req.body;
    const cashbackAmount = Math.floor(orderTotal * 0.1); // 10%
    
    const now = Date.now();
    if (now - lastUpdateCashback > CACHE_TIME || Object.keys(cashbackCache).length === 0) {
        cashbackCache = await loadCashbackFromGoogle();
        lastUpdateCashback = now;
    }
    
    if (!cashbackCache[userId]) {
        cashbackCache[userId] = { username: username || 'user', balance: 0 };
    }
    
    cashbackCache[userId].balance = (cashbackCache[userId].balance || 0) + cashbackAmount;
    cashbackCache[userId].username = username || cashbackCache[userId].username;
    
    console.log(`💰 Начислено ${cashbackAmount} ₽ пользователю ${cashbackCache[userId].username}. Баланс: ${cashbackCache[userId].balance} ₽`);
    
    res.json({ success: true, newBalance: cashbackCache[userId].balance });
});

// Принять заказ и отправить уведомление в Telegram
app.post('/api/order', async (req, res) => {
    const { 
        items, 
        subtotal, 
        delivery, 
        total, 
        phone, 
        address, 
        change, 
        notes, 
        userId, 
        username 
    } = req.body;
    
    // Формируем текст заказа для уведомления
    let itemsText = '';
    items.forEach(item => {
        const optionText = item.option ? `: ${item.option}` : '';
        itemsText += `${item.name}${optionText} (1 шт. x ${item.price} тг)\n`;
    });
    
    const deliveryText = delivery === 0 ? 'Бесплатно' : `${delivery} тг`;
    const changeText = change && change !== 'Не требуется' ? change : 'Не требуется';
    const notesText = notes && notes !== 'Нет' ? notes : 'Нет';
    
    // Текст для уведомления в Telegram
    const message = 
        `🛒 Оформлен новый заказ!\n\n` +
        `👤 Клиент: @${username || userId}\n` +
        `📍 Адрес доставки: ${address}\n` +
        `📞 Контактный телефон: ${phone}\n` +
        `🔄 Сдача с: ${changeText}\n` +
        `📝 Дополнительные пожелания: ${notesText}\n\n` +
        `💰 Сумма заказа: ${subtotal} тг\n` +
        `🚚 Доставка: ${deliveryText}\n` +
        `📦 Итого: ${total} тг\n\n` +
        `📦 Товары:\n${itemsText}\n` +
        `🕐 ${new Date().toLocaleString()}`;
    
    // Логируем в консоль
    console.log('🛒 НОВЫЙ ЗАКАЗ!');
    console.log(message);
    console.log('-------------------');
    
    // Отправляем уведомление в Telegram
    try {
        await notifyBot.telegram.sendMessage(CHAT_ID, message);
        console.log('✅ Уведомление отправлено в Telegram');
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления:', error.message);
        // Не прерываем выполнение, если уведомление не отправилось
    }
    
    res.json({ 
        success: true, 
        message: 'Заказ принят!',
        order: { total, phone, address }
    });
});

// Статика
app.use(express.static('public'));

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🟢 Сервер запущен на http://localhost:${PORT}`);
    productsCache = await loadProductsFromGoogle();
    lastUpdateProducts = Date.now();
    cashbackCache = await loadCashbackFromGoogle();
    lastUpdateCashback = Date.now();
    console.log(`📦 ${productsCache.length} товаров, ${Object.keys(cashbackCache).length} пользователей в кэше`);
    console.log('✅ Магазин готов к работе!');
});