import axios from "axios";
import errorHandler from "../helpers/errorHandler";

async function editComment({ body, commentId, headers, slug }) {
  try {
    const { data } = await axios({
      data: { comment: { body } },
      headers,
      method: "PUT",
      url: `api/articles/${slug}/comments/${commentId}`,
    });

    return data.comment;
  } catch (error) {
    errorHandler(error);
  }
}

export default editComment;
