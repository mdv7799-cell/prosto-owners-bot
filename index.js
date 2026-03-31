import 'dotenv/config';
import express from 'express';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'prosto_secret_123';
const PUBLIC_URL = process.env.PUBLIC_URL;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

// зберігання сесії (просто в памʼяті)
const sessions = {};

// старт
bot.start((ctx) => {
  sessions[ctx.from.id] = {};

  ctx.reply('Що хочете зробити?', Markup.keyboard([
    ['Продати', 'Здати в оренду']
  ]).resize());
});

// крок 1
bot.hears(['Продати', 'Здати в оренду'], (ctx) => {
  sessions[ctx.from.id].action = ctx.message.text;

  ctx.reply('Що саме?', Markup.keyboard([
    ['Квартира', 'Будинок'],
    ['Земля', 'Комерція']
  ]).resize());
});

// крок 2
bot.hears(['Квартира', 'Будинок', 'Земля', 'Комерція'], (ctx) => {
  sessions[ctx.from.id].type = ctx.message.text;

  if (ctx.message.text === 'Квартира') {
    ctx.reply('Скільки кімнат?', Markup.keyboard([
      ['1к', '2к'],
      ['3к', '4+']
    ]).resize());
  } else {
    ctx.reply('Вкажіть площу (м²)');
  }
});

// крок 3 (кімнати)
bot.hears(['1к', '2к', '3к', '4+'], (ctx) => {
  sessions[ctx.from.id].rooms = ctx.message.text;
  ctx.reply('Вкажіть район');
});

// крок 3 (площа)
bot.on('text', async (ctx) => {
  const user = sessions[ctx.from.id];
  if (!user) return;

  if (!user.rooms && user.type !== 'Квартира' && !user.area) {
    user.area = ctx.message.text;
    return ctx.reply('Вкажіть район');
  }

  if (!user.district) {
    user.district = ctx.message.text;

    if (user.action === 'Здати в оренду') {
      return ctx.reply('Вкажіть бажану ціну (грн/міс)');
    } else {
      return ctx.reply('Вкажіть бажану ціну ($)');
    }
  }

  if (!user.price) {
    user.price = ctx.message.text;
    return ctx.reply('Вкажіть ваш телефон');
  }

  if (!user.phone) {
    user.phone = ctx.message.text;

    const text = `
🔔 Нова заявка

Тип: ${user.action}
Об'єкт: ${user.type}
${user.rooms ? `Кімнати: ${user.rooms}` : `Площа: ${user.area} м²`}
Район: ${user.district}
Ціна: ${user.price}
Телефон: ${user.phone}
`;

    await bot.telegram.sendMessage(MANAGER_CHAT_ID, text);

    ctx.reply('Дякуємо! Ми звʼяжемось з вами 👍');

    delete sessions[ctx.from.id];
  }
});

// webhook
app.use(express.json());

const path = `/tg/${WEBHOOK_SECRET}`;

app.post(path, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, async () => {
  console.log('🚀 Server started');

  if (PUBLIC_URL) {
    const url = `${PUBLIC_URL}${path}`;
    await bot.telegram.setWebhook(url);
    console.log('✅ Webhook set:', url);
  }
});
