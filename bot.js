const { Telegraf } = require('telegraf');

// ВСТАВЬ СВОЙ ТОКЕН
const BOT_TOKEN = '8704731828:AAFHE2Ar-fRtSJolYPWGP29r22ZInCpAatY';

const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
    console.log(`👤 ${ctx.from.username || ctx.from.id} открыл бота`);
    
    ctx.reply(
       '💨 Добро пожаловать в Piff&Puff Shop!' +
        'Открой магазин в браузере:\n' +
        '👉 http://localhost:3000\n\n' +
        '💡 Когда выложим магазин в интернет, он будет открываться прямо в Telegram!'
    );
});

// Команда /help
bot.command('help', (ctx) => {
    ctx.reply(
        '📖 Помощь:\n\n' +
        '/start - Показать магазин\n' +
        '/help - Эта справка'
    );
});

// Команда /shop (отдельная команда для магазина)
bot.command('shop', (ctx) => {
    ctx.reply(
        '🛍 Ссылка на магазин:\n' +
        'http://localhost:3000'
    );
});

// На случай, если пользователь что-то пишет
bot.on('text', (ctx) => {
    console.log(`💬 ${ctx.from.username}: ${ctx.message.text}`);
    // Не отвечаем на всё подряд, чтобы не спамить
});

// Запуск
console.log('🤖 Запуск бота...');

bot.launch()
    .then(() => {
        console.log('✅ Бот запущен!');
        console.log('📱 Найди бота в Telegram и напиши /start');
    })
    .catch((err) => {
        console.log('❌ Ошибка при запуске:');
        console.log(err.message);
    });

// Остановка
process.once('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log('🛑 Бот остановлен');
    bot.stop('SIGTERM');
});