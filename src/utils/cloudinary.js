import { v2 as cloudinary } from "cloudinary";
import { customError } from "../middleware/error.js";

export async function deleteFromCloudinary(dataArray, next) {
    const pendingDeletion = dataArray.map((item) =>
      // cloudinary.uploader.destroy(item.public_id)
      console.log(item.public_id)
    );

    // const results = await Promise.all(pendingDeletion);
    // const allOk = results.every((res) => res.result === "ok");

    // if (!allOk) {
    //   return next(new customError("Failed deleting all attachments", 400));
    // }
}
