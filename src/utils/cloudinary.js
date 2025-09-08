import { v2 as cloudinary } from "cloudinary";
import { customError } from "../middleware/error.js";

export async function deleteFromCloudinary(dataArray, next) {

    const pendingDeletion = dataArray.map((publicId) =>
      cloudinary.uploader.destroy(publicId)
    );

    const results = await Promise.all(pendingDeletion);
    const allOk = results.every((res) => res.result === "ok");

    if (!allOk) {
      return next(new customError("Failed deleting all attachments", 400));
    }
}
