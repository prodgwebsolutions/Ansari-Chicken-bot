const TelegramBot = require('node-telegram-bot-api');
const token = '7579175007:AAHwciT-mlq8i2WZKRfrW1qcBgOllvOV_u0';
const bot = new TelegramBot(token, { polling: true });

// 📋 Menu
const menu = {
  'Half kG Chicken': 70,
  '1KG Chicken': 120,
  'Spicy Wings (6 pcs)': 120,
};

// 🗃️ Store per-user orders
const orders = {};

// 📱 Keyboard buttons
const menuButtons = {
  reply_markup: {
    keyboard: [
      ['Half kG Chicken', '1KG Chicken'],
      ['Spicy Wings (6 pcs)'],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

function sendOrderToAdmin(bot, adminId, user, order) {
  const total = order.quantity * order.price;

  const adminMessage = `
📦 *New Order Received!*
👤 ${user.first_name} (@${user.username || 'no username'})
🍗 *Item:* ${order.item}
🔢 *Qty:* ${order.quantity}
💰 *Total:* ₹${total}
📍 *Address:* ${order.address}
🕒 *Time:* ${new Date().toLocaleString()}
  `;

  bot.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' });
}
// 🚀 Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  orders[chatId] = {}; // reset user session
  const welcome = `👋 Hi *${msg.from.first_name || 'there'}*! Welcome to *Ansari Chicken Bot* 🐔\n\nPlease choose an item from the menu below:`;
  bot.sendMessage(chatId, welcome, { ...menuButtons, parse_mode: 'Markdown' });
});

// 🔄 Menu command
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 Choose your item from the menu:', menuButtons);
});

// 📦 Handle order process
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith('/')) return;

  if (!orders[chatId]) orders[chatId] = {};
  const order = orders[chatId];

  // Step 1: Item selection
  if (!order.item) {
    if (menu[text]) {
      order.item = text;
      order.price = menu[text];
      bot.sendMessage(chatId, `📝 Great! How many *${order.item}* would you like to order?`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ Please choose a valid item from the menu:', menuButtons);
    }
  }

  // Step 2: Quantity
  else if (!order.quantity) {
    const qty = parseInt(text);
    if (isNaN(qty) || qty <= 0) {
      bot.sendMessage(chatId, '❗ Please enter a valid number (e.g., 2)');
    } else {
      order.quantity = qty;
      bot.sendMessage(chatId, `📍 Please type your *delivery address*.`, { parse_mode: 'Markdown' });
    }
  }

  // Step 3: Address
  else if (!order.address) {
    order.address = text;
    const total = order.price * order.quantity;

    const confirmMsg = `
✅ *Confirm Your Order:*
🍗 Item: ${order.item}
🔢 Quantity: ${order.quantity}
💰 Total: ₹${total}
📍 Address: ${order.address}

Reply with *yes* to confirm or *cancel* to start over.`;

    bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown' });
  }

  // Step 4: Confirm or cancel
  else if (!order.confirmed) {
    if (text.toLowerCase() === 'yes') {
      order.confirmed = true;
      const total = order.price * order.quantity;

      bot.sendMessage(chatId, '🎉 Your order has been placed successfully! We’ll contact you soon. 🛵');

      const adminId = 6829911385; // Replace with your admin Telegram user ID
      const adminMsg = `
📦 *New Order Received!*
👤 ${msg.from.first_name} (@${msg.from.username || 'no username'})
🍗 ${order.item}
🔢 Quantity: ${order.quantity}
💰 Total: ₹${total}
📍 Address: ${order.address}
      `;

      bot.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' });
      sendOrderToAdmin(bot, adminId, msg.from, order);
      delete orders[chatId]; // 🧹 Clear user session after confirmation
    } else if (text.toLowerCase() === 'cancel') {
      delete orders[chatId];
      bot.sendMessage(chatId, '❌ Order cancelled. Type /start to begin a new one.');
    } else {
      bot.sendMessage(chatId, '❓ Please reply with *yes* to confirm or *cancel* to cancel the order.', { parse_mode: 'Markdown' });
    }
  }
});
