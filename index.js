import 'dotenv/config';
import express from 'express';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'prosto_secret_123';
const PUBLIC_URL = process.env.PUBLIC_URL;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

const sessions = {};

// райони Дніпра
const districts = [
  ['Амур-Нижньодніпровський', 'Індустріальний'],
  ['Центральний', 'Шевченківський'],
  ['Самарський', 'Соборний'],
  ['Чечелівський'],
  ['Дніпровський район (передмістя)']
];

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
  const user = sessions[ctx.from.id];
  user.type = ctx.message.text;

  if (user.type === 'Квартира') {
    user.step = 'rooms';

    return ctx.reply('Скільки кімнат?', Markup.keyboard([
      ['1к', '2к'],
      ['3к', '4+']
    ]).resize());
  }

  user.step = 'area';
  ctx.reply('Вкажіть площу (м²)');
});

// крок кімнати
bot.hears(['1к', '2к', '3к', '4+'], (ctx) => {
  const user = sessions[ctx.from.id];

  if (!user) {
    return ctx.reply('Натисніть /start');
  }

  if (user.step !== 'rooms') return;

  user.rooms = ctx.message.text;
  user.step = 'district';

  ctx.reply('Оберіть район', Markup.keyboard(districts).resize());
});

// універсальний обробник
bot.on('text', async (ctx) => {
  const user = sessions[ctx.from.id];
  if (!user) return;

  const text = ctx.message.text;

  // площа
  if (user.step === 'area') {
    user.area = text;
    user.step = 'district';

    return ctx.reply('Оберіть район', Markup.keyboard(districts).resize());
  }

  // район
  if (user.step === 'district') {
    user.district = text;
    user.step = 'price';

    if (user.action === 'Здати в оренду') {
      return ctx.reply('Вкажіть ціну (грн/міс)');
    } else {
      return ctx.reply('Вкажіть ціну ($)');
    }
  }

  // ціна
 if (user.step === 'price') {
  user.price = text;
  user.step = 'phone';

  return ctx.reply(
    'Натисніть кнопку, щоб надіслати номер',
    Markup.keyboard([
      [Markup.button.contactRequest('📞 Надіслати номер')]
    ]).resize()
  );
}

  // телефон
  if (user.step === 'phone') {
    user.phone = text;

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

    ctx.reply('Дякуємо! Ми звʼяжемось 👍');

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
