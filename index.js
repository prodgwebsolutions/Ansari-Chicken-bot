const token ='7579175007:AAHwciT-mlq8i2WZKRfrW1qcBgOllvOV_u0'; // Replace with your bot token
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(token);
const app = express();
app.use(bodyParser.json());

const URL = 'https://ansari-chicken-bot-1.onrender.com';
bot.setWebHook(`${URL}/bot${token}`);

const prices = {
  'Egg': 60,
  'Chicken': 120
};

const orders = {};

const mainMenu = {
  reply_markup: {
    keyboard: [['Chicken', 'Egg']],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

const timeSlots = [
  { label: '10:00 AM – 12:00 PM', hour: 10 },
  { label: '12:00 PM – 2:00 PM', hour: 12 },
  { label: '2:00 PM – 4:00 PM', hour: 14 },
  { label: '4:00 PM – 6:00 PM', hour: 16 },
  { label: '6:00 PM – 8:00 PM', hour: 18 },
  { label: '9:00 PM – 10:00 PM', hour: 21 }
];

function getAvailableTimeSlots() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return timeSlots.filter(slot => {
    const slotTime = new Date();
    slotTime.setHours(slot.hour, 0, 0, 0);
    return slotTime > now;
  });
}

function sendOrderToAdmin(bot, adminId, user, order) {
  const total = order.quantity * order.price;
  const unit = order.item === 'Egg' ? 'dozen' : 'kg';

  const adminMessage = `
📦 *New Order Received!*
👤 ${user.first_name} (@${user.username || 'no username'})
🍽️ *Item:* ${order.item}
🔢 *Quantity:* ${order.quantity} ${unit}
💰 *Total:* ₹${total}
📍 *Address:* ${order.address}
🏷️ *Pincode:* ${order.pincode}
🕒 *Time Slot:* ${order.slot}
📅 *Order Time:* ${new Date().toLocaleString()}
`;

  bot.sendMessage(5999029961, adminMessage, { parse_mode: 'Markdown' }).catch(err => {
    console.error('❌ Failed to send message to admin:', err.message);
  });
}

// === Handlers ===
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  orders[chatId] = {};
  const welcome = `👋 Hi *${msg.from.first_name || 'there'}*! Welcome to *Ansari Chicken Bot* 🐔\n\nWhat would you like to order?`;
  bot.sendMessage(chatId, welcome, { ...mainMenu, parse_mode: 'Markdown' });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith('/')) return;

  if (!orders[chatId]) orders[chatId] = {};
  const order = orders[chatId];

  if (!order.item) {
    if (text === 'Egg' || text === 'Chicken') {
      order.item = text;
      order.price = prices[text];
      const unit = text === 'Egg' ? 'dozen' : 'kg';
      bot.sendMessage(chatId, `📝 How many *${unit}* of ${text} would you like to order?`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ Please choose *Chicken* or *Egg*:', mainMenu);
    }
  } else if (!order.quantity) {
    const qty = parseFloat(text);
    if (isNaN(qty) || qty <= 0) {
      bot.sendMessage(chatId, '❗ Please enter a valid number (e.g., 2)');
    } else {
      order.quantity = qty;
      bot.sendMessage(chatId, `📍 Please type your *delivery address*.`, { parse_mode: 'Markdown' });
    }
  } else if (!order.address) {
    order.address = text;
    bot.sendMessage(chatId, `📮 Please enter your *pincode*.`, { parse_mode: 'Markdown' });
  } else if (!order.pincode) {
    const pin = parseInt(text);
    if (isNaN(pin) || text.length !== 6) {
      bot.sendMessage(chatId, '❗ Please enter a valid 6-digit pincode.');
    } else {
      order.pincode = text;
      const availableSlots = getAvailableTimeSlots();
      if (availableSlots.length === 0) {
        bot.sendMessage(chatId, '⚠️ Sorry, all time slots for today are closed. Please try again later.');
        delete orders[chatId];
        return;
      }
      order.slotOptions = availableSlots;
      const slotKeyboard = {
        reply_markup: {
          keyboard: availableSlots.map(s => [s.label]),
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      };
      bot.sendMessage(chatId, '🕒 Please choose a delivery *time slot*:', slotKeyboard);
    }
  } else if (!order.slot) {
    const selectedSlot = order.slotOptions.find(s => s.label === text);
    if (selectedSlot) {
      order.slot = selectedSlot.label;
      const total = order.quantity * order.price;
      const unit = order.item === 'Egg' ? 'dozen' : 'kg';
      const confirmMsg = `
✅ *Confirm Your Order:*
🍽️ Item: ${order.item}
🔢 Quantity: ${order.quantity} ${unit}
💰 Total: ₹${total}
📍 Address: ${order.address}
🏷️ Pincode: ${order.pincode}
🕒 Slot: ${order.slot}

Reply with *yes* to confirm or *cancel* to start over.`;
      bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ Please choose a valid slot from the options above.');
    }
  } else if (!order.confirmed) {
    if (text.toLowerCase() === 'yes') {
      order.confirmed = true;
      bot.sendMessage(chatId, '🎉 Your order has been placed successfully! 🛵');
      sendOrderToAdmin(bot, 5999029961, msg.from, order); // replace with your Telegram user ID
      delete orders[chatId];
    } else if (text.toLowerCase() === 'cancel') {
      delete orders[chatId];
      bot.sendMessage(chatId, '❌ Order cancelled. Type /start to begin again.');
    } else {
      bot.sendMessage(chatId, '❓ Please reply with *yes* to confirm or *cancel* to cancel.', { parse_mode: 'Markdown' });
    }
  }
});

// === Webhook Endpoint ===
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
});