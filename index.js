import 'dotenv/config';
import express from 'express';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

const sessions = {};

// райони
const districts = [
  ['Амур-Нижньодніпровський', 'Індустріальний'],
  ['Центральний', 'Шевченківський'],
  ['Самарський', 'Соборний'],
  ['Чечелівський'],
  ['Дніпровський район (передмістя)']
];

// 🔥 СТАРТ (працює і для реклами)
bot.start((ctx) => {
  sessions[ctx.from.id] = { step: 'action' };

  return ctx.reply(
    '👋 Вітаємо в PROSTO Нерухомість!\n\nБажаєте продати чи здати в оренду нерухомість?',
    Markup.keyboard([
      ['Продати', 'Здати в оренду']
    ]).resize()
  );
});

// 🔥 якщо людина просто зайшла і написала щось
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  // якщо нема сесії — запускаємо як старт
  if (!sessions[userId]) {
    sessions[userId] = { step: 'action' };

    return ctx.reply(
      '👋 Вітаємо в PROSTO Нерухомість!\n\nБажаєте продати чи здати в оренду нерухомість?',
      Markup.keyboard([
        ['Продати', 'Здати в оренду']
      ]).resize()
    );
  }

  const user = sessions[userId];

  if (user.step === 'action') {
    user.action = text;
    user.step = 'type';

    return ctx.reply('Що саме?', Markup.keyboard([
      ['Квартира', 'Будинок'],
      ['Комерція', 'Земля']
    ]).resize());
  }

  if (user.step === 'type') {
    user.type = text;

    if (text === 'Квартира') {
      user.step = 'rooms';

      return ctx.reply('Скільки кімнат?', Markup.keyboard([
        ['1к', '2к'],
        ['3к', '4+']
      ]).resize());
    }

    user.step = 'area';
    return ctx.reply('Вкажіть площу (м²)');
  }

  if (user.step === 'rooms') {
    user.rooms = text;
    user.step = 'district';

    return ctx.reply('Оберіть район', Markup.keyboard(districts).resize());
  }

  if (user.step === 'area') {
    user.area = text;
    user.step = 'district';

    return ctx.reply('Оберіть район', Markup.keyboard(districts).resize());
  }

  if (user.step === 'district') {
    user.district = text;
    user.step = 'price';

    if (user.action === 'Здати в оренду') {
      return ctx.reply('Вкажіть ціну (грн/міс)');
    } else {
      return ctx.reply('Вкажіть ціну ($)');
    }
  }

  if (user.step === 'price') {
    user.price = text;
    user.step = 'phone';

    return ctx.reply(
      'Натисніть кнопку для номера',
      Markup.keyboard([
        [Markup.button.contactRequest('📞 Надіслати номер')]
      ]).resize()
    );
  }
});

bot.on('contact', async (ctx) => {
  const user = sessions[ctx.from.id];
  if (!user) return;

  user.phone = ctx.message.contact.phone_number;

  const message = `
🔔 Нова заявка

Тип: ${user.action}
Об'єкт: ${user.type}
${user.rooms ? `Кімнати: ${user.rooms}` : `Площа: ${user.area} м²`}
Район: ${user.district}
Ціна: ${user.price}
Телефон: ${user.phone}
`;

  await bot.telegram.sendMessage(MANAGER_CHAT_ID, message);

  ctx.reply('Дякуємо! Ми звʼяжемось 👍', Markup.removeKeyboard());

  delete sessions[ctx.from.id];
});

// webhook
app.use(express.json());

const path = `/tg/${WEBHOOK_SECRET}`;

app.post(path, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, async () => {
  console.log('🚀 Server started');

  if (PUBLIC_URL) {
    await bot.telegram.setWebhook(`${PUBLIC_URL}${path}`);
    console.log('✅ Webhook set');
  }
});
