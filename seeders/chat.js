import { faker, simpleFaker } from "@faker-js/faker";
import Chat from "../src/models/chat.model.js";
import Message from "../src/models/msg.model.js";
import User from "../src/models/user.model.js";
import UserChat from "../src/models/UserChat.js";

const createSingleChats = async (numChats) => {
  try {
    const users = await User.find().select("_id");

    const chatsPromise = [];

    for (let i = 0; i < numChats; i++) {
      const x = Math.floor(Math.random() * users.length);
      const y = Math.floor(Math.random() * users.length);

      if (x !== y) {
        chatsPromise.push(
          Chat.create({
            members: [users[x], users[y]],
          })
        );
      }
    }

    // Wait for all chats to be created
    const createdChats = await Promise.all(chatsPromise);

    // Create UserChat entries for both members of each chat
    const userChatPromises = [];

    for (const chat of createdChats) {
      // Create UserChat for first member
      userChatPromises.push(
        UserChat.create({
          userId: chat.members[0],
          chatId: chat._id
        })
      );

      // Create UserChat for second member
      userChatPromises.push(
        UserChat.create({
          userId: chat.members[1],
          chatId: chat._id,
        })
      );
    }

    await Promise.all(userChatPromises);

    console.log("Single chats created successfully");
    console.log(`Created ${createdChats.length} chats with ${userChatPromises.length} UserChat entries`);
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const createGroupChats = async (numChats) => {
  try {
    const users = await User.find().select("_id");

    const chatsPromise = [];

    for (let i = 0; i < numChats; i++) {
      const numMembers = simpleFaker.number.int({ min: 3, max: 8 });
      const members = [];

      for (let j = 0; j < numMembers; j++) {
        const randomIndex = Math.floor(Math.random() * users.length);
        const randomUser = users[randomIndex];

        // Ensure the same user is not added twice
        if (!members.includes(randomUser)) {
          members.push(randomUser);
        }
      }

      const chat = Chat.create({
        groupChat: true,
        name: faker.lorem.words(1),
        members,
        description: faker.lorem.lines(3),
        creator: members[0],
      });

      chatsPromise.push(chat);
    }

    // Wait for all chats to be created
    const createdChats = await Promise.all(chatsPromise);

    // Create UserChat entries for all members of all chats
    const userChatPromises = [];

    for (const chat of createdChats) {
      for (const memberId of chat.members) {
        userChatPromises.push(
          UserChat.create({
            userId: memberId,
            chatId: chat._id,
          })
        );
      }
    }

    await Promise.all(userChatPromises);

    console.log("Group chats created successfully");
    console.log(`Created ${createdChats.length} chats with UserChat entries`);
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const createMessages = async (numMessages) => {
  try {
    const users = await User.find().select("_id");
    const chats = await Chat.find().select("_id");

    const messagesPromise = [];

    for (let i = 0; i < numMessages; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomChat = chats[Math.floor(Math.random() * chats.length)];

      messagesPromise.push(
        Message.create({
          chat: randomChat,
          sender: randomUser,
          text: faker.lorem.sentence(),
          attachments: [
            {
              url: faker.image.avatar(),
              public_id: faker.string.uuid(),
            },
            {
              url: faker.image.avatar(),
              public_id: faker.string.uuid(),
            },
            {
              url: faker.image.avatar(),
              public_id: faker.string.uuid(),
            },
          ],
        })
      );
    }

    await Promise.all(messagesPromise);

    console.log("Messages created successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const createMessagesInAChat = async (chatId, numMessages) => {
  try {
    const users = await User.find().select("_id");

    const messagesPromise = [];

    for (let i = 0; i < numMessages; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];

      messagesPromise.push(
        Message.create({
          chat: chatId,
          text : faker.lorem.sentence(),
          sender: randomUser,
          attachments: {
            public_id : faker.string.uuid(),
            url : faker.image.avatar()
          },
        })
      );
    }

    await Promise.all(messagesPromise);

    console.log("Messages created successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export {
  createGroupChats,
  createMessages,
  createMessagesInAChat,
  createSingleChats,
};
