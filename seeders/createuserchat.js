// seeders/createUserChatsProgress.js
import mongoose from "mongoose";
import Chat from "../src/models/chat.model.js";
import UserChat from "../src/models/UserChat.js";
import Message from "../src/models/msg.model.js";
import dotenv from "dotenv";

// Simple progress bar
function printProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round(percentage / 2);
  const empty = 50 - filled;
  
  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
}

export const createUserChatsWithProgress = async () => {
  try {
    console.log("🚀 Starting UserChat seeder with progress...\n");

    const chats = await Chat.find().lean();
    console.log(`📊 Found ${chats.length} chats\n`);

    if (chats.length === 0) {
      console.log("⚠️  No chats found. Exiting...");
      process.exit(0);
    }

    const userChatsToCreate = [];
    const existingKeys = new Set(
      (await UserChat.find().lean()).map((uc) => `${uc.userId}_${uc.chatId}`)
    );

    let processed = 0;
    const totalChats = chats.length;

    for (const chat of chats) {
      processed++;
      printProgress(processed, totalChats);

      const lastMessage = await Message.findOne({ chat: chat._id })
        .sort({ createdAt: -1 })
        .lean();

      const lastMessageObj = lastMessage
        ? {
            message: lastMessage.text || "Media message",
            messageId: lastMessage._id,
          }
        : { message: "no message yet" };

      const lastMessageTime = lastMessage?.createdAt || null;

      for (const memberId of chat.members) {
        const key = `${memberId}_${chat._id}`;
        if (existingKeys.has(key)) continue;

        userChatsToCreate.push({
          userId: memberId,
          chatId: chat._id,
          lastMessage: lastMessageObj,
          lastMessageTime: lastMessageTime,
          isActive: true,
        });
      }
    }

    console.log("\n"); // New line after progress bar

    if (userChatsToCreate.length === 0) {
      console.log("⚠️  No new UserChats to create.");
      process.exit(0);
    }

    console.log(`💾 Inserting ${userChatsToCreate.length} UserChats...\n`);
    
    // Insert in batches to show progress
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < userChatsToCreate.length; i += batchSize) {
      const batch = userChatsToCreate.slice(i, i + batchSize);
      await UserChat.insertMany(batch, { ordered: false });
      inserted += batch.length;
      printProgress(inserted, userChatsToCreate.length);
    }

    console.log("\n\n" + "=".repeat(50));
    console.log("✅ SEEDER COMPLETED SUCCESSFULLY");
    console.log("=".repeat(50));
    console.log(`✅ Created: ${userChatsToCreate.length}`);
    console.log(`📁 Chats processed: ${chats.length}`);
    console.log("=".repeat(50) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeder error:", error);
    process.exit(1);
  }
};