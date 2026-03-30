import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'prosto_secret_123';
const PUBLIC_URL = process.env.PUBLIC_URL;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN missing');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// старт
bot.start((ctx) => {
  ctx.reply('Вітаю! Це PROSTO Нерухомість 👋\n\nЩо хочете зробити?', {
    reply_markup: {
      keyboard: [['Продати', 'Здати в оренду']],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// обробка тексту
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  console.log('📩', text);

  await bot.telegram.sendMessage(
    MANAGER_CHAT_ID,
    `Нова заявка:\n${text}\n\nвід @${ctx.from.username || 'без username'}`
  );

  ctx.reply('Дякуємо! Ми з вами звʼяжемось 👍');
});

// webhook сервер
const app = express();
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
