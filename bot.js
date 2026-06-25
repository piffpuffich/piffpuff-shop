const { Telegraf } = require('telegraf');

// ВСТАВЬ СВОЙ ТОКЕН
const BOT_TOKEN = '8704731828:AAFHE2Ar-frTsJ0lyPWGP29r22ZInCpAatY';

const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
    console.log(`👤 ${ctx.from.username || ctx.from.id} открыл бота`);
    ctx.reply(
        '💨 Добро пожаловать в Piff&Puff Shop!\n\n' +
        'Нажми на кнопку, чтобы открыть магазин.',
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { 
                            text: '🛍 Открыть магазин', 
                            web_app: { url: 'https://piffpuff-shop.onrender.com' } 
                        }
                    ]
                ]
            }
        }
    );
});

// Команда /help
bot.command('help', (ctx) => {
    ctx.reply(
        '📖 Помощь:\n\n' +
        '/start - Открыть магазин\n' +
        '/help - Эта справка\n' +
        '/contact - Связаться с нами'
    );
});

// Команда /contact
bot.command('contact', (ctx) => {
    ctx.reply('📞 Наш менеджер: @piffpuffich');
});

// Запуск
console.log('🤖 Запуск бота...');
bot.launch()
    .then(() => {
        console.log('✅ Бот запущен!');
        console.log('📱 Найди бота в Telegram и напиши /start');
    })
    .catch((err) => {
        console.log('❌ Ошибка:', err.message);
    });

// Остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));