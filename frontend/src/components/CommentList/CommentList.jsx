import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import dateFormatter from "../../helpers/dateFormatter";
import deleteComment from "../../services/deleteComment";
import editComment from "../../services/editComment";
import getComments from "../../services/getComments";
import CommentAuthor from "./CommentAuthor";

function CommentList({ triggerUpdate, updateComments }) {
  const [comments, setComments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draftBody, setDraftBody] = useState("");
  const { headers, isAuth, loggedUser } = useAuth();
  const { slug } = useParams();

  useEffect(() => {
    getComments({ slug }).then(setComments).catch(console.error);
  }, [slug, triggerUpdate]);

  const handleClick = (commentId) => {
    if (!isAuth) alert("You need to login first");

    const confirmation = window.confirm("Want to delete the comment?");
    if (!confirmation) return;

    deleteComment({ commentId, headers, slug })
      .then(updateComments)
      .catch(console.error);
  };

  const handleEditClick = (commentId, currentBody) => {
    setEditingId(commentId);
    setDraftBody(currentBody);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraftBody("");
  };

  const handleSaveEdit = (commentId) => {
    if (draftBody.trim() === "") return;

    editComment({ body: draftBody, commentId, headers, slug })
      .then(updateComments)
      .then(() => {
        setEditingId(null);
        setDraftBody("");
      })
      .catch(console.error);
  };

  return comments?.length > 0 ? (
    comments.map(({ author, author: { username }, body, createdAt, id }) => {
      const isOwnComment = isAuth && loggedUser.username === username;
      const isEditing = editingId === id;

      return (
        <div className="card" key={id}>
          <div className="card-block">
            {isEditing ? (
              <textarea
                className="form-control"
                onChange={(e) => setDraftBody(e.target.value)}
                rows="3"
                value={draftBody}
              ></textarea>
            ) : (
              <p className="card-text">{body}</p>
            )}
          </div>
          <div className="card-footer">
            <CommentAuthor {...author} />
            <span className="date-posted">{dateFormatter(createdAt)}</span>
            {isOwnComment && isEditing && (
              <>
                <button
                  className="btn btn-sm btn-primary pull-xs-right"
                  onClick={() => handleSaveEdit(id)}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary pull-xs-right"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </>
            )}
            {isOwnComment && !isEditing && (
              <>
                <button
                  className="btn btn-sm btn-outline-secondary pull-xs-right"
                  onClick={() => handleClick(id)}
                >
                  <i className="ion-trash-a"></i>
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary pull-xs-right"
                  onClick={() => handleEditClick(id, body)}
                >
                  <i className="ion-edit"></i>
                </button>
              </>
            )}
          </div>
        </div>
      );
    })
  ) : (
    <div>There are no comments yet...</div>
  );
}

export default CommentList;
