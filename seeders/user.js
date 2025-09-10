import { faker } from "@faker-js/faker";
import User from "../src/models/user.model.js";

const createUser = async (numUsers) => {
  try {
    const usersPromise = [];

    for (let i = 0; i < numUsers; i++) {
      const tempUser = User.create({
        fullName: faker.person.fullName(),
        username: faker.internet.username(),
        email: faker.internet.email(),
        bio: faker.lorem.sentence(10),
        password: "password",
        avatar: {
          public_id: faker.string.uuid(),
          url: faker.image.avatar(),
        },
      });
      usersPromise.push(tempUser);
    }

    await Promise.all(usersPromise);

    console.log("Users created", numUsers);
    process.exit(1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export { createUser };
