import { Comment, User } from "./useStatus";
import React from "react";
import {
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from "@material-ui/core";
import FaceIcon from "@material-ui/core/SvgIcon/SvgIcon";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";

export const CommentsComponent: React.SFC<{
  comments: Comment[];
  users: User[];
}> = (props) => {
  const m = new Map<string, string>();
  for (const u of props.users) {
    m.set(u.publicKeyDigest, u.name);
  }

  const c = (
    <List>
      {props.comments.map((c, i) => (
        <>
          <ListItem alignItems="flex-start" key={i}>
            <ListItemIcon>
              <FaceIcon />
            </ListItemIcon>
            <ListItemText
              primary={c.text}
              secondary={
                <>
                  {m.get(c.publicKeyDigest) || ""}
                  <VerifiedUserIcon fontSize="small" />
                  {c.publicKeyDigest.slice(0, 10)}
                </>
              }
            />
          </ListItem>
          <Divider />
        </>
      ))}
    </List>
  );

  return <Paper>{c}</Paper>;
};
