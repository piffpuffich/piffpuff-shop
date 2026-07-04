const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { Telegraf } = require('telegraf');

// ТОКЕН БОТА ДЛЯ УВЕДОМЛЕНИЙ
const NOTIFY_BOT_TOKEN = '8917717243:AAGa2gUGpPXHuEE-ZDhpNdfHOZ0k_a9zSUA';

// ID чата (твой Telegram ID)
const CHAT_ID = '8395485499';

// ТОКЕН БОТА-МАГАЗИНА (основного, через который клиент открывает магазин)
const MAIN_BOT_TOKEN = '8704731828:AAHc8SWFVq0o8GIjovL4HjlPOZJ91rBuN0w';

// ID КАНАЛА
const CHANNEL_ID = '-1003640998264';

// Создаём ботов
const notifyBot = new Telegraf(NOTIFY_BOT_TOKEN);
const mainBot = new Telegraf(MAIN_BOT_TOKEN);

console.log('🚀 Запуск Piff&Puff Shop сервера...');

// ========== НАСТРОЙКИ ==========
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4NasjkziFFrgdzsm-KeYrgnfB_--B5zYwZQPvKvThqsk-w6b_NrTkKvvVF27JT8Cyl9I-DLTcSDG4/pub?gid=0&single=true&output=csv';
const CASHBACK_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSiOF1m5JwHgEL3ygZSk0r2jJaIU0KW6eu0Z9PckSpRudtN22PnDZWFal7zBV72ZfBy7GMnIt_GStGY/pub?gid=0&single=true&output=csv';

// ========== КЭШ ==========
let productsCache = [];
let cashbackCache = {};
let lastUpdateProducts = 0;
let lastUpdateCashback = 0;
const CACHE_TIME = 60000;

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПАРСИНГА CSV ==========
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

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
        console.log('📋 Заголовки таблицы:', headers);
        
        const products = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((h, index) => {
                row[h] = (values[index] || '').trim();
            });
            
            if (row.name && row.name !== '') {
                let options = [];
                if (row.options && row.options !== '') {
                    options = row.options
                        .split(',')
                        .map(o => o.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
                        .filter(o => o !== '');
                }
                
                products.push({
                    id: parseInt(row.id) || i,
                    name: row.name,
                    price: parseInt(row.price) || 0,
                    category: row.category || 'Другое',
                    image: row.image || '', // ← вместо emoji
                    description: row.description || '',
                    options: options
                });
            }
        }
        console.log(`✅ Загружено ${products.length} товаров`);
        
        const withOptions = products.filter(p => p.options && p.options.length > 0);
        if (withOptions.length > 0) {
            console.log(`📋 Товары с опциями: ${withOptions.length}`);
            console.log('📋 Пример:', withOptions[0].name, '→', withOptions[0].options);
        }
        const withImages = products.filter(p => p.image && p.image !== '');
        console.log(`🖼️ Товаров с картинками: ${withImages.length}`);
        
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
    res.json({
        balance: userData.balance || 0,
        username: userData.username || ''
    });
});

// ===== ПРОВЕРКА ПОДПИСКИ =====
app.get('/api/check-subscription/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`🔍 Проверяем подписку пользователя ${userId} на канал ${CHANNEL_ID}`);

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${MAIN_BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`
        );
        const data = await response.json();

        if (data.ok) {
            const status = data.result.status;
            const isSubscribed = ['member', 'administrator', 'creator'].includes(status);
            res.json({ 
                subscribed: isSubscribed, 
                status: status,
                channel: CHANNEL_ID
            });
        } else {
            console.error('❌ Ошибка от Telegram API:', data.description);
            res.status(500).json({ 
                error: 'Не удалось проверить подписку',
                details: data.description
            });
        }
    } catch (error) {
        console.error('❌ Ошибка проверки подписки:', error.message);
        res.status(500).json({ 
            error: 'Ошибка сервера при проверке подписки',
            details: error.message
        });
    }
});

// ========== ПРИНЯТЬ ЗАКАЗ ==========
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
        username,
        useBonuses
    } = req.body;

    let finalTotal = total;
    let bonusSpent = 0;
    let bonusText = 'Нет';

    // ==== ЕСЛИ КЛИЕНТ ХОЧЕТ ПОТРАТИТЬ БОНУСЫ ====
    if (useBonuses) {
        const now = Date.now();
        if (now - lastUpdateCashback > CACHE_TIME || Object.keys(cashbackCache).length === 0) {
            cashbackCache = await loadCashbackFromGoogle();
            lastUpdateCashback = now;
        }

        const userData = cashbackCache[userId];
        if (userData && userData.balance > 0) {
            let available = userData.balance;
            let canSpend = Math.floor(available / 500) * 500;
            if (canSpend > total) {
                canSpend = Math.floor(total / 500) * 500;
            }

            if (canSpend >= 500) {
                userData.balance -= canSpend;
                bonusSpent = canSpend;
                finalTotal = total - canSpend;
                if (finalTotal < 0) finalTotal = 0;
                bonusText = `Да (${canSpend} бонусов)`;
            } else {
                bonusText = 'Нет (недостаточно для списания)';
            }
        } else {
            bonusText = 'Нет (недостаточно бонусов)';
        }
    }

    // ==== ФОРМИРУЕМ СПИСОК ТОВАРОВ ====
    let itemsText = '';
    items.forEach(item => {
        const optionText = item.option ? `: ${item.option}` : '';
        itemsText += `- ${item.name}${optionText} (1 шт. x ${item.price} тг)\n`;
    });

    const deliveryText = delivery === 0 ? 'Бесплатно' : `${delivery} тг`;
    const changeText = change && change !== 'Не требуется' ? change : 'Не требуется';
    const notesText = notes && notes !== 'Нет' ? notes : 'Нет';
    const bonusDisplay = useBonuses ? bonusText : 'Нет';

    // ==== УВЕДОМЛЕНИЕ ВЛАДЕЛЬЦУ ====
    const ownerMessage =
        `🛒 Оформлен новый заказ!\n\n` +
        `👤 Клиент: ${username ? '@' + username : userId} (${userId})\n` +
        `📍 Адрес доставки: ${address}\n` +
        `📞 Контактный телефон: ${phone}\n` +
        `🔄 Сдача с: ${changeText}\n` +
        `📝 Дополнительные пожелания: ${notesText}\n` +
        `🎯 Оплата бонусами: ${bonusText}\n\n` +
        `📦 Товары:\n${itemsText}\n` +
        `📦 Итого: ${finalTotal} тг`;

    console.log('🛒 НОВЫЙ ЗАКАЗ!');
    console.log(ownerMessage);
    console.log('-------------------');

    // ==== УВЕДОМЛЕНИЕ КЛИЕНТУ ====
    const clientMessage =
        `🛍 Магазин Piff&Puff - Ваш заказ\n\n` +
        `📅 Вы оформили заказ:\n\n` +
        `${itemsText}\n` +
        `💰 Стоимость с учетом доставки: ${finalTotal} тг\n` +
        `🚚 Доставка: ${deliveryText}\n\n` +
        `📍 Адрес доставки: ${address}\n` +
        `📞 Контактный телефон: ${phone}\n` +
        `🔄 Сдача с: ${changeText}\n` +
        `📝 Дополнительные пожелания: ${notesText}\n` +
        `🎯 Оплата бонусами: ${bonusDisplay}`;

    // ==== ОТПРАВКА ====
    try {
        await notifyBot.telegram.sendMessage(CHAT_ID, ownerMessage);
        console.log('✅ Уведомление владельцу отправлено');

        if (userId) {
            await mainBot.telegram.sendMessage(userId, clientMessage);
            console.log(`✅ Подтверждение отправлено пользователю ${userId}`);
        } else {
            console.log('⚠️ Нет userId, уведомление клиенту не отправлено');
        }
    } catch (error) {
        console.error('❌ Ошибка отправки уведомлений:', error.message);
    }

    res.json({
        success: true,
        message: 'Заказ принят!',
        order: { total: finalTotal, phone, address }
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