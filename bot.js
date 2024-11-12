// bot.js
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

// Your Discord bot token (replace this with your actual bot token)
const token = 'MTMwNTcxMjAwNzQ0NTQ3OTUyNg.GdophY.kPb8Zqep93hMLuM5arftqZuxG7hC2rXnA88-pM';

// Initialize the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Game constants
const KENO_NUMBERS = 80; // Keno numbers range from 1 to 80
const MAX_SELECTION = 15; // Max numbers a player can select
const MAX_BET = 10; // Max bet is 10 credits
const MULTIPLIER = 10; // Multiplier option

// In-memory store for players' selected numbers and credits
let players = {};

// Utility function to generate random Keno draw (20 numbers)
function generateKenoDraw() {
    let draw = [];
    while (draw.length < 20) {
        const number = Math.floor(Math.random() * KENO_NUMBERS) + 1;
        if (!draw.includes(number)) {
            draw.push(number);
        }
    }
    return draw;
}

// Function to check for matches between player's numbers and the draw
function checkMatches(playerNumbers, draw) {
    return playerNumbers.filter(num => draw.includes(num));
}

// Command handling
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const command = message.content.toLowerCase().split(' ')[0];

    // !keno command - start a new game or join the existing game
    if (command === '!keno') {
        const player = message.author.id;

        if (!players[player]) {
            players[player] = { numbers: [], credits: 100, bet: 0, multiplier: 1 };
            message.reply("Welcome to Keno! You start with 100 credits. To play, use `!select` followed by your numbers (1-80). You can bet up to 10 credits. To use the 10x multiplier, use `!multiplier on`.");
        } else {
            message.reply("You have already joined the game. You can update your selections using `!select` or change your bet using `!bet`.");
        }
    }

    // !select command - players select their numbers
    if (command === '!select') {
        const player = message.author.id;
        const numbers = message.content.split(' ').slice(1).map(num => parseInt(num, 10));

        if (!players[player]) {
            message.reply("You need to join the game first by typing `!keno`.");
            return;
        }

        // Validate the numbers selected
        if (numbers.length === 0 || numbers.some(num => num < 1 || num > 80 || isNaN(num))) {
            message.reply("Please select valid numbers between 1 and 80.");
            return;
        }

        if (numbers.length > MAX_SELECTION) {
            message.reply(`You can only select up to ${MAX_SELECTION} numbers.`);
            return;
        }

        players[player].numbers = numbers;
        message.reply(`You have selected: ${numbers.join(', ')}`);
    }

    // !bet command - players place their bet (up to 10 credits)
    if (command === '!bet') {
        const player = message.author.id;
        const betAmount = parseInt(message.content.split(' ')[1], 10);

        if (!players[player]) {
            message.reply("You need to join the game first by typing `!keno`.");
            return;
        }

        if (isNaN(betAmount) || betAmount <= 0 || betAmount > MAX_BET) {
            message.reply(`Please bet an amount between 1 and ${MAX_BET} credits.`);
            return;
        }

        if (betAmount > players[player].credits) {
            message.reply("You don't have enough credits to make that bet.");
            return;
        }

        players[player].bet = betAmount;
        message.reply(`You have placed a bet of ${betAmount} credits.`);
    }

    // !multiplier command - toggle the 10x multiplier on/off
    if (command === '!multiplier') {
        const player = message.author.id;
        const option = message.content.split(' ')[1];

        if (!players[player]) {
            message.reply("You need to join the game first by typing `!keno`.");
            return;
        }

        if (option === 'on') {
            players[player].multiplier = MULTIPLIER;
            message.reply("You have activated the 10x multiplier!");
        } else if (option === 'off') {
            players[player].multiplier = 1;
            message.reply("You have deactivated the 10x multiplier.");
        } else {
            message.reply("Please specify `on` or `off` to toggle the multiplier.");
        }
    }

    // !draw command - start the Keno draw
    if (command === '!draw') {
        if (Object.keys(players).length === 0) {
            message.reply("No players have joined the game yet.");
            return;
        }

        // Ensure that all players have selected numbers and placed a bet
        for (const [playerId, playerData] of Object.entries(players)) {
            if (playerData.numbers.length === 0 || playerData.bet === 0) {
                const player = await client.users.fetch(playerId);
                message.reply(`${player.username}, you need to select numbers using \`!select\` and place a bet using \`!bet\` before the draw.`);
                return;
            }
        }

        // Generate the Keno draw (20 random numbers)
        const draw = generateKenoDraw();
        message.channel.send(`**Keno Draw**: ${draw.join(', ')}`);

        // Check each player's selected numbers against the draw and calculate winnings
        let results = [];
        for (const [playerId, playerData] of Object.entries(players)) {
            const player = await client.users.fetch(playerId);
            const matches = checkMatches(playerData.numbers, draw);
            const matchCount = matches.length;

            let winnings = 0;
            if (matchCount > 0) {
                winnings = playerData.bet * matchCount * playerData.multiplier; // Apply multiplier
                players[playerId].credits += winnings;
            }

            // Deduct the bet amount from the player's credits
            players[playerId].credits -= playerData.bet;

            results.push(`${player.username}: ${matchCount} match${matchCount === 1 ? '' : 'es'} (${matches.join(', ')}) - Winnings: ${winnings} credits | Credits left: ${players[playerId].credits}`);
        }

        // Send results to the channel
        message.channel.send(results.join('\n'));

        // Reset the game after the draw
        players = {};
    }
});

// Bot login
client.login(token);
