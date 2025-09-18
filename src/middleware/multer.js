// multer.js
import multer from "multer";

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

  console.log("reached multer setup...")

const singleAvatar = multerUpload.single("avatar");
const attachmentFiles = multerUpload.array("files");

export { singleAvatar, attachmentFiles };
